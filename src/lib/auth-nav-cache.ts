import { isRedirect, redirect } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  getMemberLoginGate,
  getMustChangePassword,
} from "@/lib/accounts.functions";
import { needsSignatureForOffices } from "@/lib/office-signatures.functions";

/** Evita 3–4 RPCs em série a cada troca de tela. */
const AUTH_NAV_TTL_MS = 5 * 60 * 1000;

type AuthNavCache = {
  userId: string;
  allowed: boolean;
  mustChangePassword: boolean;
  needsSignature: boolean;
  checkedAt: number;
};

let cache: AuthNavCache | null = null;
let inflight: Promise<AuthNavCache> | null = null;

export function clearAuthNavCache() {
  cache = null;
  inflight = null;
}

/** Pós-login: carga completa evita 404 do Start em rotas `ssr: false`. */
export function enterAuthenticatedApp(path = "/inicio") {
  clearAuthNavCache();
  if (typeof window !== "undefined") {
    window.location.assign(path);
  }
}

function applyCachedRedirects(entry: AuthNavCache): void {
  if (!entry.allowed) {
    throw redirect({
      to: "/auth",
      search: { reason: "irregular" },
      reloadDocument: true,
    });
  }
  if (entry.mustChangePassword) {
    throw redirect({ to: "/auth/redefinir-senha", reloadDocument: true });
  }
  if (entry.needsSignature) {
    throw redirect({ to: "/auth/assinatura", reloadDocument: true });
  }
}

async function fetchAuthNavGates(userId: string): Promise<AuthNavCache> {
  const [gateSettled, pwdSettled, sigSettled] = await Promise.allSettled([
    getMemberLoginGate(),
    getMustChangePassword(),
    needsSignatureForOffices(),
  ]);

  let allowed = true;
  if (gateSettled.status === "fulfilled") {
    allowed = Boolean(gateSettled.value.allowed);
  } else if (!isRedirect(gateSettled.reason)) {
    // Fail-open no gate (igual ao beforeLoad antigo que engolia erros não-redirect)
    console.error("[auth-nav] login gate failed", gateSettled.reason);
  }

  let mustChangePassword = false;
  if (pwdSettled.status === "fulfilled") {
    mustChangePassword = Boolean(pwdSettled.value.mustChangePassword);
  } else if (!isRedirect(pwdSettled.reason)) {
    console.error("[auth-nav] mustChangePassword failed", pwdSettled.reason);
  }

  let needsSignature = false;
  if (sigSettled.status === "fulfilled") {
    needsSignature = Boolean(sigSettled.value.needsSignature);
  } else if (isRedirect(sigSettled.reason)) {
    throw sigSettled.reason;
  } else {
    // Assinatura: não bloquear navegação se a RPC falhar (rede)
    console.error("[auth-nav] office signature check failed", sigSettled.reason);
  }

  return {
    userId,
    allowed,
    mustChangePassword,
    needsSignature,
    checkedAt: Date.now(),
  };
}

/**
 * beforeLoad autenticado: sessão local + gates com TTL/cache.
 * Trocas de tela dentro do TTL não disparam RPCs de gate.
 */
export async function runAuthenticatedBeforeLoad(): Promise<{ user: User }> {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user ?? null;

  if (!user) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: {}, reloadDocument: true });
    }
    user = data.user;
  }

  const now = Date.now();
  if (
    cache &&
    cache.userId === user.id &&
    now - cache.checkedAt < AUTH_NAV_TTL_MS
  ) {
    try {
      applyCachedRedirects(cache);
    } catch (e) {
      if (isRedirect(e) && !cache.allowed) {
        clearAuthNavCache();
        await supabase.auth.signOut();
      }
      throw e;
    }
    return { user };
  }

  if (!inflight || cache?.userId !== user.id) {
    inflight = fetchAuthNavGates(user.id).finally(() => {
      inflight = null;
    });
  }

  const entry = await inflight;
  cache = entry;

  try {
    applyCachedRedirects(entry);
  } catch (e) {
    if (isRedirect(e) && !entry.allowed) {
      clearAuthNavCache();
      await supabase.auth.signOut();
    }
    throw e;
  }

  return { user };
}
