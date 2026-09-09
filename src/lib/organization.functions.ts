import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  commissionModuleByKey,
  isFixedDemolayCommissionCode,
} from "@/lib/fixed-commissions";
import { normalizeOrgType } from "@/lib/org-types";
import {
  ADVISORY_COUNCIL_POSITION_CODES,
  hasOrgLeaderPosition,
} from "@/lib/permissions";

const termInput = z.object({
  chapterId: z.string().uuid(),
  year: z.number().int().min(1900).max(2200),
  semester: z.union([z.literal(1), z.literal(2)]),
});

const chapterInput = z.object({ chapterId: z.string().uuid() });

function slugCommissionCode(label: string): string {
  let base = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!base) return "comissao";
  if (!/^[a-z]/.test(base)) base = `c_${base}`.slice(0, 40);
  return base;
}

type OrgSupabase = SupabaseClient<Database>;

async function assertCanLinkCommissionModule(
  supabase: OrgSupabase,
  userId: string,
  chapterId: string,
): Promise<void> {
  const { data: memberships, error } = await supabase
    .from("chapter_members")
    .select("role:roles(name)")
    .eq("chapter_id", chapterId)
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error(error.message);

  const roleNames = (memberships ?? []).map((m) => {
    const r = m.role as { name?: string } | { name?: string }[] | null;
    const row = Array.isArray(r) ? r[0] : r;
    return row?.name ?? "";
  });
  if (
    roleNames.includes("admin_total") ||
    roleNames.includes("mestre_conselheiro")
  ) {
    return;
  }

  const { currentTerm } = await import("@/lib/terms");
  const term = currentTerm();
  const { resolveLinkedMemberIdsForChapter } = await import(
    "@/lib/resolve-linked-members"
  );
  const memberIds = await resolveLinkedMemberIdsForChapter(supabase, {
    userId,
    chapterId,
  });
  if (memberIds.length === 0) {
    throw new Error(
      "Apenas Administrador Total ou Mestre Conselheiro pode vincular comissão a módulo",
    );
  }

  const { data: positions, error: posErr } = await supabase
    .from("member_positions")
    .select("position:positions(code)")
    .eq("chapter_id", chapterId)
    .eq("term_year", term.year)
    .eq("term_semester", term.semester)
    .in("member_id", memberIds);
  if (posErr) throw new Error(posErr.message);

  const codes = (positions ?? []).map((p) => {
    const pos = p.position as { code?: string } | { code?: string }[] | null;
    const row = Array.isArray(pos) ? pos[0] : pos;
    return row?.code ?? "";
  });
  if (hasOrgLeaderPosition(codes)) return;

  throw new Error(
    "Apenas Administrador Total ou Mestre Conselheiro pode vincular comissão a módulo",
  );
}

async function uniqueCommissionCode(
  supabase: OrgSupabase,
  chapterId: string,
  desired: string,
  excludeId?: number,
): Promise<string> {
  let code = desired;
  for (let i = 0; i < 50; i++) {
    let q = supabase
      .from("commissions")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("code", code)
      .limit(1);
    if (excludeId != null) q = q.neq("id", excludeId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data?.length) return code;
    code = `${desired.slice(0, 36)}_${i + 2}`;
  }
  throw new Error("Não foi possível gerar um código único para a comissão");
}

export const COMMISSION_ROLE_ORDER: Record<string, number> = {
  presidente: 0,
  vice: 1,
  conselho: 2,
  membro: 3,
  auxiliar_senior: 4,
};

export function compareCommissionMembersByRoleName(
  a: { role: string; member?: { full_name?: string } | null },
  b: { role: string; member?: { full_name?: string } | null },
): number {
  const byRole =
    (COMMISSION_ROLE_ORDER[a.role] ?? 99) -
    (COMMISSION_ROLE_ORDER[b.role] ?? 99);
  if (byRole !== 0) return byRole;
  const nameA = a.member?.full_name ?? "";
  const nameB = b.member?.full_name ?? "";
  return nameA.localeCompare(nameB, "pt-BR");
}

