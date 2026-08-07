import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { is21OrOlder, isUnder21 } from "@/lib/format";
import { normalizeDemolayId } from "@/lib/member-identity";
import { todayYmd } from "@/lib/timezone";

const statusEnum = z.enum(["regular", "irregular"]);
const kindEnum = z.enum(["demolay_ativo", "senior", "macom"]);

type MemberKind = z.infer<typeof kindEnum>;

/** Demolay Ativo com 21+ vira Senior; Senior com menos de 21 volta para Demolay Ativo. Maçom permanece. */
function resolveAutoKind(
  kind: MemberKind,
  birthDate: string | null | undefined,
): MemberKind {
  if (kind === "macom") return kind;
  if (is21OrOlder(birthDate)) return "senior";
  if (kind === "senior" && isUnder21(birthDate)) return "demolay_ativo";
  return kind;
}

const listInput = z.object({
  chapterId: z.string().uuid(),
  search: z.string().optional().default(""),
  status: z.enum(["regular", "irregular", "all"]).optional().default("all"),
  kind: z.enum(["demolay_ativo", "senior", "macom", "all"]).optional().default("all"),
});

const MEMBER_LIST_FIELDS =
  "id, full_name, birth_date, status, kind, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, demolay_id, masonic_id, chapter_id, initiation_chapter_id, created_at, phone, email, cpf_last2, rg_last2" as const;

function stripMemberListPii<T extends Record<string, unknown>>(row: T): T {
  const {
    phone: _p,
    email: _e,
    cpf_last2: _c,
    rg_last2: _r,
    ...rest
  } = row as T & {
    phone?: unknown;
    email?: unknown;
    cpf_last2?: unknown;
    rg_last2?: unknown;
  };
  return rest as T;
}

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => listInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: canSecretaria, error: permErr } = await context.supabase.rpc(
      "has_permission" as never,
      { _chapter_id: data.chapterId, _perm: "secretaria" } as never,
    );
    if (permErr) throw new Error(permErr.message);
    let canSeePii = Boolean(canSecretaria);
    if (!canSeePii) {
      const { data: canAdmin, error: adminErr } = await context.supabase.rpc(
        "has_permission" as never,
        { _chapter_id: data.chapterId, _perm: "admin" } as never,
      );
      if (adminErr) throw new Error(adminErr.message);
      canSeePii = Boolean(canAdmin);
    }
    if (!canSeePii) {
      const { data: canConselho, error: conselhoErr } = await context.supabase.rpc(
        "has_permission" as never,
        { _chapter_id: data.chapterId, _perm: "conselho" } as never,
      );
      if (conselhoErr) throw new Error(conselhoErr.message);
      canSeePii = Boolean(canConselho);
    }

    // Prefer afiliações ativas; fallback para chapter_id originário se a tabela ainda não existir
    const { data: affRows, error: affErr } = await context.supabase
      .from("member_chapter_affiliations" as "members")
      .select(`member:members(${MEMBER_LIST_FIELDS})`)
      .eq("chapter_id" as never, data.chapterId)
      .eq("active" as never, true);

    if (!affErr && affRows) {
      let rows = (affRows as unknown as { member: Record<string, unknown> | null }[])
        .map((r) => r.member)
        .filter((m): m is Record<string, unknown> => !!m);

      if (data.status !== "all") {
        rows = rows.filter((m) => m.status === data.status);
      }
      if (data.kind !== "all") {
        rows = rows.filter((m) => m.kind === data.kind);
      }
      if (data.search && data.search.trim().length > 0) {
        const q = data.search.trim().toLowerCase();
        rows = rows.filter((m) =>
          String(m.full_name ?? "")
            .toLowerCase()
            .includes(q),
        );
      }
      rows.sort((a, b) =>
        String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""), "pt-BR"),
      );
      if (!canSeePii) {
        rows = rows.map((m) => stripMemberListPii(m));
      }
      return rows as never;
    }

    // Fallback legado (pré-migration)
    let q = context.supabase
      .from("members")
      .select(MEMBER_LIST_FIELDS)
      .eq("chapter_id", data.chapterId)
      .order("full_name", { ascending: true });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.search && data.search.trim().length > 0) q = q.ilike("full_name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Record<string, unknown>[];
    return (canSeePii ? list : list.map((m) => stripMemberListPii(m))) as never;
  });

