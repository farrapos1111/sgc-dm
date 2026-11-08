/**
 * Cria (ou reaproveita) a conta de acesso de uma ficha e liga as duas.
 * Usado pela secretaria do Bethel e pelo Console. Somente servidor:
 * quem chama já checou a permissão.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ensureAccountInChapter,
  findAuthUserByEmail,
  type ConsoleContext,
} from "@/lib/console/console.server";

export type FichaTable = "fdj_members" | "members";

type Ficha = {
  id: string;
  chapter_id: string;
  user_id: string | null;
  person_id: string | null;
  full_name: string;
  email: string | null;
};

export type LinkResult = {
  userId: string;
  created: boolean;
  temporaryPassword: string | null;
  emailStatus: string;
  emailError: string | null;
};

export async function linkFichaAccount(input: {
  table: FichaTable;
  fichaId: string;
  actorId: string;
  email?: string | null;
  sendEmail?: boolean;
}): Promise<LinkResult> {
  // O cliente gerado ainda não conhece todas as colunas novas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;
  const ctx: ConsoleContext = { actorId: input.actorId, admin };

  const { data: row, error } = await admin
    .from(input.table)
    .select("id, chapter_id, user_id, person_id, full_name, email")
    .eq("id", input.fichaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const ficha = row as Ficha | null;
  if (!ficha) throw new Error("Ficha não encontrada");
  if (ficha.user_id) throw new Error("Esta ficha já tem conta de acesso");

  const email = (input.email ?? ficha.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido para criar o acesso");
  }

  // Uma conta só pode ter uma ficha por esfera: confere antes de criar/vincular.
  const existing = await findAuthUserByEmail(ctx, email);
  if (existing) {
    const { data: other, error: oErr } = await admin
      .from(input.table)
      .select("id, full_name")
      .eq("user_id", existing.id)
      .neq("id", ficha.id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (other) {
      throw new Error(`Este e-mail já está ligado à ficha de "${other.full_name}"`);
    }
  }

  const account = await ensureAccountInChapter(ctx, {
    email,
    fullName: ficha.full_name,
    chapterId: ficha.chapter_id,
    roleName: "membro",
    keepExistingRole: true,
  });

  // Identidade compartilhada (people): reaproveita a da conta, se existir.
  const { data: existingPerson } = await admin
    .from("people")
    .select("id")
    .eq("user_id", account.userId)
    .maybeSingle();
  let personId: string | null = ficha.person_id;
  if (existingPerson?.id) {
    personId = existingPerson.id;
  } else if (ficha.person_id) {
    const { error: pErr } = await admin
      .from("people")
      .update({ user_id: account.userId })
      .eq("id", ficha.person_id)
      .is("user_id", null);
    if (pErr) throw new Error(pErr.message);
  }

  const { error: linkErr } = await admin
    .from(input.table)
    .update({ user_id: account.userId, email, ...(personId ? { person_id: personId } : {}) })
    .eq("id", ficha.id);
  if (linkErr) throw new Error(linkErr.message);

  if (personId) {
    await admin
      .from("profiles")
      .update({ person_id: personId })
      .eq("id", account.userId)
      .is("person_id", null);
  }
  // people antigo da ficha ficou órfão? remove.
  if (ficha.person_id && personId && ficha.person_id !== personId) {
    await admin.from("people").delete().eq("id", ficha.person_id).is("user_id", null);
  }

  let mail = { status: "skipped", error: null as string | null };
  if (input.sendEmail !== false && account.temporaryPassword) {
    mail = await sendAccountEmail(ficha.chapter_id, {
      fullName: ficha.full_name,
      email,
      temporaryPassword: account.temporaryPassword,
    });
  }

  return {
    userId: account.userId,
    created: account.created,
    temporaryPassword: account.temporaryPassword,
    emailStatus: mail.status,
    emailError: mail.error,
  };
}

/** E-mail de boas-vindas com a senha temporária, com o login da esfera certa. */
export async function sendAccountEmail(
  chapterId: string,
  input: { fullName: string; email: string; temporaryPassword: string },
): Promise<{ status: string; error: string | null }> {
  try {
    const [{ loadChapterEmailAssets }, { accountCreatedEmail }, mail, realmLib] = await Promise.all(
      [
        import("@/lib/email-brand.server"),
        import("@/lib/email-templates"),
        import("@/lib/email"),
        import("@/lib/realm"),
      ],
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ch } = await (supabaseAdmin as any)
      .from("chapters")
      .select("realm")
      .eq("id", chapterId)
      .maybeSingle();
    const realm = (ch?.realm as string | null) ?? null;
    const assets = await loadChapterEmailAssets(chapterId);
    const loginBase = realmLib.isRealm(realm)
      ? realmLib.realmAbsoluteUrl(realm)
      : realmLib.hubAbsoluteUrl();
    const copy = accountCreatedEmail({
      fullName: input.fullName,
      loginUrl: `${loginBase.replace(/\/$/, "")}/auth`,
      brand: assets.brand,
      temporaryPassword: input.temporaryPassword,
    });
    const res = await mail.sendTransactionalEmail({
      to: [input.email],
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
      attachments: assets.attachments,
    });
    return mail.summarizeEmailResult(res);
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
