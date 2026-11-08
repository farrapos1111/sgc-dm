import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  optionalBirthDate,
  optionalCep,
  optionalCpf,
  optionalEmail,
  optionalPhone,
} from "@/lib/validation";

/** Fichas do Bethel (esfera FDJ) — tabela `fdj_members`, separada de `members` (ODM). */

export const FDJ_CONSENT_VERSION = "fdj-v1-2026-11";

const statusEnum = z.enum(["regular", "irregular"]);

const guardianSchema = z
  .object({
    full_name: z.string().trim().max(200).optional().default(""),
    relationship: z.string().trim().max(100).optional().default(""),
    phone: optionalPhone,
    email: optionalEmail,
  })
  .nullable()
  .optional();

const addressSchema = z
  .object({
    zip: optionalCep,
    street: z.string().max(300).optional().default(""),
    number: z.string().max(60).optional().default(""),
    complement: z.string().max(300).optional().default(""),
    neighborhood: z.string().max(200).optional().default(""),
    city: z.string().max(200).optional().default(""),
    state: z.string().max(60).optional().default(""),
  })
  .optional()
  .default({});

const optionalDate = z
  .string()
  .max(10)
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v : null));

const baseFields = {
  full_name: z.string().trim().min(2, "Informe o nome completo").max(160),
  birth_date: optionalBirthDate.transform((v) => (v && v.trim() ? v : null)),
  fdj_id: z.string().trim().max(40).optional().default(""),
  status: statusEnum.default("regular"),
  initiation_date: optionalDate,
  phone: optionalPhone,
  email: optionalEmail,
  address: addressSchema,
  guardian: guardianSchema,
  notes: z.string().trim().max(2000).optional().default(""),
};

export type FdjMemberRow = {
  id: string;
  chapter_id: string;
  user_id: string | null;
  full_name: string;
  birth_date: string | null;
  fdj_id: string | null;
  status: "regular" | "irregular";
  initiation_date: string | null;
  cpf_last2: string | null;
  rg_last2: string | null;
  phone: string | null;
  email: string | null;
  address: Record<string, string> | null;
  guardian: {
    full_name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  } | null;
  notes: string | null;
  consent_text_version: string | null;
  consent_signed_at: string | null;
  created_at: string;
  updated_at: string;
};

const FDJ_FIELDS =
  "id, chapter_id, user_id, full_name, birth_date, fdj_id, status, initiation_date, cpf_last2, rg_last2, phone, email, address, guardian, notes, consent_text_version, consent_signed_at, created_at, updated_at" as const;

// O cliente gerado ainda não conhece as colunas/RPCs novas do Bethel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

async function canManage(client: LooseClient, chapterId: string): Promise<boolean> {
  const { data, error } = await client.rpc("can_manage_fdj_members", {
    _chapter_id: chapterId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export const listFdjMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        search: z.string().max(200).optional().default(""),
        status: z.enum(["regular", "irregular", "all"]).optional().default("all"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    let query = client
      .from("fdj_members")
      .select(FDJ_FIELDS)
      .eq("chapter_id", data.chapterId)
      .order("full_name", { ascending: true });
    if (data.status !== "all") query = query.eq("status", data.status);
    const q = data.search.trim();
    if (q) {
      const safe = q.replace(/[%,()]/g, " ");
      query = query.or(`full_name.ilike.%${safe}%,fdj_id.ilike.%${safe}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const manage = await canManage(client, data.chapterId);
    return { members: (rows ?? []) as FdjMemberRow[], canManage: manage };
  });

export const getFdjMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    const { data: row, error } = await client
      .from("fdj_members")
      .select(FDJ_FIELDS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { member: null, canManage: false };
    const manage = await canManage(client, (row as FdjMemberRow).chapter_id);
    return { member: row as FdjMemberRow, canManage: manage };
  });

function rpcPayload(d: {
  full_name: string;
  birth_date: string | null;
  fdj_id: string;
  status: "regular" | "irregular";
  initiation_date: string | null;
  phone: string;
  email: string;
  address: Record<string, unknown>;
  guardian?: { full_name: string } | null;
  notes: string;
}) {
  const guardian = d.guardian && d.guardian.full_name.trim().length > 0 ? d.guardian : null;
  return {
    _full_name: d.full_name,
    _birth_date: d.birth_date,
    _fdj_id: d.fdj_id || null,
    _status: d.status,
    _initiation_date: d.initiation_date,
    _phone: d.phone || null,
    _email: d.email || null,
    _address: d.address ?? {},
    _guardian: guardian,
    _notes: d.notes || null,
  };
}

export const createFdjMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        ...baseFields,
        cpf: optionalCpf,
        rg: z.string().max(20).optional().default(""),
        consent: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    const { data: id, error } = await client.rpc("create_fdj_member", {
      _chapter_id: data.chapter_id,
      ...rpcPayload(data),
      _cpf: data.cpf || null,
      _rg: data.rg || null,
      _consent_text_version: data.consent ? FDJ_CONSENT_VERSION : null,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const updateFdjMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        ...baseFields,
        /** undefined = mantém o valor atual; "" = apaga. */
        cpf: optionalCpf.optional(),
        rg: z.string().max(20).optional(),
        cpf_changed: z.boolean().optional().default(false),
        rg_changed: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    const { error } = await client.rpc("update_fdj_member", {
      _id: data.id,
      ...rpcPayload(data),
      _cpf: data.cpf_changed ? (data.cpf ?? "") : null,
      _rg: data.rg_changed ? (data.rg ?? "") : null,
    });
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const getFdjMemberPii = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    const { data: rows, error } = await client.rpc("get_fdj_member_pii", {
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      { cpf: string | null; rg: string | null } | undefined;
    return { cpf: row?.cpf ?? null, rg: row?.rg ?? null };
  });

export const deleteFdjMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    const { error } = await client.rpc("delete_fdj_member", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Secretaria/admin do Bethel: cria (ou vincula) a conta de acesso da filha. */
export const provisionFdjMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().trim().email().optional(),
        sendEmail: z.boolean().optional().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as LooseClient;
    const { data: row, error } = await client
      .from("fdj_members")
      .select("id, chapter_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ficha não encontrada");
    if (!(await canManage(client, row.chapter_id as string))) {
      throw new Error("Sem permissão para criar acessos neste Bethel");
    }
    const { linkFichaAccount } = await import("@/lib/member-accounts.server");
    return linkFichaAccount({
      table: "fdj_members",
      fichaId: data.id,
      actorId: context.userId,
      email: data.email ?? null,
      sendEmail: data.sendEmail,
    });
  });

/** Fichas do Bethel ligadas à conta logada (perfil). */
export const getMyFdjFichas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as LooseClient;
    const { data, error } = await client
      .from("fdj_members")
      .select(FDJ_FIELDS)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { fichas: (data ?? []) as FdjMemberRow[] };
  });
