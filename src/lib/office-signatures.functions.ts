import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentTerm } from "@/lib/terms";
import {
  OFFICE_SIGNATURE_REQUIRED_CODES,
  OFFICE_SIGNATURE_LABELS,
  canonicalOfficeSignatureCode,
  isOfficeSignatureRequiredCode,
} from "@/lib/office-signatures-shared";

export {
  OFFICE_SIGNATURE_REQUIRED_CODES,
  OFFICE_SIGNATURE_LABELS,
  canonicalOfficeSignatureCode,
  isOfficeSignatureRequiredCode,
} from "@/lib/office-signatures-shared";

export type RequiredOfficeSignature = {
  memberId: string;
  chapterId: string;
  chapterName: string;
  positionCode: string;
  positionLabel: string;
};

type OfficeNeed = RequiredOfficeSignature;

async function findMissingOfficeSignatures(
  supabase: {
    from: (t: string) => any;
  },
  userId: string,
): Promise<OfficeNeed[]> {
  const term = currentTerm();

  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, chapter_id, chapter:chapters!members_chapter_id_fkey(id, name)")
    .eq("user_id", userId);
  if (memErr) throw new Error(memErr.message);
  if (!members?.length) return [];

  const memberIds = members.map((m: { id: string }) => m.id);

  const { data: positions, error: posErr } = await supabase
    .from("member_positions")
    .select(
      "member_id, chapter_id, position:positions(code, label), chapter:chapters(id, name)",
    )
    .in("member_id", memberIds)
    .eq("term_year", term.year)
    .eq("term_semester", term.semester)
    .is("ended_at", null);
  if (posErr) throw new Error(posErr.message);

  const needs: OfficeNeed[] = [];
  const seen = new Set<string>();

  for (const row of positions ?? []) {
    const pos = Array.isArray(row.position) ? row.position[0] : row.position;
    const code = pos?.code as string | undefined;
    if (!code || !isOfficeSignatureRequiredCode(code)) continue;

    const canonical = canonicalOfficeSignatureCode(code);
    const chapterId = row.chapter_id as string;
    const memberId = row.member_id as string;
    const key = `${memberId}:${chapterId}:${canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
    const memberRow = members.find((m: { id: string }) => m.id === memberId);
    const memberChapter = memberRow
      ? Array.isArray(memberRow.chapter)
        ? memberRow.chapter[0]
        : memberRow.chapter
      : null;

    needs.push({
      memberId,
      chapterId,
      chapterName:
        (chapter?.name as string | undefined) ||
        (memberChapter?.name as string | undefined) ||
        "Capítulo",
      positionCode: canonical,
      positionLabel:
        OFFICE_SIGNATURE_LABELS[canonical] ||
        (pos?.label as string | undefined) ||
        canonical,
    });
  }

  if (needs.length === 0) return [];

  const { data: existing, error: sigErr } = await supabase
    .from("member_office_signatures")
    .select("member_id, chapter_id, position_code, signature_data_url")
    .in(
      "member_id",
      needs.map((n) => n.memberId),
    );
  if (sigErr) throw new Error(sigErr.message);

  const valid = new Set(
    (existing ?? [])
      .filter(
        (s: { signature_data_url?: string | null }) =>
          Boolean(s.signature_data_url?.trim()),
      )
      .map(
        (s: {
          member_id: string;
          chapter_id: string;
          position_code: string;
        }) =>
          `${s.member_id}:${s.chapter_id}:${canonicalOfficeSignatureCode(s.position_code)}`,
      ),
  );

  return needs.filter(
    (n) => !valid.has(`${n.memberId}:${n.chapterId}:${n.positionCode}`),
  );
}

/** Indica se o usuário autenticado ainda precisa registrar assinatura de cargo. */
export const needsSignatureForOffices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const missing = await findMissingOfficeSignatures(
      context.supabase,
      context.userId,
    );
    return { needsSignature: missing.length > 0 };
  });

/** Retorna o próximo cargo/capítulo sem assinatura válida (ou null). */
export const getRequiredOfficeSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const missing = await findMissingOfficeSignatures(
      context.supabase,
      context.userId,
    );
    const requirement = missing[0] ?? null;
    return {
      needsSignature: requirement != null,
      requirement,
    };
  });

/** Persiste (upsert) a assinatura do cargo exigido. */
export const saveOfficeSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        chapterId: z.string().uuid(),
        positionCode: z.string().min(1).max(80),
        signatureDataUrl: z.string().min(32).max(2_000_000),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const canonical = canonicalOfficeSignatureCode(data.positionCode);
    if (
      !isOfficeSignatureRequiredCode(data.positionCode) &&
      !isOfficeSignatureRequiredCode(canonical)
    ) {
      throw new Error("Cargo não exige assinatura digital.");
    }
    if (!data.signatureDataUrl.startsWith("data:image/")) {
      throw new Error("Assinatura inválida.");
    }

    const { data: member, error: memErr } = await context.supabase
      .from("members")
      .select("id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!member || member.user_id !== context.userId) {
      throw new Error("Você só pode assinar pelo próprio perfil.");
    }

    const missing = await findMissingOfficeSignatures(
      context.supabase,
      context.userId,
    );
    const allowed = missing.some(
      (n) =>
        n.memberId === data.memberId &&
        n.chapterId === data.chapterId &&
        n.positionCode === canonical,
    );
    // Também permite regravar se já existe (mesmo cargo atual)
    if (!allowed) {
      const term = currentTerm();
      const { data: posRows, error: posErr } = await context.supabase
        .from("member_positions")
        .select("position:positions(code)")
        .eq("member_id", data.memberId)
        .eq("chapter_id", data.chapterId)
        .eq("term_year", term.year)
        .eq("term_semester", term.semester)
        .is("ended_at", null);
      if (posErr) throw new Error(posErr.message);
      const holds = (posRows ?? []).some((r: { position?: unknown }) => {
        const p = Array.isArray(r.position) ? r.position[0] : r.position;
        const code = (p as { code?: string } | null)?.code;
        return code && canonicalOfficeSignatureCode(code) === canonical;
      });
      if (!holds) {
        throw new Error("Você não ocupa este cargo no capítulo atual.");
      }
    }

    const { error } = await context.supabase
      .from("member_office_signatures")
      .upsert(
        {
          member_id: data.memberId,
          chapter_id: data.chapterId,
          position_code: canonical,
          signature_data_url: data.signatureDataUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id,chapter_id,position_code" },
      );
    if (error) throw new Error(error.message);

    const stillMissing = await findMissingOfficeSignatures(
      context.supabase,
      context.userId,
    );
    return {
      ok: true as const,
      needsSignature: stillMissing.length > 0,
      requirement: stillMissing[0] ?? null,
    };
  });

export type MyOfficeSignatureRow = {
  memberId: string;
  memberName: string;
  chapterId: string;
  chapterName: string;
  positionCode: string;
  positionLabel: string;
  signatureDataUrl: string | null;
  updatedAt: string | null;
};

/** Assinaturas oficiais do usuário (cargos que exigem tinta), para o Perfil. */
export const listMyOfficeSignatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    const term = currentTerm();

    let membersQuery = context.supabase
      .from("members")
      .select("id, chapter_id, full_name, chapter:chapters!members_chapter_id_fkey(id, name)")
      .eq("user_id", context.userId);
    if (data.memberId) {
      membersQuery = membersQuery.eq("id", data.memberId);
    }
    const { data: members, error: memErr } = await membersQuery;
    if (memErr) throw new Error(memErr.message);
    if (!members?.length) return [] as MyOfficeSignatureRow[];

    const memberIds = members.map((m: { id: string }) => m.id);

    const { data: positions, error: posErr } = await context.supabase
      .from("member_positions")
      .select(
        "member_id, chapter_id, position:positions(code, label), chapter:chapters(id, name)",
      )
      .in("member_id", memberIds)
      .eq("term_year", term.year)
      .eq("term_semester", term.semester)
      .is("ended_at", null);
    if (posErr) throw new Error(posErr.message);

    const slots: Array<{
      memberId: string;
      memberName: string;
      chapterId: string;
      chapterName: string;
      positionCode: string;
      positionLabel: string;
    }> = [];
    const seen = new Set<string>();

    for (const row of positions ?? []) {
      const pos = Array.isArray(row.position) ? row.position[0] : row.position;
      const code = pos?.code as string | undefined;
      if (!code || !isOfficeSignatureRequiredCode(code)) continue;
      const canonical = canonicalOfficeSignatureCode(code);
      const chapterId = row.chapter_id as string;
      const memberId = row.member_id as string;
      const key = `${memberId}:${chapterId}:${canonical}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
      const memberRow = members.find((m: { id: string }) => m.id === memberId);
      const memberChapter = memberRow
        ? Array.isArray(memberRow.chapter)
          ? memberRow.chapter[0]
          : memberRow.chapter
        : null;

      slots.push({
        memberId,
        memberName:
          (memberRow as { full_name?: string } | undefined)?.full_name?.trim() ||
          "",
        chapterId,
        chapterName:
          (chapter?.name as string | undefined) ||
          (memberChapter?.name as string | undefined) ||
          "Capítulo",
        positionCode: canonical,
        positionLabel:
          OFFICE_SIGNATURE_LABELS[canonical] ||
          (pos?.label as string | undefined) ||
          canonical,
      });
    }

    if (slots.length === 0) return [] as MyOfficeSignatureRow[];

    const { data: existing, error: sigErr } = await context.supabase
      .from("member_office_signatures")
      .select(
        "member_id, chapter_id, position_code, signature_data_url, updated_at",
      )
      .in(
        "member_id",
        slots.map((s) => s.memberId),
      );
    if (sigErr) throw new Error(sigErr.message);

    const byKey = new Map<
      string,
      { signatureDataUrl: string | null; updatedAt: string | null }
    >();
    for (const s of existing ?? []) {
      const code = canonicalOfficeSignatureCode(
        (s as { position_code: string }).position_code,
      );
      const key = `${(s as { member_id: string }).member_id}:${(s as { chapter_id: string }).chapter_id}:${code}`;
      byKey.set(key, {
        signatureDataUrl:
          (s as { signature_data_url?: string | null }).signature_data_url?.trim() ||
          null,
        updatedAt: (s as { updated_at?: string | null }).updated_at ?? null,
      });
    }

    return slots.map((slot) => {
      const hit = byKey.get(
        `${slot.memberId}:${slot.chapterId}:${slot.positionCode}`,
      );
      return {
        ...slot,
        signatureDataUrl: hit?.signatureDataUrl ?? null,
        updatedAt: hit?.updatedAt ?? null,
      };
    });
  });

