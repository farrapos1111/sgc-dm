import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayYmd } from "@/lib/timezone";
import { currentTerm } from "@/lib/terms";
import { normalizeDemolayId } from "@/lib/member-identity";
import { matchesLooseSearch } from "@/lib/utils";

const orgRoleEnum = z.enum(["gme", "mce", "mcr", "oe"]);

/** Cargos capitulares destacados na lista regional (semestre vigente). */
const SCOPE_OFFICER_CODES = [
  "mestre_conselheiro",
  "escrivao",
  "tesoureiro",
  "hospitaleiro",
  "presidente_conselho_consultivo",
] as const;

const SCOPE_OFFICER_LABELS: Record<(typeof SCOPE_OFFICER_CODES)[number], string> =
  {
    mestre_conselheiro: "Mestre Conselheiro",
    escrivao: "Escrivão",
    tesoureiro: "Tesoureiro",
    hospitaleiro: "Hospitaleiro",
    presidente_conselho_consultivo: "Presidente do Conselho",
  };

type ScopePositionRow = {
  member_id: string;
  position:
    | { code?: string; label?: string; sort_order?: number }
    | { code?: string; label?: string; sort_order?: number }[]
    | null;
};

export type OrgRoleName = z.infer<typeof orgRoleEnum>;

export type OrgLeadership = {
  id: string;
  org_role: OrgRoleName;
  state_id: string | null;
  region_id: string | null;
  state_name: string | null;
  region_name: string | null;
  chapter_ids: string[];
  starts_on?: string | null;
  ends_on?: string | null;
  region_primary_color?: string | null;
  region_logo_url?: string | null;
};

export type OrgContext = {
  leaderships: OrgLeadership[];
};

