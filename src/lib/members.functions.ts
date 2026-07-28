import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusEnum = z.enum(["ativo", "inativo", "senior", "macom"]);

const listInput = z.object({
  chapterId: z.string().uuid(),
  search: z.string().optional().default(""),
  status: z.enum(["ativo", "inativo", "senior", "macom", "all"]).optional().default("all"),
});

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => listInput.parse(raw))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("members")
      .select(
        "id, full_name, birth_date, status, phone, email, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, created_at",
      )
      .eq("chapter_id", data.chapterId)
      .order("full_name", { ascending: true });
    if (data.status !== "all") q = q.eq("status", data.status);
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
        "id, chapter_id, full_name, birth_date, status, phone, email, address, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");

    const [guardiansRes, consentsRes, auditRes] = await Promise.all([
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
        .select("id, action, new_value, user_id, created_at")
        .eq("table_name", "members")
        .eq("record_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (guardiansRes.error) throw new Error(guardiansRes.error.message);
    if (consentsRes.error) throw new Error(consentsRes.error.message);
    return {
      member,
      guardians: guardiansRes.data ?? [],
      consents: consentsRes.data ?? [],
      audit: auditRes.data ?? [],
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
    street: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
    zip: z.string().optional().default(""),
  })
  .default({ street: "", city: "", state: "", zip: "" });

const createInput = z.object({
  chapter_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  birth_date: z.string().optional().nullable(),
  exam_grau_iniciatico: z.string().optional().nullable(),
  exam_grau_demolay: z.string().optional().nullable(),
  iniciacao_ordem: z.string().optional().nullable(),
  iniciacao_grau_demolay: z.string().optional().nullable(),
  cpf: z.string().optional().default(""),
  rg: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: addressSchema,
  status: statusEnum.default("ativo"),
  guardians: z.array(guardianSchema).max(2).optional().default([]),
  consent_text_version: z.string().default("v1-2026-07"),
});

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createInput.parse(raw))
  .handler(async ({ data, context }) => {
    const [first, second] = data.guardians ?? [];
    const args = {
      _chapter_id: data.chapter_id,
      _full_name: data.full_name,
      _birth_date: data.birth_date || null,
      _exam_grau_iniciatico: data.exam_grau_iniciatico || null,
      _exam_grau_demolay: data.exam_grau_demolay || null,
      _iniciacao_ordem: data.iniciacao_ordem || null,
      _iniciacao_grau_demolay: data.iniciacao_grau_demolay || null,
      _cpf: data.cpf || "",
      _rg: data.rg || "",
      _phone: data.phone || "",
      _email: data.email || "",
      _address: data.address ?? {},
      _status: data.status,
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
  cpf: z.string().optional().default(""),
  rg: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  address: addressSchema,
  status: statusEnum,
  guardians: z.array(guardianSchema).max(2).optional().default([]),
});

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => updateInput.parse(raw))
  .handler(async ({ data, context }) => {
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
      _exam_grau_iniciatico: data.exam_grau_iniciatico || null,
      _exam_grau_demolay: data.exam_grau_demolay || null,
      _iniciacao_ordem: data.iniciacao_ordem || null,
      _iniciacao_grau_demolay: data.iniciacao_grau_demolay || null,
      _guardians: data.guardians ?? [],
    } as unknown as Parameters<typeof context.supabase.rpc<"update_member_with_pii">>[1];
    const { error } = await context.supabase.rpc("update_member_with_pii", args);
    if (error) throw new Error(error.message);
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
