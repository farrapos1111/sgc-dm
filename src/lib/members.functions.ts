import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { is21OrOlder, isUnder21 } from "@/lib/format";
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

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => listInput.parse(raw))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("members")
      .select(
        "id, full_name, birth_date, status, kind, phone, email, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, demolay_id, masonic_id, created_at",
      )
      .eq("chapter_id", data.chapterId)
      .order("full_name", { ascending: true });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.search && data.search.trim().length > 0) q = q.ilike("full_name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select(
        "id, chapter_id, full_name, birth_date, status, kind, phone, email, address, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, demolay_id, masonic_id, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");

    const [guardiansRes, consentsRes, auditRes, awayRes] = await Promise.all([
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
    ]);
    if (guardiansRes.error) throw new Error(guardiansRes.error.message);
    if (consentsRes.error) throw new Error(consentsRes.error.message);
    if (awayRes.error) throw new Error(awayRes.error.message);
    const awayPeriods = awayRes.data ?? [];
    const openAway = awayPeriods.find((p) => p.ended_on == null) ?? null;
    return {
      member,
      guardians: guardiansRes.data ?? [],
      consents: consentsRes.data ?? [],
      audit: auditRes.data ?? [],
      awayPeriods,
      irregularSince: openAway?.started_on ?? null,
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
  /** Data efetiva do status irregular (obrigatória se status = irregular). */
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
      _demolay_id: data.demolay_id || null,
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
  cpf: z.string().optional().default(""),
  rg: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: addressSchema,
  status: statusEnum,
  kind: kindEnum,
  /**
   * Data efetiva da mudança de status:
   * - regular → irregular: início do afastamento
   * - irregular → regular: data do retorno
   * - irregular → irregular: ajusta started_on do período aberto
   */
  status_effective_on: z.string().optional().nullable(),
  guardians: z.array(guardianSchema).max(2).optional().default([]),
});

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => updateInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: current, error: curErr } = await context.supabase
      .from("members")
      .select("id, chapter_id, status")
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
      _demolay_id: data.demolay_id || null,
      _masonic_id: kind === "macom" ? data.masonic_id || null : null,
      _guardians: data.guardians ?? [],
    } as unknown as Parameters<typeof context.supabase.rpc<"update_member_with_pii">>[1];
    const { error } = await context.supabase.rpc("update_member_with_pii", args);
    if (error) throw new Error(error.message);

    // Sync períodos de afastamento + mensalidades
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
      // Legado sem período: só atualiza status; meses passados não são auto-desligados
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