export const listCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: chapter, error: chErr } = await context.supabase
      .from("chapters")
      .select("id, org_type")
      .eq("id", data.chapterId)
      .single();
    if (chErr) throw new Error(chErr.message);
    const orgType = (chapter?.org_type as string | null) ?? "capitulo";

    const [pos, scopes, com] = await Promise.all([
      context.supabase
        .from("positions")
        .select("id, code, label, scope, sort_order")
        .order("sort_order"),
      context.supabase
        .from("position_org_types")
        .select("position_id, org_type, role_group, sort_order")
        .eq("org_type", orgType)
        .order("sort_order"),
      context.supabase
        .from("commissions")
        .select("id, code, label, sort_order, chapter_id, module_key")
        .eq("chapter_id", data.chapterId)
        .order("sort_order"),
    ]);
    if (pos.error) throw new Error(pos.error.message);
    if (scopes.error) throw new Error(scopes.error.message);
    if (com.error) throw new Error(com.error.message);

    const byId = new Map((pos.data ?? []).map((p) => [p.id, p]));
    const scoped = (scopes.data ?? [])
      .map((s) => {
        const p = byId.get(s.position_id);
        if (!p || p.scope === "regional") return null;
        return {
          id: p.id,
          code: p.code,
          label: p.label,
          scope: p.scope,
          sort_order: s.sort_order,
          role_group: s.role_group as
            | "ritualisticos"
            | "conselho"
            | "comissoes"
            | null,
        };
      })
      .filter(Boolean) as Array<{
      id: number;
      code: string;
      label: string;
      scope: string;
      sort_order: number;
      role_group: "ritualisticos" | "conselho" | "comissoes" | null;
    }>;

    // Fallback legado: se ainda não houver vínculo para o tipo, mostra catálogo clássico
    const positions =
      scoped.length > 0
        ? scoped
        : (pos.data ?? [])
            .filter((p) => p.scope !== "regional")
            .map((p) => ({
              ...p,
              role_group:
                p.scope === "consultivo"
                  ? ("conselho" as const)
                  : p.scope === "comissao"
                    ? ("comissoes" as const)
                    : ("ritualisticos" as const),
            }));

    return {
      positions,
      commissions: (com.data ?? []).map((c) => {
        const moduleKey =
          (c as { module_key?: string | null }).module_key ??
          (isFixedDemolayCommissionCode(c.code) ? c.code : null);
        const mod = commissionModuleByKey(moduleKey);
        return {
          id: c.id,
          code: c.code,
          label: c.label,
          sort_order: c.sort_order,
          is_fixed:
            normalizeOrgType(orgType) === "capitulo" &&
            isFixedDemolayCommissionCode(c.code),
          module_key: moduleKey,
          module_label: mod?.label ?? null,
          module_path: mod?.path ?? null,
        };
      }),
    };
  });