export const listChaptersForSelect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "list_chapters_for_select" as never,
    );
    if (error) {
      // Fallback: capítulos legíveis via RLS
      const { data: rows, error: e2 } = await context.supabase
        .from("chapters")
        .select("id, name, number, city")
        .eq("active", true)
        .order("name");
      if (e2) throw new Error(e2.message);
      return rows ?? [];
    }
    return (data as { id: string; name: string; number: string; city: string | null }[]) ?? [];
  });

export const lookupMemberByDemolayId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        demolayId: z.string().trim().min(1),
        chapterId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: raw, error } = await context.supabase.rpc(
      "lookup_member_by_demolay_id" as never,
      {
        _demolay_id: normalizeDemolayId(data.demolayId) || data.demolayId.trim(),
        _for_chapter_id: data.chapterId,
      } as never,
    );
    if (error) throw new Error(error.message);
    if (!raw) return null;
    return raw as {
      id: string;
      chapter_id: string;
      initiation_chapter_id: string | null;
      full_name: string;
      birth_date: string | null;
      status: string;
      kind: string;
      phone: string | null;
      email: string | null;
      address: Record<string, string>;
      demolay_id: string | null;
      masonic_id: string | null;
      exam_grau_iniciatico: string | null;
      exam_grau_demolay: string | null;
      iniciacao_ordem: string | null;
      iniciacao_grau_demolay: string | null;
      already_affiliated: boolean;
      position_history: {
        label: string;
        term_year: number;
        term_semester: number;
        chapter_name: string;
        chapter_number: string;
      }[];
    };
  });

export const affiliateMemberToChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        chapterId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "affiliate_member_to_chapter" as never,
      {
        _member_id: data.memberId,
        _chapter_id: data.chapterId,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { id: id as string, memberId: data.memberId };
  });

export const getMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select(
        "id, chapter_id, initiation_chapter_id, full_name, birth_date, status, kind, phone, email, address, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, demolay_id, masonic_id, user_id, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");

    const [guardiansRes, consentsRes, auditRes, awayRes, affRes, initChapterRes, originChapterRes] =
      await Promise.all([
        context.supabase
          .from("guardians")
          .select("id, full_name, relationship, phone, email, cpf_last2, is_primary")
          .eq("member_id", data.id)
          .order("is_primary", { ascending: false }),
        context.supabase
          .from("lgpd_consents")
          .select("id, consent_text_version, signed_at, guardian_id")
          .eq("member_id", data.id)
          .order("signed_at", { ascending: false }),
        context.supabase
          .from("audit_logs")
          .select("id, action, old_value, new_value, user_id, created_at")
          .eq("table_name", "members")
          .eq("record_id", data.id)
          .order("created_at", { ascending: false })
          .limit(50),
        context.supabase
          .from("member_away_periods")
          .select("id, started_on, ended_on, created_at")
          .eq("member_id", data.id)
          .order("started_on", { ascending: false }),
        context.supabase
          .from("member_chapter_affiliations" as "members")
          .select(
            "id, chapter_id, active, joined_at, left_at, chapter:chapters(id, name, number)",
          )
          .eq("member_id" as never, data.id)
          .order("joined_at" as never, { ascending: false }),
        (member as { initiation_chapter_id?: string | null }).initiation_chapter_id
          ? context.supabase
              .from("chapters")
              .select("id, name, number")
              .eq("id", (member as { initiation_chapter_id: string }).initiation_chapter_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        context.supabase
          .from("chapters")
          .select("id, name, number")
          .eq("id", member.chapter_id)
          .maybeSingle(),
      ]);
    if (guardiansRes.error) throw new Error(guardiansRes.error.message);
    if (consentsRes.error) throw new Error(consentsRes.error.message);
    if (awayRes.error) throw new Error(awayRes.error.message);
    const awayPeriods = awayRes.data ?? [];
    const openAway = awayPeriods.find((p) => p.ended_on == null) ?? null;
    return {
      member: {
        ...member,
        origin_chapter_id: member.chapter_id,
      },
      guardians: guardiansRes.data ?? [],
      consents: consentsRes.data ?? [],
      audit: auditRes.data ?? [],
      awayPeriods,
      irregularSince: openAway?.started_on ?? null,
      affiliations: affRes.error ? [] : (affRes.data ?? []),
      initiationChapter: initChapterRes.data ?? null,
      originChapter: originChapterRes.data ?? null,
    };
  });

