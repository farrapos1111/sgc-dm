/**
 * Núcleo do Console (somente servidor).
 * Toda server function do Console chama `requireConsoleAdmin` antes de usar
 * o cliente service-role, e registra o que fez com `consoleAudit`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AuthContext = {
  userId: string;
  claims: Record<string, unknown>;
};

export type ConsoleContext = {
  actorId: string;
  // O cliente gerado ainda não conhece as tabelas novas do Console.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
};

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await (supabaseAdmin as never as ConsoleContext["admin"])
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Admin de plataforma + sessão com 2FA (aal2). */
export async function requireConsoleAdmin(context: AuthContext): Promise<ConsoleContext> {
  if (!(await isPlatformAdmin(context.userId))) {
    throw new Error("Acesso restrito aos administradores da plataforma.");
  }
  if (context.claims.aal !== "aal2") {
    throw new Error("Confirme o código de verificação em duas etapas para continuar.");
  }
  return { actorId: context.userId, admin: supabaseAdmin };
}

export async function consoleAudit(
  ctx: ConsoleContext,
  action: string,
  target?: { type: string; id: string | null },
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await ctx.admin.from("platform_audit_log").insert({
    actor_id: ctx.actorId,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    details,
  });
  if (error) console.error("[console] audit insert failed:", error.message);
}

export async function findAuthUserByEmail(
  ctx: ConsoleContext,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await ctx.admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const found = (data.users as { id: string; email?: string }[]).find(
      (u) => (u.email ?? "").toLowerCase() === normalized,
    );
    if (found) return { id: found.id, email: found.email ?? normalized };
    if (data.users.length < perPage) break;
  }
  return null;
}

export function randomPassword(length = 14): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Cria (ou reaproveita) a conta e vincula à instituição com o papel dado. */
export async function ensureAccountInChapter(
  ctx: ConsoleContext,
  input: {
    email: string;
    fullName: string;
    chapterId: string;
    roleName: string;
  },
): Promise<{ userId: string; created: boolean; temporaryPassword: string | null }> {
  const email = input.email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(ctx, email);
  let userId: string;
  let created = false;
  let temporaryPassword: string | null = null;

  if (existing) {
    userId = existing.id;
  } else {
    temporaryPassword = randomPassword();
    const { data, error } = await ctx.admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, must_change_password: true },
    });
    if (error || !data?.user) throw new Error(error?.message ?? "Falha ao criar conta");
    userId = data.user.id;
    created = true;
    const { error: pErr } = await ctx.admin
      .from("profiles")
      .update({ full_name: input.fullName, must_change_password: true })
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);
  }

  await setChapterRole(ctx, userId, input.chapterId, input.roleName);
  return { userId, created, temporaryPassword };
}

/** Um vínculo por (usuário, instituição): cria, reativa ou troca o papel. */
export async function setChapterRole(
  ctx: ConsoleContext,
  userId: string,
  chapterId: string,
  roleName: string,
): Promise<void> {
  const { data: role, error: roleErr } = await ctx.admin
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();
  if (roleErr) throw new Error(roleErr.message);
  if (!role) throw new Error(`Papel "${roleName}" não existe`);

  const { data: links, error: lErr } = await ctx.admin
    .from("chapter_members")
    .select("id, role_id, active")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId);
  if (lErr) throw new Error(lErr.message);

  const rows = (links ?? []) as { id: string; role_id: number; active: boolean }[];
  const same = rows.find((r) => r.role_id === role.id);
  if (same) {
    if (!same.active) {
      const { error } = await ctx.admin
        .from("chapter_members")
        .update({ active: true })
        .eq("id", same.id);
      if (error) throw new Error(error.message);
    }
    return;
  }
  if (rows[0]) {
    const { error } = await ctx.admin
      .from("chapter_members")
      .update({ role_id: role.id, active: true })
      .eq("id", rows[0].id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await ctx.admin.from("chapter_members").insert({
    user_id: userId,
    chapter_id: chapterId,
    role_id: role.id,
    active: true,
  });
  if (error) throw new Error(error.message);
}
