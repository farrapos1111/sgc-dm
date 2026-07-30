import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type {
  CadastroLookupGuardian,
  CadastroLookupMember,
} from "@/lib/cadastro.functions";

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const chapterInput = z.object({ chapterId: z.string().uuid() });
const tokenInput = z.string().trim().min(16).max(128);

export type PublicLobbyChapter = {
  id: string;
  name: string;
  number: string;
  city: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

export type PublicAttendanceEvent = {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  mandatory: boolean;
};

export type PublicAttendanceRecord = {
  member_id: string;
  event_id: string;
  status: "presente" | "ausente" | string;
};

export type PublicAttendanceMember = {
  id: string;
  full_name: string;
  status: string;
  kind: string;
  birth_date: string | null;
  iniciacao_ordem: string | null;
};

export type PublicAttendanceOverview = {
  chapter: PublicLobbyChapter;
  year: number;
  events: PublicAttendanceEvent[];
  records: PublicAttendanceRecord[];
  members: PublicAttendanceMember[];
};

export type PublicMemberPortal = {
  chapter: {
    id: string;
    name: string;
    number: string;
    primary_color: string | null;
  };
  year: number;
  member: {
    id: string;
    full_name: string;
    status: string;
    kind: string;
    demolay_id: string | null;
  };
  dues: Array<{
    id: string;
    competence_year: number;
    competence_month: number;
    amount: number | string;
    status: string;
    paid_at: string | null;
  }>;
  charges: Array<{
    id: string;
    description: string;
    amount: number | string;
    due_date: string;
    status: string;
    paid_at: string | null;
    category: string;
    kind: string;
  }>;
  payments: Array<{
    id: string;
    charge_id: string;
    amount: number | string;
    paid_at: string;
  }>;
  events: PublicAttendanceEvent[];
  attendance: Array<{ event_id: string; status: string }>;
};

export const LOBBY_MEMBER_STORAGE_PREFIX = "sgcdm:lobby-member:";

export function lobbyMemberStorageKey(token: string) {
  return `${LOBBY_MEMBER_STORAGE_PREFIX}${token}`;
}

/** Obtém o token atual (ou null se ainda não gerado). */
export const getPublicLobbyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "get_public_lobby_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { token: (token as string | null) ?? null };
  });

/** Garante um token (cria se não existir; regenera se solicitado). */
export const ensurePublicLobbyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ regenerate: z.boolean().optional().default(false) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "ensure_public_lobby_token" as never,
      { _chapter_id: data.chapterId, _regenerate: data.regenerate } as never,
    );
    if (error) throw new Error(error.message);
    return { token: token as string };
  });

/** Revoga o link público do lobby. */
export const revokePublicLobbyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "revoke_public_lobby_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Branding do lobby público. */
export const getPublicLobby = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ token: tokenInput }).parse(raw))
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_lobby" as never,
      { _token: data.token } as never,
    );
    if (error) throw new Error(error.message);
    return payload as { chapter: PublicLobbyChapter };
  });

/** Visão geral pública de frequência. */
export const getPublicAttendance = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: tokenInput,
        year: z.number().int().min(1900).max(2100),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_attendance_overview" as never,
      { _token: data.token, _year: data.year } as never,
    );
    if (error) throw new Error(error.message);
    return payload as PublicAttendanceOverview;
  });

/** Área pessoal do membro no lobby (ID DeMolay). */
export const getPublicMemberPortal = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: tokenInput,
        demolayId: z.string().trim().min(3).max(40),
        year: z.number().int().min(1900).max(2100),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_member_portal" as never,
      {
        _token: data.token,
        _demolay_id: data.demolayId,
        _year: data.year,
      } as never,
    );
    if (error) throw new Error(error.message);
    return payload as PublicMemberPortal;
  });

const addressSchema = z.object({
  zip: z.string().optional().default(""),
  street: z.string().optional().default(""),
  number: z.string().optional().default(""),
  complement: z.string().optional().default(""),
  neighborhood: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  country: z.string().optional().default("Brasil"),
});

const guardianUpdateSchema = z.object({
  id: z.string().uuid(),
  relationship: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

/** Lookup de cadastro escopado ao capítulo do lobby. */
export const lookupLobbyMemberCadastro = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: tokenInput,
        demolayId: z.string().trim().min(3).max(40),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "lookup_lobby_member_cadastro" as never,
      { _token: data.token, _demolay_id: data.demolayId } as never,
    );
    if (error) throw new Error(error.message);
    return payload as {
      member: CadastroLookupMember;
      guardians: CadastroLookupGuardian[];
    };
  });

/** Submit de cadastro escopado ao capítulo do lobby. */
export const submitLobbyMemberCadastro = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: tokenInput,
        demolayId: z.string().trim().min(3).max(40),
        phone: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        address: addressSchema.optional().nullable(),
        cpf: z.string().optional().nullable(),
        rg: z.string().optional().nullable(),
        guardians: z.array(guardianUpdateSchema).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "submit_lobby_member_cadastro" as never,
      {
        _token: data.token,
        _demolay_id: data.demolayId,
        _phone: data.phone ?? null,
        _email: data.email ?? null,
        _address: data.address ?? null,
        _cpf: data.cpf ?? null,
        _rg: data.rg ?? null,
        _guardians: data.guardians ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    return payload as { ok: boolean; changed: boolean; member_id: string };
  });