const guardianSchema = z.object({
  full_name: z.string().min(1),
  relationship: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

const addressSchema = z
  .object({
    zip: z.string().optional().default(""),
    street: z.string().optional().default(""),
    number: z.string().optional().default(""),
    complement: z.string().optional().default(""),
    neighborhood: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
    country: z.string().optional().default("Brasil"),
  })
  .default({
    zip: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  });

const createInput = z.object({
  chapter_id: z.string().uuid(),
  initiation_chapter_id: z.string().uuid().optional().nullable(),
  full_name: z.string().trim().min(2).max(120),
  birth_date: z.string().optional().nullable(),
  exam_grau_iniciatico: z.string().optional().nullable(),
  exam_grau_demolay: z.string().optional().nullable(),
  iniciacao_ordem: z.string().optional().nullable(),
  iniciacao_grau_demolay: z.string().optional().nullable(),
  demolay_id: z.string().optional().default(""),
  masonic_id: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  rg: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: addressSchema,
  status: statusEnum.default("regular"),
  kind: kindEnum.default("demolay_ativo"),
  status_effective_on: z.string().optional().nullable(),
  guardians: z.array(guardianSchema).max(2).optional().default([]),
  consent_text_version: z.string().default("v1-2026-07"),
});

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createInput.parse(raw))
  .handler(async ({ data, context }) => {
    if (data.status === "irregular" && !data.status_effective_on) {
      throw new Error("Informe a data em que o membro se tornou irregular");
    }
    const [first, second] = data.guardians ?? [];
    const kind = resolveAutoKind(data.kind, data.birth_date);
    const args = {
      _chapter_id: data.chapter_id,
      _full_name: data.full_name,
      _birth_date: data.birth_date || null,
      _exam_grau_iniciatico: data.exam_grau_iniciatico || null,
      _exam_grau_demolay: data.exam_grau_demolay || null,
      _iniciacao_ordem: data.iniciacao_ordem || null,
      _iniciacao_grau_demolay: data.iniciacao_grau_demolay || null,
      _demolay_id: normalizeDemolayId(data.demolay_id) || null,
      _masonic_id: kind === "macom" ? data.masonic_id || null : null,
      _cpf: data.cpf || "",
      _rg: data.rg || "",
      _phone: data.phone || "",
      _email: data.email || "",
      _address: data.address ?? {},
      _status: data.status,
      _kind: kind,
      _guardian: first ?? null,
      _consent_text_version: data.consent_text_version,
      _initiation_chapter_id: data.initiation_chapter_id || data.chapter_id,
    } as unknown as Parameters<typeof context.supabase.rpc<"create_member_with_pii">>[1];
    const { data: id, error } = await context.supabase.rpc("create_member_with_pii", args);
    if (error) throw new Error(error.message);

    if (second && second.full_name.trim().length > 0) {
      const { error: gErr } = await context.supabase.rpc("add_member_guardian", {
        _member_id: id as string,
        _guardian: second,
      } as never);
      if (gErr) throw new Error(gErr.message);
    }

    if (data.status === "irregular" && data.status_effective_on) {
      const { error: awayErr } = await context.supabase.from("member_away_periods").insert({
        member_id: id as string,
        chapter_id: data.chapter_id,
        started_on: data.status_effective_on,
        ended_on: null,
        created_by: context.userId,
      });
      if (awayErr) throw new Error(awayErr.message);
    }

    return { id: id as string };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  birth_date: z.string().optional().nullable(),
  exam_grau_iniciatico: z.string().optional().nullable(),
  exam_grau_demolay: z.string().optional().nullable(),
  iniciacao_ordem: z.string().optional().nullable(),
  iniciacao_grau_demolay: z.string().optional().nullable(),
  demolay_id: z.string().optional().default(""),
  masonic_id: z.string().optional().default(""),
  initiation_chapter_id: z.string().uuid().optional().nullable(),
  cpf: z.string().optional().default(""),
  rg: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: addressSchema,
  status: statusEnum,
  kind: kindEnum,
  status_effective_on: z.string().optional().nullable(),
  guardians: z.array(guardianSchema).max(2).optional().default([]),
});

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => updateInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: current, error: curErr } = await context.supabase
      .from("members")
      .select("id, chapter_id, status, initiation_chapter_id")
      .eq("id", data.id)
      .single();
    if (curErr) throw new Error(curErr.message);

    const prevStatus = current.status as "regular" | "irregular";
    const nextStatus = data.status;
    const statusChanged = prevStatus !== nextStatus;
    const today = todayYmd();
    const effectiveOn = data.status_effective_on || today;

    if (statusChanged || (nextStatus === "irregular" && data.status_effective_on)) {
      if (!data.status_effective_on && statusChanged) {
        // default today already in effectiveOn
      }
    }
    if (nextStatus === "irregular" && statusChanged && !effectiveOn) {
      throw new Error("Informe a data em que o membro se tornou irregular");
    }
    if (prevStatus === "irregular" && nextStatus === "regular" && !effectiveOn) {
      throw new Error("Informe a data do retorno à regularidade");
    }

    const kind = resolveAutoKind(data.kind, data.birth_date);
    const initiationChapterId =
      data.initiation_chapter_id === undefined
        ? ((current as { initiation_chapter_id?: string | null })
            .initiation_chapter_id ?? null)
        : data.initiation_chapter_id;
    const args = {
      _member_id: data.id,
      _full_name: data.full_name,
      _birth_date: data.birth_date || null,
      _cpf: data.cpf || "",
      _rg: data.rg || "",
      _phone: data.phone || "",
      _email: data.email || "",
      _address: data.address ?? {},
      _status: data.status,
      _kind: kind,
      _exam_grau_iniciatico: data.exam_grau_iniciatico || null,
      _exam_grau_demolay: data.exam_grau_demolay || null,
      _iniciacao_ordem: data.iniciacao_ordem || null,
      _iniciacao_grau_demolay: data.iniciacao_grau_demolay || null,
      _demolay_id: normalizeDemolayId(data.demolay_id) || null,
      _masonic_id: kind === "macom" ? data.masonic_id || null : null,
      _guardians: data.guardians ?? [],
      _initiation_chapter_id: initiationChapterId,
    } as unknown as Parameters<typeof context.supabase.rpc<"update_member_with_pii">>[1];
    const { error } = await context.supabase.rpc("update_member_with_pii", args);
    if (error) throw new Error(error.message);

    if (prevStatus === "regular" && nextStatus === "irregular") {
      const { error: awayErr } = await context.supabase.from("member_away_periods").insert({
        member_id: data.id,
        chapter_id: current.chapter_id,
        started_on: effectiveOn,
        ended_on: null,
        created_by: context.userId,
      });
      if (awayErr) throw new Error(awayErr.message);

      const { error: duesErr } = await context.supabase.rpc("desligar_open_dues_from", {
        _member_id: data.id,
        _from: effectiveOn,
      });
      if (duesErr) throw new Error(duesErr.message);
    } else if (prevStatus === "irregular" && nextStatus === "regular") {
      const { data: openPeriod, error: openErr } = await context.supabase
        .from("member_away_periods")
        .select("id, started_on")
        .eq("member_id", data.id)
        .is("ended_on", null)
        .maybeSingle();
      if (openErr) throw new Error(openErr.message);

      if (openPeriod) {
        const { error: closeErr } = await context.supabase
          .from("member_away_periods")
          .update({ ended_on: effectiveOn })
          .eq("id", openPeriod.id);
        if (closeErr) throw new Error(closeErr.message);
      }
    } else if (
      prevStatus === "irregular" &&
      nextStatus === "irregular" &&
      data.status_effective_on
    ) {
      const { data: openPeriod } = await context.supabase
        .from("member_away_periods")
        .select("id")
        .eq("member_id", data.id)
        .is("ended_on", null)
        .maybeSingle();
      if (openPeriod) {
        const { error: updErr } = await context.supabase
          .from("member_away_periods")
          .update({ started_on: data.status_effective_on })
          .eq("id", openPeriod.id);
        if (updErr) throw new Error(updErr.message);
        const { error: duesErr } = await context.supabase.rpc("desligar_open_dues_from", {
          _member_id: data.id,
          _from: data.status_effective_on,
        });
        if (duesErr) throw new Error(duesErr.message);
      }
    }

    return { id: data.id };
  });

