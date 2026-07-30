import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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

export type PublicCashChapter = {
  id: string;
  name: string;
  number: string;
  city: string | null;
  logo_url: string | null;
  primary_color: string | null;
  founded_at: string | null;
};

export type PublicCashEntry = {
  id: string;
  kind: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount: number | string;
  entry_date: string;
  created_at: string;
};

export type PublicCashFlowPayload = {
  chapter: PublicCashChapter;
  year: number;
  month: number | null;
  entries: PublicCashEntry[];
  entries_total?: number;
  entries_truncated?: boolean;
  opening: { balance: number; previousYear: number };
  totals?: { income: number; expense: number; balance: number };
  bank: { income: number; expense: number; balance: number };
  signers: Array<{ role: string; name: string }>;
  logoDataUrl: string | null;
};

/** Obtém o token atual (ou null se ainda não gerado). */
export const getCashShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "get_cash_share_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { token: (token as string | null) ?? null };
  });

/** Garante um token (cria se não existir; regenera se solicitado). */
export const ensureCashShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ regenerate: z.boolean().optional().default(false) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "ensure_cash_share_token" as never,
      { _chapter_id: data.chapterId, _regenerate: data.regenerate } as never,
    );
    if (error) throw new Error(error.message);
    return { token: token as string };
  });

/** Revoga o link público. */
export const revokeCashShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "revoke_cash_share_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function tryLoadLogoDataUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !(serviceKey || anonKey)) return null;

  const client = createClient(url, serviceKey || anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.storage.from("chapter-logos").download(path);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const mime = data.type || "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Leitura pública do fluxo de caixa via token compartilhável. */
export const getPublicCashFlow = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().trim().min(32).max(128),
        year: z.number().int().min(1900).max(2100),
        month: z.number().int().min(1).max(12).nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_cash_flow" as never,
      {
        _token: data.token,
        _year: data.year,
        _month: data.month,
      } as never,
    );
    if (error) throw new Error(error.message);

    const result = payload as Omit<PublicCashFlowPayload, "logoDataUrl">;
    const logoDataUrl = await tryLoadLogoDataUrl(result.chapter?.logo_url);
    return { ...result, logoDataUrl } satisfies PublicCashFlowPayload;
  });