async function assertCanManageOrg(
  supabase: {
    rpc: (
      fn: never,
      args?: never,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    from: (t: string) => any;
  },
) {
  const { data: ok, error: rpcErr } = await supabase.rpc(
    "is_gme" as never,
    { _state_id: null } as never,
  );
  if (rpcErr) throw new Error(rpcErr.message);
  if (!ok) throw new Error("Sem permissão para gestão organizacional");
}

async function assertCanManageRegionChapters(
  supabase: {
    rpc: (
      fn: never,
      args?: never,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  chapterId: string,
) {
  const { data: ok, error: rpcErr } = await supabase.rpc(
    "can_manage_region_chapter" as never,
    { _chapter_id: chapterId } as never,
  );
  if (rpcErr) throw new Error(rpcErr.message);
  if (!ok) throw new Error("Sem permissão para gerenciar instituições nesta região");
}

async function assertCanWriteChapterScope(
  supabase: {
    rpc: (
      fn: never,
      args?: never,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  stateId: string,
  regionId: string | null,
) {
  const { data: ok, error: rpcErr } = await supabase.rpc(
    "can_write_chapter_in_scope" as never,
    { _state_id: stateId, _region_id: regionId } as never,
  );
  if (rpcErr) throw new Error(rpcErr.message);
  if (!ok) throw new Error("Sem permissão para salvar instituição neste escopo");
}

/**
 * Lideranças supra-capitulares do usuário logado, já com os capítulos
 * que cada escopo abrange.
 */
export const getMyOrgContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgContext> => {
    const { data: leaderships, error } = await context.supabase
      .from("org_leaderships")
      .select(
        "id, org_role, state_id, region_id, term_year, term_semester, starts_on, ends_on",
      )
      .eq("user_id", context.userId)
      .eq("active", true);
    if (error) throw new Error(error.message);

    const today = todayYmd();
    const activeLeaderships = (leaderships ?? []).filter((l) => {
      const starts = (l as { starts_on?: string | null }).starts_on;
      const ends = (l as { ends_on?: string | null }).ends_on;
      if (starts && starts > today) return false;
      if (ends && ends < today) return false;
      return true;
    });

    const [statesRes, regionsRes, chaptersRes] = await Promise.all([
      context.supabase.from("states").select("id, name, uf").order("name"),
      context.supabase
        .from("regions")
        .select("id, name, code, state_id, primary_color, logo_url"),
      context.supabase.from("chapters").select("id, state_id, region_id, active"),
    ]);
    if (statesRes.error) throw new Error(statesRes.error.message);
    if (regionsRes.error) throw new Error(regionsRes.error.message);
    if (chaptersRes.error) throw new Error(chaptersRes.error.message);

    const states = statesRes.data ?? [];
    const regions = regionsRes.data ?? [];
    const chapters = chaptersRes.data ?? [];

    const mapped: OrgLeadership[] = activeLeaderships.map((l) => {
      const region = regions.find((r) => r.id === l.region_id) ?? null;
      const stateId = l.state_id ?? region?.state_id ?? null;
      const state = states.find((s) => s.id === stateId) ?? null;
      const scopeChapters = l.region_id
        ? chapters.filter((c) => c.region_id === l.region_id)
        : chapters.filter((c) => c.state_id === l.state_id);
      return {
        id: l.id,
        org_role: l.org_role as OrgRoleName,
        state_id: stateId,
        region_id: l.region_id,
        state_name: state ? `${state.name} (${state.uf})` : null,
        region_name: region?.name ?? null,
        chapter_ids: scopeChapters.map((c) => c.id),
        starts_on: (l as { starts_on?: string | null }).starts_on ?? null,
        ends_on: (l as { ends_on?: string | null }).ends_on ?? null,
        region_primary_color:
          (region as { primary_color?: string } | null)?.primary_color ?? null,
        region_logo_url:
          (region as { logo_url?: string | null } | null)?.logo_url ?? null,
      };
    });

    return { leaderships: mapped };
  });

const scopeInput = z.object({
  scopeType: z.enum(["region", "state"]),
  scopeId: z.string().uuid(),
});

/** Panorama das instituições de uma região ou estado. */
export const listScopeChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => scopeInput.parse(raw))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("chapters")
      .select(
        "id, name, number, city, primary_color, logo_url, active, region_id, state_id",
      )
      .order("number", { ascending: true });
    q =
      data.scopeType === "region"
        ? q.eq("region_id", data.scopeId)
        : q.eq("state_id", data.scopeId);
    const { data: chapters, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (chapters ?? []).map((c) => c.id);
    if (ids.length === 0) return [];

    const [membersRes, nextRes, regionsRes] = await Promise.all([
      context.supabase
        .from("members")
        .select("id, chapter_id, status, kind")
        .in("chapter_id", ids),
      context.supabase
        .from("calendar_events")
        .select("id, chapter_id, title, start_at, event_type")
        .in("chapter_id", ids)
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true }),
      context.supabase.from("regions").select("id, name"),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (nextRes.error) throw new Error(nextRes.error.message);

    const members = membersRes.data ?? [];
    const upcoming = nextRes.data ?? [];
    const regions = regionsRes.data ?? [];

    return (chapters ?? []).map((c) => ({
      ...c,
      region_name: regions.find((r) => r.id === c.region_id)?.name ?? null,
      active_members: members.filter(
        (m) =>
          m.chapter_id === c.id &&
          m.status === "regular" &&
          (m as { kind?: string }).kind === "demolay_ativo",
      ).length,
      total_members: members.filter((m) => m.chapter_id === c.id).length,
      next_item: upcoming.find((e) => e.chapter_id === c.id) ?? null,
    }));
  });

/** Busca de membros em várias instituições do escopo (somente leitura, PII mascarada). */
export const listScopeMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterIds: z.array(z.string().uuid()).min(1),
        search: z.string().optional().default(""),
        status: z
          .enum(["regular", "irregular", "all"])
          .optional()
          .default("all"),
        kind: z
          .enum(["demolay_ativo", "senior", "macom", "all"])
          .optional()
          .default("all"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const term = currentTerm();
    const search = data.search.trim();
    const memberSelect =
      "id, chapter_id, full_name, birth_date, status, kind, phone, email, cpf_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay";

    function applyMemberFilters<T extends { eq: Function; ilike?: Function }>(
      q: T,
    ): T {
      let next = q;
      if (data.status !== "all") next = next.eq("status", data.status) as T;
      if (data.kind !== "all") next = next.eq("kind", data.kind) as T;
      return next;
    }

    let posRows: ScopePositionRow[] = [];
    const positionMatchIds = new Set<string>();

    if (search) {
      const { data: allPos, error: posScanErr } = await context.supabase
        .from("member_positions")
        .select("member_id, position:positions(code, label, sort_order)")
        .in("chapter_id", data.chapterIds)
        .eq("term_year", term.year)
        .eq("term_semester", term.semester);
      if (posScanErr) throw new Error(posScanErr.message);
      posRows = (allPos ?? []) as ScopePositionRow[];

      for (const row of posRows) {
        const pos = Array.isArray(row.position) ? row.position[0] : row.position;
        const code = pos?.code ?? "";
        const label =
          SCOPE_OFFICER_LABELS[code as (typeof SCOPE_OFFICER_CODES)[number]] ??
          pos?.label ??
          "";
        if (
          matchesLooseSearch(label, search) ||
          matchesLooseSearch(code.replace(/_/g, " "), search) ||
          (pos?.label ? matchesLooseSearch(pos.label, search) : false)
        ) {
          positionMatchIds.add(row.member_id);
        }
      }
    }

    let nameRows: Record<string, unknown>[] = [];
    {
      let q = context.supabase
        .from("members")
        .select(memberSelect)
        .in("chapter_id", data.chapterIds)
        .order("full_name", { ascending: true })
        .limit(500);
      q = applyMemberFilters(q);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      nameRows = rows ?? [];
    }

    let positionRows: Record<string, unknown>[] = [];
    if (search && positionMatchIds.size > 0) {
      let q = context.supabase
        .from("members")
        .select(memberSelect)
        .in("chapter_id", data.chapterIds)
        .in("id", [...positionMatchIds])
        .order("full_name", { ascending: true })
        .limit(500);
      q = applyMemberFilters(q);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      positionRows = rows ?? [];
    }

    const byId = new Map<string, Record<string, unknown>>();
    for (const r of [...nameRows, ...positionRows]) {
      byId.set(r.id as string, r);
    }
    const rows = [...byId.values()].sort((a, b) =>
      String(a.full_name).localeCompare(String(b.full_name), "pt-BR", {
        sensitivity: "base",
      }),
    );
    if (!rows.length) return [];

    if (!search) {
      const memberIds = rows.map((r) => r.id as string);
      const { data: scopedPos, error: posErr } = await context.supabase
        .from("member_positions")
        .select("member_id, position:positions(code, label, sort_order)")
        .in("chapter_id", data.chapterIds)
        .in("member_id", memberIds)
        .eq("term_year", term.year)
        .eq("term_semester", term.semester);
      if (posErr) throw new Error(posErr.message);
      posRows = (scopedPos ?? []) as ScopePositionRow[];
    }

    const officerSet = new Set<string>(SCOPE_OFFICER_CODES);
    const byMember = new Map<
      string,
      { code: string; label: string; sort_order: number }[]
    >();
    for (const row of posRows) {
      const pos = Array.isArray(row.position) ? row.position[0] : row.position;
      const code = pos?.code as string | undefined;
      if (!code || !officerSet.has(code)) continue;
      const label =
        SCOPE_OFFICER_LABELS[code as (typeof SCOPE_OFFICER_CODES)[number]] ??
        pos?.label ??
        code;
      const list = byMember.get(row.member_id) ?? [];
      list.push({
        code,
        label,
        sort_order: pos?.sort_order ?? 99,
      });
      byMember.set(row.member_id, list);
    }

    return rows.map((r) => {
      const id = r.id as string;
      const positions = (byMember.get(id) ?? []).sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      return {
        ...r,
        current_positions: positions.map(({ code, label }) => ({
          code,
          label,
        })),
      };
    });
  });

/** Lista estados visíveis ao usuário (via RLS / liderança). */
export const listStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("states")
      .select("id, name, uf, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        uf: z
          .string()
          .trim()
          .length(2)
          .transform((s) => s.toUpperCase()),
      })
      .parse(raw),
  )
  .handler(async () => {
    throw new Error(
      "Cadastro de estados não está disponível no aplicativo. Use o painel operacional.",
    );
  });