export const revealMemberPii = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ memberId: z.string().uuid(), field: z.enum(["cpf", "rg"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: plain, error } = await context.supabase.rpc("reveal_member_pii", {
      _member_id: data.memberId,
      _field: data.field,
    });
    if (error) throw new Error(error.message);
    return { value: (plain as string) ?? "" };
  });

/** Cargos do termo vigente do usuário logado no capítulo (para RBAC). */
export type MyCurrentPosition = {
  code: string;
  label: string;
};

export const getMyCurrentPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        year: z.number().int(),
        semester: z.union([z.literal(1), z.literal(2)]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<MyCurrentPosition[]> => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;

    const { data: byUser } = await context.supabase
      .from("members")
      .select("id")
      .eq("user_id", context.userId)
      .limit(5);

    let memberIds = (byUser ?? []).map((m) => m.id as string);

    if (memberIds.length === 0) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const filters: string[] = [];
      if (email) filters.push(`email.eq.${email}`);
      if (profile?.full_name) filters.push(`full_name.eq.${profile.full_name}`);
      if (filters.length === 0) return [];
      const { data: byIdentity } = await context.supabase
        .from("members")
        .select("id")
        .or(filters.join(","));
      memberIds = (byIdentity ?? []).map((m) => m.id as string);
    }

    if (memberIds.length === 0) return [];

    const { data: rows, error } = await context.supabase
      .from("member_positions")
      .select("position:positions(code, label)")
      .eq("chapter_id", data.chapterId)
      .in("member_id", memberIds)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester);
    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const out: MyCurrentPosition[] = [];
    for (const r of rows ?? []) {
      const p = r.position as
        | { code?: string; label?: string }
        | { code?: string; label?: string }[]
        | null;
      const pos = Array.isArray(p) ? p[0] : p;
      if (!pos?.code || seen.has(pos.code)) continue;
      seen.add(pos.code);
      out.push({ code: pos.code, label: pos.label ?? pos.code });
    }
    return out;
  });