/* ---------------------- Consumo em documentos oficiais ---------------------- */

export type OfficeSignatureSlot = {
  positionCode: string;
  positionLabel: string;
  memberId: string | null;
  memberName: string;
  demolayId: string | null;
  signatureDataUrl: string | null;
};

type SupabaseLike = { from: (t: string) => any; rpc?: (...args: any[]) => any };

/** Roles de sistema que autorizam o mesmo papel de assinatura. */
const OFFICE_ROLE_ALIASES: Record<string, string[]> = {
  mestre_conselheiro: ["mestre_conselheiro"],
  escrivao: ["escrivao"],
  tesoureiro: ["tesoureiro"],
  presidente_conselho_consultivo: ["presidente_conselho"],
  conselheiro_consultor: ["consultor"],
};

/**
 * Verifica se o usuário ocupa o cargo (ritualístico ou role de sistema)
 * no capítulo informado. admin_total sempre passa.
 */
export async function userHoldsOfficeInChapter(
  supabase: SupabaseLike,
  opts: {
    userId: string;
    chapterId: string;
    positionCode: string;
    email?: string | null;
    year?: number;
    semester?: 1 | 2;
  },
): Promise<boolean> {
  const canonical = canonicalOfficeSignatureCode(opts.positionCode);
  const term = currentTerm();
  const year = opts.year ?? term.year;
  const semester = opts.semester ?? (term.semester as 1 | 2);

  const { data: memberships, error: mErr } = await supabase
    .from("chapter_members")
    .select("role:roles(name)")
    .eq("chapter_id", opts.chapterId)
    .eq("user_id", opts.userId)
    .eq("active", true);
  if (mErr) throw new Error(mErr.message);

  const roleNames = (memberships ?? []).map((m: { role?: { name?: string } | { name?: string }[] | null }) => {
    const r = Array.isArray(m.role) ? m.role[0] : m.role;
    return r?.name as string | undefined;
  }).filter(Boolean) as string[];

  if (roleNames.includes("admin_total")) return true;

  const aliases = OFFICE_ROLE_ALIASES[canonical] ?? [canonical];
  if (roleNames.some((n) => aliases.includes(n) || n === opts.positionCode)) {
    return true;
  }

  const { resolveLinkedMemberIdsForChapter } = await import(
    "@/lib/resolve-linked-members"
  );
  const memberIds = await resolveLinkedMemberIdsForChapter(supabase, {
    userId: opts.userId,
    chapterId: opts.chapterId,
    email: opts.email,
  });
  if (memberIds.length === 0) return false;

  const { data: posRows, error: posErr } = await supabase
    .from("member_positions")
    .select("position:positions(code)")
    .eq("chapter_id", opts.chapterId)
    .in("member_id", memberIds)
    .eq("term_year", year)
    .eq("term_semester", semester)
    .is("ended_at", null);
  if (posErr) throw new Error(posErr.message);

  return (posRows ?? []).some((r: { position?: unknown }) => {
    const p = Array.isArray(r.position) ? r.position[0] : r.position;
    const code = (p as { code?: string } | null)?.code;
    return code && canonicalOfficeSignatureCode(code) === canonical;
  });
}

