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
  /** Escopo sintético gerado para super admin (não vem de org_leaderships). */
  synthetic?: boolean;
};

export type OrgContext = {
  isSuperAdmin: boolean;
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
  userId: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.is_super_admin) return { isSuperAdmin: true as const };

  const { data: ok, error: rpcErr } = await supabase.rpc(
    "is_gme" as never,
    { _state_id: null } as never,
  );
  if (rpcErr) throw new Error(rpcErr.message);
  if (!ok) throw new Error("Sem permissão para gestão organizacional");
  return { isSuperAdmin: false as const };
}

/**
 * Lideranças supra-capitulares do usuário logado, já com os capítulos
 * que cada escopo abrange. Super admin recebe um escopo por estado.
 */
export const getMyOrgContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgContext> => {
    const { data: profile, error: profileErr } = await context.supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    const isSuperAdmin = Boolean(profile?.is_super_admin);

    const { data: leaderships, error } = await context.supabase
      .from("org_leaderships")
      .select("id, org_role, state_id, region_id, term_year, term_semester")
      .eq("user_id", context.userId)
      .eq("active", true);
    if (error) throw new Error(error.message);

    const [statesRes, regionsRes, chaptersRes] = await Promise.all([
      context.supabase.from("states").select("id, name, uf").order("name"),
      context.supabase.from("regions").select("id, name, code, state_id"),
      context.supabase.from("chapters").select("id, state_id, region_id, active"),
    ]);
    if (statesRes.error) throw new Error(statesRes.error.message);
    if (regionsRes.error) throw new Error(regionsRes.error.message);
    if (chaptersRes.error) throw new Error(chaptersRes.error.message);

    const states = statesRes.data ?? [];
    const regions = regionsRes.data ?? [];
    const chapters = chaptersRes.data ?? [];

    const mapped: OrgLeadership[] = (leaderships ?? []).map((l) => {
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

    if (isSuperAdmin) {
      const coveredStates = new Set(
        mapped.filter((l) => l.state_id && !l.region_id).map((l) => l.state_id),
      );
      for (const s of states) {
        if (coveredStates.has(s.id)) continue;
        mapped.push({
          id: `super:${s.id}`,
          org_role: "gme",
          state_id: s.id,
          region_id: null,
          state_name: `${s.name} (${s.uf})`,
          region_name: null,
          chapter_ids: chapters
            .filter((c) => c.state_id === s.id)
            .map((c) => c.id),
          synthetic: true,
        });
      }
      // Se não há estados ainda, cria escopo placeholder para entrar na gestão
      if (mapped.length === 0) {
        mapped.push({
          id: "super:platform",
          org_role: "gme",
          state_id: null,
          region_id: null,
          state_name: "Plataforma",
          region_name: null,
          chapter_ids: [],
          synthetic: true,
        });
      }
    }

    return { isSuperAdmin, leaderships: mapped };
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
    let q = context.supabase
      .from("members")
      .select(
        "id, chapter_id, full_name, birth_date, status, kind, phone, email, cpf_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay",
      )
      .in("chapter_id", data.chapterIds)
      .order("full_name", { ascending: true })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.search.trim().length > 0)
      q = q.ilike("full_name", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Lista todos os estados (GME vê os seus; super admin vê todos). */
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
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.is_super_admin) {
      throw new Error("Apenas o super administrador pode gerenciar estados");
    }

    if (data.id) {
      const { error } = await context.supabase
        .from("states")
        .update({ name: data.name, uf: data.uf })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("states")
      .insert({ name: data.name, uf: data.uf })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.is_super_admin) {
      throw new Error("Apenas o super administrador pode excluir estados");
    }
    const { error } = await context.supabase
      .from("states")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Regiões de um estado (para gestão do GME / super admin). */
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
    const { error } = await context.supabase
      .from("chapters")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
};

export const listOrgLeaderships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgLeadershipRow[]> => {
    await assertCanManageOrg(context.supabase, context.userId);

    const { data: rows, error } = await context.supabase
      .from("org_leaderships")
      .select(
        "id, user_id, org_role, state_id, region_id, active, profiles(full_name)",
      )
      .order("created_at", { ascending: false });
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
        org_role: orgRoleEnum,
        state_id: z.string().uuid().nullable().optional(),
        region_id: z.string().uuid().nullable().optional(),
        active: z.boolean().optional().default(true),
      })
      .superRefine((val, ctx) => {
        if (val.org_role === "gme" || val.org_role === "mce") {
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
        } else if (!val.region_id) {
          ctx.addIssue({
            code: "custom",
            message: "Informe a região para MCR/OE",
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
    await assertCanManageOrg(context.supabase, context.userId);

    const payload = {
      org_role: data.org_role,
      state_id:
        data.org_role === "gme" || data.org_role === "mce"
          ? data.state_id!
          : null,
      region_id:
        data.org_role === "mcr" || data.org_role === "oe"
          ? data.region_id!
          : null,
      active: data.active ?? true,
    };

    if (data.id) {
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
    await assertCanManageOrg(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("org_leaderships")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
