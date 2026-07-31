import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** Senha fixa temporária da visão pública da ata. */
export const MINUTE_PUBLIC_SHARE_PASSWORD = "senha";

export const minutePublicShareStorageKey = (token: string) =>
  `sgcdm.ata-public.${token}`;

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const minuteIdInput = z.object({ minuteId: z.string().uuid() });

export type PublicMinuteChapter = {
  id: string;
  name: string;
  number: string;
  city: string | null;
  primary_color: string | null;
};

export type PublicMinuteEvent = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
};

export type PublicMinutePayload = {
  minute: {
    id: string;
    content: string;
    status: string;
    title: string | null;
    updated_at: string;
    voting_open: boolean;
  };
  chapter: PublicMinuteChapter;
  event: PublicMinuteEvent;
};

export type MinutePublicVote = {
  id: string;
  email: string;
  decision: "aprovada" | "reprovada";
  justification: string | null;
  created_at: string;
  updated_at: string;
};

export const ensureMinutePublicShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    minuteIdInput.extend({ regenerate: z.boolean().optional().default(false) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "ensure_minute_public_share_token",
      { _minute_id: data.minuteId, _regenerate: data.regenerate },
    );
    if (error) throw new Error(error.message);
    return {
      token: token as string,
      password: MINUTE_PUBLIC_SHARE_PASSWORD,
    };
  });

export const getMinutePublicShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => minuteIdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "get_minute_public_share_token",
      { _minute_id: data.minuteId },
    );
    if (error) throw new Error(error.message);
    return { token: (token as string | null) ?? null };
  });

export const revokeMinutePublicShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => minuteIdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("revoke_minute_public_share_token", {
      _minute_id: data.minuteId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMinutePublicVotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => minuteIdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("minute_public_votes")
      .select("id, email, decision, justification, created_at, updated_at")
      .eq("minute_id", data.minuteId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as MinutePublicVote[];
  });

export const getPublicMinute = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().trim().min(32).max(128),
        password: z.string().min(1).max(64),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc("get_public_minute", {
      _token: data.token,
      _password: data.password,
    });
    if (error) throw new Error(error.message);
    return payload as PublicMinutePayload;
  });

export const submitPublicMinuteVote = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().trim().min(32).max(128),
        password: z.string().min(1).max(64),
        email: z.string().trim().email().max(200),
        decision: z.enum(["aprovada", "reprovada"]),
        justification: z.string().trim().max(2000).optional().nullable(),
      })
      .superRefine((val, ctx) => {
        if (val.decision === "reprovada" && !val.justification?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Justificativa obrigatória para reprovação",
            path: ["justification"],
          });
        }
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc("submit_public_minute_vote", {
      _token: data.token,
      _password: data.password,
      _email: data.email,
      _decision: data.decision,
      _justification: data.justification ?? undefined,
    });
    if (error) throw new Error(error.message);
    return payload as {
      ok: true;
      vote: {
        id: string;
        email: string;
        decision: "aprovada" | "reprovada";
        justification: string | null;
        updated_at: string;
      };
    };
  });
