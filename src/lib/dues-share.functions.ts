import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { memberInYearTable, type DueMemberLite } from "@/lib/dues-rules";
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

export type PublicDuesChapter = {
  id: string;
  name: string;
  number: string;
  city: string | null;
  primary_color: string | null;
  founded_at: string | null;
};

export type PublicDueRow = {
  id: string;
  member_id: string;
  amount: number | string;
  status: "em_aberto" | "pago" | "isento" | "desligado";
  paid_at: string | null;
  competence_year: number;
  competence_month: number;
};

export type PublicYearDuesPayload = {
  chapter: PublicDuesChapter;
  year: number;
  defaultAmount: number;
  members: DueMemberLite[];
  dues: PublicDueRow[];
};

export const getDuesShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "get_dues_share_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { token: (token as string | null) ?? null };
  });

export const ensureDuesShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ regenerate: z.boolean().optional().default(false) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "ensure_dues_share_token" as never,
      { _chapter_id: data.chapterId, _regenerate: data.regenerate } as never,
    );
    if (error) throw new Error(error.message);
    return { token: token as string };
  });

export const revokeDuesShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "revoke_dues_share_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Visualização pública anual das mensalidades (somente leitura). */
export const getPublicYearDues = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().trim().min(32).max(128),
        year: z.number().int().min(1900).max(2100),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_year_dues" as never,
      { _token: data.token, _year: data.year } as never,
    );
    if (error) throw new Error(error.message);

    const result = payload as {
      chapter: PublicDuesChapter;
      year: number;
      defaultAmount: number;
      members: DueMemberLite[];
      dues: PublicDueRow[];
    };

    const members = (result.members ?? []).filter(
      (m) => m.manualInclude === true || memberInYearTable(m, data.year),
    );
    const memberIds = new Set(members.map((m) => m.id));
    const dues = (result.dues ?? []).filter((d) => memberIds.has(d.member_id));

    return {
      chapter: result.chapter,
      year: data.year,
      defaultAmount: Number(result.defaultAmount) || 50,
      members,
      dues,
    } satisfies PublicYearDuesPayload;
  });
