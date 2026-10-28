import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Escopos extras de auth_login_throttle usados como cota (não só falha de login). */
export type QuotaScope = "password_reset" | "ai" | "lobby_portal";

export function hashQuotaKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Consome uma unidade da cota `max` por janela `windowMs` para (scope, key).
 * Retorna false quando a cota já está esgotada (bloqueada até o fim da janela).
 * Atômico no banco (take_rate_quota): rajadas concorrentes não passam do limite.
 */
export async function takeQuota(
  scope: QuotaScope,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "take_rate_quota" as never,
    {
      _scope: scope,
      _scope_key: key,
      _max: max,
      _window_ms: windowMs,
    } as never,
  );
  if (error) throw new Error(error.message);
  return data === true;
}

/** true enquanto (scope, key) estiver bloqueado por excesso de falhas. */
export async function isQuotaLocked(scope: QuotaScope, key: string): Promise<boolean> {
  const { data: row, error } = await supabaseAdmin
    .from("auth_login_throttle" as never)
    .select("locked_until")
    .eq("scope", scope)
    .eq("scope_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const lockedUntil = (row as { locked_until: string | null } | null)?.locked_until;
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
}

/** Registra uma falha; após `max` na janela, bloqueia pelo mesmo período. */
export async function recordQuotaFailure(
  scope: QuotaScope,
  key: string,
  max: number,
  windowMs: number,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc(
    "record_login_throttle_failure" as never,
    {
      _scope: scope,
      _scope_key: key,
      _max_fails: max,
      _window_ms: windowMs,
      _lock_ms: windowMs,
    } as never,
  );
  if (error) throw new Error(error.message);
}