export const createChapterCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        label: z.string().trim().min(2).max(80),
        code: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[a-z][a-z0-9_]*$/, "Código inválido")
          .optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
        moduleKey: z
          .union([
            z.enum([
              "hospitalaria",
              "entretenimento",
              "auditoria",
              "financas",
              "sindicancias",
              "eventos",
            ]),
            z.null(),
          ])
          .optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const desired = data.code ?? slugCommissionCode(data.label);
    if (isFixedDemolayCommissionCode(desired)) {
      const { data: chapter } = await context.supabase
        .from("chapters")
        .select("org_type")
        .eq("id", data.chapterId)
        .maybeSingle();
      if (normalizeOrgType(chapter?.org_type) === "capitulo") {
        throw new Error(
          "Este código é reservado a uma comissão obrigatória do Capítulo DeMolay",
        );
      }
    }

    let moduleKey: string | null = null;
    if (data.moduleKey !== undefined) {
      await assertCanLinkCommissionModule(
        context.supabase,
        context.userId,
        data.chapterId,
      );
      moduleKey = data.moduleKey;
    }

    const code = await uniqueCommissionCode(
      context.supabase,
      data.chapterId,
      desired,
    );

    let sortOrder = data.sortOrder;
    if (sortOrder == null) {
      const { data: maxRow, error: maxErr } = await context.supabase
        .from("commissions")
        .select("sort_order")
        .eq("chapter_id", data.chapterId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw new Error(maxErr.message);
      sortOrder = (maxRow?.sort_order ?? 0) + 1;
    }

    const insertPayload = {
      chapter_id: data.chapterId,
      code,
      label: data.label,
      sort_order: sortOrder,
      module_key: moduleKey,
    };

    let { data: row, error } = await context.supabase
      .from("commissions")
      .insert(insertPayload as never)
      .select("id, code, label, sort_order, module_key")
      .single();

    if (
      error?.code === "23505" &&
      error.message?.includes("commissions_chapter_code_uidx")
    ) {
      const retryCode = await uniqueCommissionCode(
        context.supabase,
        data.chapterId,
        desired,
      );
      const retry = await context.supabase
        .from("commissions")
        .insert({ ...insertPayload, code: retryCode } as never)
        .select("id, code, label, sort_order, module_key")
        .single();
      row = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return row;
  });

export const updateChapterCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        id: z.number().int().positive(),
        label: z.string().trim().min(2).max(80).optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
        moduleKey: z
          .union([
            z.enum([
              "hospitalaria",
              "entretenimento",
              "auditoria",
              "financas",
              "sindicancias",
              "eventos",
            ]),
            z.null(),
          ])
          .optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: findErr } = await context.supabase
      .from("commissions")
      .select("id, code, chapter_id, module_key")
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw new Error("Comissão não encontrada neste capítulo");

    const { data: chapter } = await context.supabase
      .from("chapters")
      .select("org_type")
      .eq("id", data.chapterId)
      .maybeSingle();
    const isCapitulo = normalizeOrgType(chapter?.org_type) === "capitulo";
    const isFixed =
      isCapitulo && isFixedDemolayCommissionCode(existing.code);

    if (isFixed && data.label != null) {
      throw new Error(
        "Comissão obrigatória do Capítulo DeMolay não pode ser renomeada",
      );
    }

    if (data.moduleKey !== undefined) {
      if (isFixed) {
        throw new Error(
          "O módulo de comissão obrigatória não pode ser alterado",
        );
      }
      await assertCanLinkCommissionModule(
        context.supabase,
        context.userId,
        data.chapterId,
      );
    }

    const patch: Record<string, unknown> = {};
    if (!isFixed && data.label != null) patch.label = data.label;
    if (data.sortOrder != null) patch.sort_order = data.sortOrder;
    if (data.moduleKey !== undefined) patch.module_key = data.moduleKey;

    if (Object.keys(patch).length === 0) {
      return {
        id: existing.id,
        code: existing.code,
        label: (existing as { label?: string }).label ?? "",
        sort_order: 0,
        module_key:
          (existing as { module_key?: string | null }).module_key ?? null,
      };
    }

    const { data: row, error } = await context.supabase
      .from("commissions")
      .update(patch as never)
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId)
      .select("id, code, label, sort_order, module_key")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteChapterCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ id: z.number().int().positive() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: findErr } = await context.supabase
      .from("commissions")
      .select("id, code, chapter_id")
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw new Error("Comissão não encontrada neste capítulo");

    const { data: chapter } = await context.supabase
      .from("chapters")
      .select("org_type")
      .eq("id", data.chapterId)
      .maybeSingle();
    if (
      normalizeOrgType(chapter?.org_type) === "capitulo" &&
      isFixedDemolayCommissionCode(existing.code)
    ) {
      throw new Error(
        "Comissão obrigatória do Capítulo DeMolay não pode ser excluída",
      );
    }

    const { error } = await context.supabase
      .from("commissions")
      .delete()
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listChapterPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => termInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("member_positions")
      .select(
        "id, position_id, member_id, term_year, term_semester, position:positions(id, code, label, scope, sort_order), member:members(id, full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const assignPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    termInput
      .extend({ memberId: z.string().uuid(), positionId: z.number().int() })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const REGIONAL_POSITION_IDS = [26, 27];
    if (REGIONAL_POSITION_IDS.includes(data.positionId)) {
      throw new Error(
        "Cargos regionais (MCR/OE) só podem ser atribuídos pela transferência oficial.",
      );
    }
    const MULTI_SEAT_POSITIONS = [25]; // Conselheiro Consultor: vários titulares por vigência
    if (!MULTI_SEAT_POSITIONS.includes(data.positionId)) {
      // cargo de titular único: libera a vaga da vigência antes de atribuir
      const { error: delErr } = await context.supabase
        .from("member_positions")
        .delete()
        .eq("chapter_id", data.chapterId)
        .eq("position_id", data.positionId)
        .eq("term_year", data.year)
        .eq("term_semester", data.semester);
      if (delErr) throw new Error(delErr.message);
    }
    const { error } = await context.supabase.from("member_positions").upsert(
      {
        chapter_id: data.chapterId,
        member_id: data.memberId,
        position_id: data.positionId,
        term_year: data.year,
        term_semester: data.semester,
      },
      {
        onConflict: "chapter_id,position_id,member_id,term_year,term_semester",
      },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid(), chapterId: z.string().uuid() })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: loadErr } = await context.supabase
      .from("member_positions")
      .select("id, chapter_id")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!row) throw new Error("Cargo não encontrado");
    if (row.chapter_id !== data.chapterId) {
      throw new Error(
        "Só o capítulo que registrou o cargo pode removê-lo",
      );
    }
    const { error } = await context.supabase
      .from("member_positions")
      .delete()
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type CommissionMemberRow = {
  id: string;
  commission_id: number;
  member_id: string;
  role: string;
  term_year: number;
  term_semester: number;
  /** Vínculo virtual do Conselho Consultivo (não removível). */
  virtual?: boolean;
  commission: {
    id: number;
    code: string;
    label: string;
    sort_order: number;
  } | null;
  member: { id: string; full_name: string } | null;
};

