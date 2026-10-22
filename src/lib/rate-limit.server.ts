import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Escopos extras de auth_login_throttle usados como cota (não só falha de login). */
export type QuotaScope = "password_reset" | "ai";

export function hashQuotaKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Consome uma unidade da cota `max` por janela `windowMs` para (scope, key).
 * Retorna false quando a cota já está esgotada (bloqueada até o fim da janela).
 */
export async function takeQuota(
  scope: QuotaScope,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const { data: row, error } = await supabaseAdmin
    .from("auth_login_throttle" as never)
    .select("locked_until")
    .eq("scope", scope)
    .eq("scope_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const lockedUntil = (row as { locked_until: string | null } | null)?.locked_until;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) return false;

  const { error: recErr } = await supabaseAdmin.rpc(
    "record_login_throttle_failure" as never,
    {
      _scope: scope,
      _scope_key: key,
      _max_fails: max,
      _window_ms: windowMs,
      _lock_ms: windowMs,
    } as never,
  );
  if (recErr) throw new Error(recErr.message);
  return true;
}