/** Cargos ritualísticos do termo vigente por capítulo (para o seletor de instituições). */
export const listMyChapterAccessLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterIds: z.array(z.string().uuid()).max(50),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const chapterIds = [...new Set(data.chapterIds)];
    if (chapterIds.length === 0) return {} as Record<string, string[]>;

    const { currentTerm } = await import("@/lib/terms");
    const term = currentTerm();
    const email = (context.claims as { email?: string } | null)?.email ?? null;

    const { data: byUser } = await context.supabase
      .from("members")
      .select("id")
      .eq("user_id", context.userId)
      .limit(10);

    let memberIds = (byUser ?? []).map((m) => m.id as string);

    if (memberIds.length === 0) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const filters: string[] = [];
      if (email) filters.push(`email.eq.${email}`);
      if (profile?.full_name) filters.push(`full_name.eq.${profile.full_name}`);
      if (filters.length > 0) {
        const { data: byIdentity } = await context.supabase
          .from("members")
          .select("id")
          .or(filters.join(","));
        memberIds = (byIdentity ?? []).map((m) => m.id as string);
      }
    }

    const result: Record<string, string[]> = {};
    for (const id of chapterIds) result[id] = [];
    if (memberIds.length === 0) return result;

    const { data: rows, error } = await context.supabase
      .from("member_positions")
      .select("chapter_id, position:positions(label)")
      .in("chapter_id", chapterIds)
      .in("member_id", memberIds)
      .eq("term_year", term.year)
      .eq("term_semester", term.semester);
    if (error) throw new Error(error.message);

    for (const r of rows ?? []) {
      const chapterId = r.chapter_id as string;
      const p = r.position as
        | { label?: string }
        | { label?: string }[]
        | null;
      const pos = Array.isArray(p) ? p[0] : p;
      const label = pos?.label?.trim();
      if (!label) continue;
      const list = result[chapterId] ?? (result[chapterId] = []);
      if (!list.includes(label)) list.push(label);
    }
    return result;
  });