export const listCommissionMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => termInput.parse(raw))
  .handler(async ({ data, context }): Promise<CommissionMemberRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("commission_members")
      .select(
        "id, commission_id, member_id, role, term_year, term_semester, commission:commissions(id, code, label, sort_order), member:members(id, full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester);
    if (error) throw new Error(error.message);

    const explicit = (rows ?? []).map((r) => ({
      ...r,
      virtual: false as boolean,
      commission: (Array.isArray(r.commission)
        ? r.commission[0]
        : r.commission) as CommissionMemberRow["commission"],
      member: (Array.isArray(r.member)
        ? r.member[0]
        : r.member) as CommissionMemberRow["member"],
    }));

    const { data: chapter } = await context.supabase
      .from("chapters")
      .select("org_type")
      .eq("id", data.chapterId)
      .maybeSingle();

    if ((chapter?.org_type as string | null) !== "capitulo") {
      return [...explicit].sort(compareCommissionMembersByRoleName);
    }

    const { data: commissions, error: comErr } = await context.supabase
      .from("commissions")
      .select("id, code, label, sort_order")
      .eq("chapter_id", data.chapterId);
    if (comErr) throw new Error(comErr.message);

    const { data: councilPositions, error: posErr } = await context.supabase
      .from("member_positions")
      .select(
        "member_id, position:positions(code), member:members(id, full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester);
    if (posErr) throw new Error(posErr.message);

    const councilMembers = new Map<
      string,
      { id: string; full_name: string }
    >();
    for (const row of councilPositions ?? []) {
      const pos = row.position as
        | { code?: string }
        | { code?: string }[]
        | null;
      const posRow = Array.isArray(pos) ? pos[0] : pos;
      const code = posRow?.code ?? "";
      if (
        !(ADVISORY_COUNCIL_POSITION_CODES as readonly string[]).includes(code)
      ) {
        continue;
      }
      const mem = row.member as
        | { id?: string; full_name?: string }
        | { id?: string; full_name?: string }[]
        | null;
      const memRow = Array.isArray(mem) ? mem[0] : mem;
      if (!memRow?.id) continue;
      councilMembers.set(memRow.id, {
        id: memRow.id,
        full_name: memRow.full_name ?? "",
      });
    }

    const present = new Set(
      explicit.map((r) => `${r.commission_id}:${r.member_id}`),
    );

    const virtual: CommissionMemberRow[] = [];
    for (const c of commissions ?? []) {
      for (const member of councilMembers.values()) {
        const key = `${c.id}:${member.id}`;
        if (present.has(key)) continue;
        virtual.push({
          id: `virtual-conselho-${c.id}-${member.id}`,
          commission_id: c.id,
          member_id: member.id,
          role: "conselho",
          term_year: data.year,
          term_semester: data.semester,
          virtual: true,
          commission: {
            id: c.id,
            code: c.code,
            label: c.label,
            sort_order: c.sort_order,
          },
          member: { id: member.id, full_name: member.full_name },
        });
      }
    }

    return [...explicit, ...virtual].sort(compareCommissionMembersByRoleName);
  });

export const assignCommissionMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    termInput
      .extend({
        memberId: z.string().uuid(),
        commissionId: z.number().int(),
        role: z.enum(["presidente", "vice", "membro", "auxiliar_senior"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: commission, error: comErr } = await context.supabase
      .from("commissions")
      .select("id")
      .eq("id", data.commissionId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (comErr) throw new Error(comErr.message);
    if (!commission) throw new Error("Comissão inválida para este capítulo");

    const { error } = await context.supabase.from("commission_members").upsert(
      {
        chapter_id: data.chapterId,
        commission_id: data.commissionId,
        member_id: data.memberId,
        role: data.role,
        term_year: data.year,
        term_semester: data.semester,
      },
      {
        onConflict:
          "chapter_id,commission_id,member_id,term_year,term_semester",
      },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCommissionMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid(), chapterId: z.string().uuid() })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.id.startsWith("virtual-")) {
      throw new Error(
        "Participação do Conselho Consultivo é automática e não pode ser removida",
      );
    }
    const { data: row, error: loadErr } = await context.supabase
      .from("commission_members")
      .select("id, chapter_id")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!row) throw new Error("Vínculo de comissão não encontrado");
    if (row.chapter_id !== data.chapterId) {
      throw new Error(
        "Só o capítulo que registrou a comissão pode removê-la",
      );
    }
    const { error } = await context.supabase
      .from("commission_members")
      .delete()
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Histórico completo de cargos e comissões de um membro. */
export const getMemberOrgHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const [pos, com] = await Promise.all([
      context.supabase
        .from("member_positions")
        .select(
          "id, chapter_id, term_year, term_semester, ended_at, region_id, position:positions(id, code, label, scope), chapter:chapters(id, name, number)",
        )
        .eq("member_id", data.memberId)
        .order("term_year", { ascending: false })
        .order("term_semester", { ascending: false }),
      context.supabase
        .from("commission_members")
        .select(
          "id, chapter_id, role, term_year, term_semester, commission:commissions(id, label), chapter:chapters(id, name, number)",
        )
        .eq("member_id", data.memberId)
        .order("term_year", { ascending: false })
        .order("term_semester", { ascending: false }),
    ]);
    if (pos.error) throw new Error(pos.error.message);
    if (com.error) throw new Error(com.error.message);
    return { positions: pos.data ?? [], commissions: com.data ?? [] };
  });
