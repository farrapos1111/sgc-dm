import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase não configurado");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

export type CadastroLookupMember = {
  id: string;
  chapter_id: string;
  chapter_name: string | null;
  full_name: string;
  birth_date: string | null;
  status: string;
  kind: string;
  demolay_id: string | null;
  masonic_id: string | null;
  phone: string;
  email: string;
  address: Record<string, string>;
  cpf_last2: string | null;
  rg_last2: string | null;
  iniciacao_ordem: string | null;
  exam_grau_iniciatico: string | null;
  iniciacao_grau_demolay: string | null;
  exam_grau_demolay: string | null;
};

export type CadastroLookupGuardian = {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string;
  cpf_last2: string | null;
  is_primary: boolean;
};

export const lookupMemberCadastro = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ demolayId: z.string().trim().min(3).max(40) }).parse(raw))
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "lookup_member_cadastro_by_demolay_id" as never,
      { _demolay_id: data.demolayId } as never,
    );
    if (error) throw new Error(error.message);
    const result = payload as {
      member: CadastroLookupMember;
      guardians: CadastroLookupGuardian[];
    };
    return {
      member: result.member,
      guardians: result.guardians ?? [],
    };
  });

export const submitMemberCadastro = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        demolayId: z.string().trim().min(3).max(40),
        phone: z.string().optional().default(""),
        email: z.string().optional().default(""),
        address: addressSchema,
        cpf: z.string().optional().default(""),
        rg: z.string().optional().default(""),
        guardians: z.array(guardianUpdateSchema).max(2).optional().default([]),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "submit_member_cadastro_update" as never,
      {
        _demolay_id: data.demolayId,
        _phone: data.phone || null,
        _email: data.email || null,
        _address: data.address,
        _cpf: data.cpf || null,
        _rg: data.rg || null,
        _guardians: data.guardians,
      } as never,
    );
    if (error) throw new Error(error.message);
    return payload as { ok: boolean; changed: boolean; member_id: string };
  });
