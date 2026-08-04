import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  expectedMinutePublicPassword,
  isMinuteKind,
  type MinuteKind,
} from "@/lib/minute-kinds";

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
    kind?: MinuteKind | string | null;
    updated_at: string;
    voting_open: boolean;
  };
  chapter: PublicMinuteChapter;
  event: PublicMinuteEvent;
  unlocked_by?: "password" | "member";
  demolay_id?: string | null;
  member_name?: string | null;
};

export type PublicMinutePeek = {
  kind: MinuteKind | string;
  status: string;
  voting_open: boolean;
  chapter: PublicMinuteChapter;
  event: PublicMinuteEvent;
};

export type PublicMinuteMemberResult =
  | (PublicMinutePayload & { locked: false })
  | {
      locked: true;
      kind: MinuteKind | string;
      member_name: string;
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

export type PublicMinuteUnlock =
  | { mode: "password"; password: string }
  | { mode: "member"; demolayId: string };

export function readPublicMinuteUnlock(storageKey: string): PublicMinuteUnlock | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (obj.mode === "password" && typeof obj.password === "string" && obj.password) {
        return { mode: "password", password: obj.password };
      }
      if (obj.mode === "member" && typeof obj.demolayId === "string" && obj.demolayId) {
        return { mode: "member", demolayId: obj.demolayId };
      }
    }
    // legado: JSON.parse de senha numérica ou string pura
    if (typeof parsed === "string" || typeof parsed === "number") {
      const legacy = String(parsed).trim();
      if (legacy) return { mode: "password", password: legacy };
    }
  } catch {
    // legado: valor era só a senha em texto
    if (raw.trim()) return { mode: "password", password: raw };
  }
  return null;
}

export function writePublicMinuteUnlock(
  storageKey: string,
  unlock: PublicMinuteUnlock,
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey, JSON.stringify(unlock));
}

export const ensureMinutePublicShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    minuteIdInput.extend({ regenerate: z.boolean().optional().default(false) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: minute, error: mErr } = await context.supabase
      .from("session_minutes")
      .select("id, chapter_id, kind")
      .eq("id", data.minuteId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!minute) throw new Error("Ata não encontrada");

    const { data: chapter, error: chErr } = await context.supabase
      .from("chapters")
      .select("settings")
      .eq("id", minute.chapter_id)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);

    const kind: MinuteKind = isMinuteKind(minute.kind) ? minute.kind : "publica";
    const password = expectedMinutePublicPassword(
      (chapter?.settings as Record<string, unknown> | null) ?? null,
      kind,
    );
    if (!password) {
      throw new Error(
        "Configure a senha deste tipo de ata em Configurações → Secretaria",
      );
    }

    const { data: token, error } = await context.supabase.rpc(
      "ensure_minute_public_share_token",
      { _minute_id: data.minuteId, _regenerate: data.regenerate },
    );
    if (error) throw new Error(error.message);
    return {
      token: token as string,
      password,
      kind,
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
    return {
      ...(payload as PublicMinutePayload),
      unlocked_by: "password" as const,
    };
  });

export const peekPublicMinute = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ token: z.string().trim().min(32).max(128) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc("peek_public_minute", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    return payload as PublicMinutePeek;
  });

export const getPublicMinuteByMember = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().trim().min(32).max(128),
        demolayId: z.string().trim().min(1).max(64),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_minute_by_member",
      { _token: data.token, _demolay_id: data.demolayId },
    );
    if (error) throw new Error(error.message);
    return payload as PublicMinuteMemberResult;
  });

export const submitPublicMinuteVote = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().trim().min(32).max(128),
        password: z.string().max(64).optional().nullable(),
        demolayId: z.string().trim().max(64).optional().nullable(),
        email: z.string().trim().email().max(200),
        decision: z.enum(["aprovada", "reprovada"]),
        justification: z.string().trim().max(2000).optional().nullable(),
      })
      .superRefine((val, ctx) => {
        if (!val.password?.trim() && !val.demolayId?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe a senha ou o ID DeMolay",
            path: ["password"],
          });
        }
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
    const { data: payload, error } = await supabase.rpc(
      "submit_public_minute_vote",
      {
        _token: data.token,
        _password: data.password ?? "",
        _email: data.email,
        _decision: data.decision,
        _justification: data.justification ?? undefined,
        _demolay_id: data.demolayId ?? undefined,
      },
    );
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