export const deleteState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async () => {
    throw new Error(
      "Exclusão de estados não está disponível no aplicativo. Use o painel operacional.",
    );
  });

/** Regiões de um estado (para gestão do GME). */
export const listRegions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ stateId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("regions")
      .select("id, name, code, state_id, primary_color, logo_url")
      .eq("state_id", data.stateId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getRegionVisual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ regionId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("regions")
      .select("id, name, code, primary_color, logo_url, settings")
      .eq("id", data.regionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Região não encontrada");
    return row;
  });

export const updateRegionVisual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        regionId: z.string().uuid(),
        primary_color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        logo_url: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: region, error: regionErr } = await context.supabase
      .from("regions")
      .select("id, state_id")
      .eq("id", data.regionId)
      .maybeSingle();
    if (regionErr) throw new Error(regionErr.message);
    if (!region) throw new Error("Região não encontrada");

    const { data: ok, error: rpcErr } = await context.supabase.rpc(
      "is_active_region_office" as never,
      {
        _region_id: data.regionId,
        _roles: ["mcr", "oe"],
      } as never,
    );
    if (rpcErr) throw new Error(rpcErr.message);

    const { data: gmeOk, error: gmeErr } = await context.supabase.rpc(
      "is_gme" as never,
      { _state_id: region.state_id } as never,
    );
    if (gmeErr) throw new Error(gmeErr.message);

    if (!ok && !gmeOk) {
      throw new Error("Sem permissão para alterar a aparência desta região");
    }

    const patch: Record<string, unknown> = {};
    if (data.primary_color !== undefined)
      patch.primary_color = data.primary_color;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("regions")
      .update(patch)
      .eq("id", data.regionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        state_id: z.string().uuid(),
        name: z.string().min(1),
        code: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("regions")
        .update({ name: data.name, code: data.code ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("regions")
      .insert({
        state_id: data.state_id,
        name: data.name,
        code: data.code ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("regions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        state_id: z.string().uuid(),
        region_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        number: z.string().min(1),
        city: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertCanWriteChapterScope(
      context.supabase,
      data.state_id,
      data.region_id ?? null,
    );
    const payload = {
      state_id: data.state_id,
      region_id: data.region_id ?? null,
      name: data.name,
      number: data.number,
      city: data.city ?? null,
      ...(data.active === undefined ? {} : { active: data.active }),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("chapters")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("chapters")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setChapterActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageRegionChapters(context.supabase, data.id);
    const { error } = await context.supabase
      .from("chapters")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Alterna regular/irregular de membro no escopo regional (GME/MCR/OE). */
export const setScopeMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        status: z.enum(["regular", "irregular"]),
        effectiveOn: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: fetchErr } = await context.supabase
      .from("members")
      .select(
        "id, chapter_id, full_name, birth_date, phone, email, address, status, kind, demolay_id, masonic_id, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, initiation_chapter_id",
      )
      .eq("id", data.memberId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    await assertCanManageRegionChapters(context.supabase, member.chapter_id);

    const prevStatus = member.status as "regular" | "irregular";
    const nextStatus = data.status;
    if (prevStatus === nextStatus) return { ok: true };

    const effectiveOn =
      data.effectiveOn || new Date().toISOString().slice(0, 10);

    const { error } = await context.supabase.rpc(
      "update_member_with_pii" as never,
      {
        _member_id: member.id,
        _full_name: member.full_name,
        _birth_date: member.birth_date,
        _cpf: "",
        _rg: "",
        _phone: member.phone ?? "",
        _email: member.email ?? "",
        _address: member.address ?? {},
        _status: nextStatus,
        _kind: member.kind,
        _exam_grau_iniciatico: member.exam_grau_iniciatico,
        _exam_grau_demolay: member.exam_grau_demolay,
        _guardians: null,
        _iniciacao_ordem: member.iniciacao_ordem,
        _iniciacao_grau_demolay: member.iniciacao_grau_demolay,
        _demolay_id: member.demolay_id,
        _masonic_id: member.masonic_id,
        _initiation_chapter_id: member.initiation_chapter_id,
      } as never,
    );
    if (error) throw new Error(error.message);

    if (prevStatus === "regular" && nextStatus === "irregular") {
      const { error: awayErr } = await context.supabase
        .from("member_away_periods")
        .insert({
          member_id: member.id,
          chapter_id: member.chapter_id,
          started_on: effectiveOn,
          ended_on: null,
          created_by: context.userId,
        });
      if (awayErr) throw new Error(awayErr.message);
      await context.supabase.rpc("desligar_open_dues_from" as never, {
        _member_id: member.id,
        _from: effectiveOn,
      } as never);
    } else if (prevStatus === "irregular" && nextStatus === "regular") {
      const { data: openPeriod } = await context.supabase
        .from("member_away_periods")
        .select("id")
        .eq("member_id", member.id)
        .is("ended_on", null)
        .order("started_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openPeriod) {
        await context.supabase
          .from("member_away_periods")
          .update({ ended_on: effectiveOn })
          .eq("id", openPeriod.id);
      }
    }

    return { ok: true };
  });

/** Criação rápida de membro no escopo (GME/MCR/OE). */
export const createScopeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        fullName: z.string().trim().min(2),
        demolayId: z.string().trim().optional().nullable(),
        birthDate: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageRegionChapters(context.supabase, data.chapterId);
    const { data: id, error } = await context.supabase.rpc(
      "create_member_with_pii" as never,
      {
        _chapter_id: data.chapterId,
        _full_name: data.fullName,
        _birth_date: data.birthDate || null,
        _cpf: "",
        _rg: "",
        _phone: "",
        _email: "",
        _address: {},
        _status: "regular",
        _kind: "demolay_ativo",
        _guardian: null,
        _consent_text_version: null,
        _demolay_id: data.demolayId || null,
        _masonic_id: null,
        _initiation_chapter_id: data.chapterId,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export type OrgLeadershipRow = {
  id: string;
  user_id: string;
  org_role: OrgRoleName;
  state_id: string | null;
  region_id: string | null;
  active: boolean;
  full_name: string | null;
  email: string | null;
  state_name: string | null;
  region_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

export const listOrgLeaderships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgLeadershipRow[]> => {
    const { data: myLead, error: myErr } = await context.supabase
      .from("org_leaderships")
      .select("org_role, region_id, state_id")
      .eq("user_id", context.userId)
      .eq("active", true);
    if (myErr) throw new Error(myErr.message);
    const isGme = (myLead ?? []).some((l) => l.org_role === "gme");
    const canAppoint =
      isGme ||
      (myLead ?? []).some((l) => l.org_role === "mcr" || l.org_role === "oe");
    if (!canAppoint) throw new Error("Sem permissão para ver lideranças");

    let q = context.supabase
      .from("org_leaderships")
      .select(
        "id, user_id, org_role, state_id, region_id, active, starts_on, ends_on, profiles(full_name)",
      )
      .order("created_at", { ascending: false });

    if (!isGme) {
      const regionIds = [
        ...new Set(
          (myLead ?? [])
            .filter((l) => l.region_id && (l.org_role === "mcr" || l.org_role === "oe"))
            .map((l) => l.region_id as string),
        ),
      ];
      if (regionIds.length === 0) return [];
      q = q.in("region_id", regionIds).in("org_role", ["mcr", "oe"]);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [statesRes, regionsRes] = await Promise.all([
      context.supabase.from("states").select("id, name, uf"),
      context.supabase.from("regions").select("id, name, state_id"),
    ]);

    const result: OrgLeadershipRow[] = [];
    for (const row of rows ?? []) {
      const profileJoin = row.profiles as
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
      const profile = Array.isArray(profileJoin)
        ? profileJoin[0]
        : profileJoin;
      let email: string | null = null;
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
          row.user_id,
        );
        email = authUser.user?.email ?? null;
      } catch {
        email = null;
      }
      const state = (statesRes.data ?? []).find((s) => s.id === row.state_id);
      const region = (regionsRes.data ?? []).find(
        (r) => r.id === row.region_id,
      );
      result.push({
        id: row.id,
        user_id: row.user_id,
        org_role: row.org_role as OrgRoleName,
        state_id: row.state_id,
        region_id: row.region_id,
        active: row.active,
        full_name: profile?.full_name ?? null,
        email,
        state_name: state ? `${state.name} (${state.uf})` : null,
        region_name: region?.name ?? null,
        starts_on: (row as { starts_on?: string | null }).starts_on ?? null,
        ends_on: (row as { ends_on?: string | null }).ends_on ?? null,
      });
    }
    return result;
  });

export const saveOrgLeadership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        email: z.string().trim().email().optional(),
        org_role: z.enum(["gme", "mce"]),
        state_id: z.string().uuid().nullable().optional(),
        region_id: z.string().uuid().nullable().optional(),
        active: z.boolean().optional().default(true),
      })
      .superRefine((val, ctx) => {
        if (!val.state_id) {
          ctx.addIssue({
            code: "custom",
            message: "Informe o estado para GME/MCE",
            path: ["state_id"],
          });
        }
        if (val.region_id) {
          ctx.addIssue({
            code: "custom",
            message: "GME/MCE não usam região",
            path: ["region_id"],
          });
        }
        if (!val.id && !val.email) {
          ctx.addIssue({
            code: "custom",
            message: "Informe o e-mail da conta",
            path: ["email"],
          });
        }
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase);

    const payload = {
      org_role: data.org_role,
      state_id: data.state_id!,
      region_id: null as string | null,
      active: data.active ?? true,
    };

    if (data.id) {
      const { data: existing, error: fetchErr } = await context.supabase
        .from("org_leaderships")
        .select("org_role")
        .eq("id", data.id)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) throw new Error("Liderança não encontrada");
      if (existing.org_role === "mcr" || existing.org_role === "oe") {
        throw new Error(
          "MCR e OE devem ser alterados pela transferência oficial (convite por ID DeMolay).",
        );
      }
      const { error } = await context.supabase
        .from("org_leaderships")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const email = data.email!.trim().toLowerCase();
    // Busca usuário por e-mail
    let userId: string | null = null;
    const perPage = 200;
    for (let page = 1; page <= 25; page++) {
      const { data: pageData, error: listErr } =
        await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listErr) throw new Error(listErr.message);
      const found = pageData.users.find(
        (u) => (u.email ?? "").toLowerCase() === email,
      );
      if (found) {
        userId = found.id;
        break;
      }
      if (pageData.users.length < perPage) break;
    }
    if (!userId) {
      throw new Error(
        "Conta não encontrada com este e-mail. Crie o acesso do usuário antes.",
      );
    }

    const { data: row, error } = await context.supabase
      .from("org_leaderships")
      .insert({ ...payload, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setOrgLeadershipActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase);
    const { data: row, error: fetchErr } = await context.supabase
      .from("org_leaderships")
      .select("org_role")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (row?.org_role === "mcr" || row?.org_role === "oe") {
      throw new Error(
        "Para MCR/OE use a transferência oficial (convite). Desativar aqui não aplica.",
      );
    }
    const { error } = await context.supabase
      .from("org_leaderships")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Busca membro da região pelo ID DeMolay (para convite MCR/OE). */
export const lookupRegionMemberByDemolay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        demolayId: z.string().trim().min(1),
        regionId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const needle = normalizeDemolayId(data.demolayId);
    if (!needle) return null;
    const { data: rows, error } = await context.supabase
      .from("members")
      .select(
        "id, full_name, demolay_id, user_id, chapter_id, status, chapters!inner(id, name, number, region_id)",
      )
      .eq("chapters.region_id", data.regionId);
    if (error) throw new Error(error.message);
    const match = (rows ?? []).find(
      (m) => normalizeDemolayId(m.demolay_id ?? "") === needle,
    );
    if (!match) return null;
    const chapterJoin = match.chapters as
      | { id: string; name: string; number: string; region_id: string }
      | { id: string; name: string; number: string; region_id: string }[]
      | null;
    const chapter = Array.isArray(chapterJoin) ? chapterJoin[0] : chapterJoin;
    return {
      id: match.id,
      full_name: match.full_name,
      demolay_id: match.demolay_id,
      user_id: match.user_id,
      chapter_id: match.chapter_id,
      status: match.status,
      chapter_name: chapter
        ? `${chapter.name} Nº ${chapter.number}`
        : null,
      has_account: Boolean(match.user_id),
    };
  });

/** Transfere MCR ou OE (único ativo por região). */
export const transferRegionOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        targetMemberId: z.string().uuid(),
        orgRole: z.enum(["mcr", "oe"]),
        regionId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "transfer_region_office" as never,
      {
        _target_member_id: data.targetMemberId,
        _org_role: data.orgRole,
        _region_id: data.regionId,
      } as never,
    );
    if (error) throw new Error(error.message);
    return (result ?? {}) as {
      leadership_id?: string;
      member_position_id?: string;
      user_id?: string;
    };
  });