export async function assertCanSignAsOffice(
  supabase: SupabaseLike,
  opts: {
    userId: string;
    chapterId: string;
    positionCode: string;
    email?: string | null;
  },
): Promise<void> {
  const ok = await userHoldsOfficeInChapter(supabase, opts);
  if (!ok) {
    const label =
      OFFICE_SIGNATURE_LABELS[canonicalOfficeSignatureCode(opts.positionCode)] ??
      opts.positionCode;
    throw new Error(
      `Você não ocupa o cargo de ${label} neste capítulo para assinar.`,
    );
  }
}

/**
 * Titulares + tinta oficial dos cargos no capítulo/termo.
 * Nunca mistura assinatura de outro capítulo.
 */
export async function getOfficeSignaturesForChapter(
  supabase: SupabaseLike,
  opts: {
    chapterId: string;
    positionCodes: string[];
    year?: number;
    semester?: 1 | 2;
  },
): Promise<OfficeSignatureSlot[]> {
  const term = currentTerm();
  const year = opts.year ?? term.year;
  const semester = opts.semester ?? (term.semester as 1 | 2);
  const codes = [
    ...new Set(opts.positionCodes.map((c) => canonicalOfficeSignatureCode(c))),
  ];

  const { data: rows, error } = await supabase
    .from("member_positions")
    .select(
      "member_id, position:positions(code, label), member:members(id, full_name, demolay_id)",
    )
    .eq("chapter_id", opts.chapterId)
    .eq("term_year", year)
    .eq("term_semester", semester)
    .is("ended_at", null);
  if (error) throw new Error(error.message);

  type PosRow = {
    member_id: string;
    position?:
      | { code?: string; label?: string }
      | { code?: string; label?: string }[]
      | null;
    member?:
      | { id?: string; full_name?: string | null; demolay_id?: string | null }
      | { id?: string; full_name?: string | null; demolay_id?: string | null }[]
      | null;
  };

  const holderByCode = new Map<
    string,
    {
      memberId: string;
      memberName: string;
      demolayId: string | null;
      label: string;
    }
  >();

  for (const r of (rows ?? []) as PosRow[]) {
    const pos = Array.isArray(r.position) ? r.position[0] : r.position;
    const code = pos?.code ? canonicalOfficeSignatureCode(pos.code) : null;
    if (!code || !codes.includes(code) || holderByCode.has(code)) continue;
    const mem = Array.isArray(r.member) ? r.member[0] : r.member;
    holderByCode.set(code, {
      memberId: r.member_id,
      memberName: mem?.full_name?.trim() || "",
      demolayId: mem?.demolay_id?.trim() || null,
      label: OFFICE_SIGNATURE_LABELS[code] || pos?.label || code,
    });
  }

  const memberIds = [...new Set([...holderByCode.values()].map((h) => h.memberId))];
  const sigByKey = new Map<string, string>();

  if (memberIds.length > 0) {
    const { data: sigs, error: sigErr } = await supabase
      .from("member_office_signatures")
      .select("member_id, chapter_id, position_code, signature_data_url")
      .eq("chapter_id", opts.chapterId)
      .in("member_id", memberIds)
      .in("position_code", codes);
    if (sigErr) throw new Error(sigErr.message);

    for (const s of sigs ?? []) {
      const url = (s as { signature_data_url?: string }).signature_data_url?.trim();
      if (!url) continue;
      const code = canonicalOfficeSignatureCode(
        (s as { position_code: string }).position_code,
      );
      const mid = (s as { member_id: string }).member_id;
      sigByKey.set(`${mid}:${code}`, url);
    }
  }

  return codes.map((code) => {
    const holder = holderByCode.get(code);
    const signatureDataUrl = holder
      ? sigByKey.get(`${holder.memberId}:${code}`) ?? null
      : null;
    return {
      positionCode: code,
      positionLabel: holder?.label ?? OFFICE_SIGNATURE_LABELS[code] ?? code,
      memberId: holder?.memberId ?? null,
      memberName: holder?.memberName ?? "",
      demolayId: holder?.demolayId ?? null,
      signatureDataUrl,
    };
  });
}

/** Server fn: carrega assinaturas oficiais do capítulo para PDFs/UI. */
export const listChapterOfficeSignatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        positionCodes: z.array(z.string().min(1)).min(1).max(20),
        year: z.number().int().optional(),
        semester: z.union([z.literal(1), z.literal(2)]).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    return getOfficeSignaturesForChapter(context.supabase, {
      chapterId: data.chapterId,
      positionCodes: data.positionCodes,
      year: data.year,
      semester: data.semester,
    });
  });

/** Pode o usuário assinar como o cargo informado neste capítulo? */
export const canSignAsOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        positionCode: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const ok = await userHoldsOfficeInChapter(context.supabase, {
      userId: context.userId,
      chapterId: data.chapterId,
      positionCode: data.positionCode,
      email,
    });
    return { canSign: ok };
  });
