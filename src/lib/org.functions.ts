import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgRoleEnum = z.enum(["gme", "mce", "mcr", "oe"]);

export type OrgRoleName = z.infer<typeof orgRoleEnum>;

export type OrgLeadership = {
  id: string;
  org_role: OrgRoleName;
  state_id: string | null;
  region_id: string | null;
  state_name: string | null;
  region_name: string | null;
  chapter_ids: string[];
};

/**
 * Lideranças supra-capitulares do usuário logado, já com os capítulos
 * que cada escopo abrange (a RLS garante que só venham os permitidos).
 */
export const getMyOrgContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgLeadership[]> => {
    const { data: leaderships, error } = await context.supabase
      .from("org_leaderships")
      .select("id, org_role, state_id, region_id, term_year, term_semester")
      .eq("user_id", context.userId)
      .eq("active", true);
    if (error) throw new Error(error.message);
    if (!leaderships || leaderships.length === 0) return [];

    const [statesRes, regionsRes, chaptersRes] = await Promise.all([
      context.supabase.from("states").select("id, name, uf"),
      context.supabase.from("regions").select("id, name, code, state_id"),
      context.supabase.from("chapters").select("id, state_id, region_id, active"),
    ]);
    if (statesRes.error) throw new Error(statesRes.error.message);
    if (regionsRes.error) throw new Error(regionsRes.error.message);
    if (chaptersRes.error) throw new Error(chaptersRes.error.message);

    const states = statesRes.data ?? [];
    const regions = regionsRes.data ?? [];
    const chapters = chaptersRes.data ?? [];

    return leaderships.map((l) => {
      const state = states.find((s) => s.id === l.state_id) ?? null;
      const region = regions.find((r) => r.id === l.region_id) ?? null;
      const scopeChapters = l.region_id
        ? chapters.filter((c) => c.region_id === l.region_id)
        : chapters.filter((c) => c.state_id === l.state_id);
      return {
        id: l.id,
        org_role: l.org_role as OrgRoleName,
        state_id: l.state_id,
        region_id: l.region_id,
        state_name: state ? `${state.name} (${state.uf})` : null,
        region_name: region?.name ?? null,
        chapter_ids: scopeChapters.map((c) => c.id),
      };
    });
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
      .select("id, name, number, city, primary_color, logo_url, active, region_id, state_id")
      .order("number", { ascending: true });
    q = data.scopeType === "region"
      ? q.eq("region_id", data.scopeId)
      : q.eq("state_id", data.scopeId);
    const { data: chapters, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (chapters ?? []).map((c) => c.id);
    if (ids.length === 0) return [];

    const [membersRes, nextRes, regionsRes] = await Promise.all([
      context.supabase.from("members").select("id, chapter_id, status").in("chapter_id", ids),
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
      active_members: members.filter((m) => m.chapter_id === c.id && m.status === "ativo").length,
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
        status: z.enum(["ativo", "inativo", "senior", "macom", "all"]).optional().default("all"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("members")
      .select(
        "id, chapter_id, full_name, birth_date, status, phone, email, cpf_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay",
      )
      .in("chapter_id", data.chapterIds)
      .order("full_name", { ascending: true })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search.trim().length > 0) q = q.ilike("full_name", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Regiões de um estado (para gestão do GME). */
export const listRegions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ stateId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("regions")
      .select("id, name, code, state_id")
      .eq("state_id", data.stateId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
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
      .insert({ state_id: data.state_id, name: data.name, code: data.code ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("regions").delete().eq("id", data.id);
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
    const payload = {
      state_id: data.state_id,
      region_id: data.region_id ?? null,
      name: data.name,
      number: data.number,
      city: data.city ?? null,
      ...(data.active === undefined ? {} : { active: data.active }),
    };
    if (data.id) {
      const { error } = await context.supabase.from("chapters").update(payload).eq("id", data.id);
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
    const { error } = await context.supabase
      .from("chapters")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
