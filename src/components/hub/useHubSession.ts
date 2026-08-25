import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  REALM_CARD_BLURB,
  REALM_LABELS,
  REALMS,
  getClientRealm,
  getRealmForOrgType,
  realmEntryUrl,
  type Realm,
} from "@/lib/realm";

export type HubSession =
  | { kind: "anon" }
  | { kind: "redirecting"; realm: Realm }
  | { kind: "choose"; realms: Realm[] };

const HUB_AUTO_REALM_KEY = "tv.hub.autoRealm";

function readAutoRealmGuard(): string | null {
  try {
    return sessionStorage.getItem(HUB_AUTO_REALM_KEY);
  } catch {
    return null;
  }
}

function writeAutoRealmGuard(realm: Realm) {
  try {
    sessionStorage.setItem(HUB_AUTO_REALM_KEY, realm);
  } catch {
    // sessionStorage pode falhar em modo restrito
  }
}

function isCurrentEntryUrl(target: string): boolean {
  const here = window.location;
  const abs = new URL(target, here.href);
  const destPath = abs.pathname.replace(/\/$/, "") || "/";
  const herePath = here.pathname.replace(/\/$/, "") || "/";
  return abs.origin === here.origin && destPath === herePath;
}

/**
 * Sessão do hub. Começa em `anon` (SSR + SEO da landing).
 * No cliente, se houver sessão, redireciona ou oferece escolha de esfera.
 */
export function useHubSession(): HubSession {
  const hostRealm = getClientRealm();
  const [status, setStatus] = useState<HubSession>({ kind: "anon" });

  useEffect(() => {
    if (hostRealm) {
      window.location.replace("/inicio");
    }
  }, [hostRealm]);

  useEffect(() => {
    if (hostRealm) return;
    let cancelled = false;
    async function run() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (!cancelled) setStatus({ kind: "anon" });
        return;
      }
      const { data, error } = await supabase
        .from("chapter_members")
        .select("chapter:chapters(org_type)")
        .eq("user_id", user.id)
        .eq("active", true);
      if (cancelled) return;
      if (error) {
        setStatus({ kind: "anon" });
        return;
      }
      const realms = new Set<Realm>();
      for (const row of data ?? []) {
        const chapter = row.chapter as
          | { org_type?: string }
          | { org_type?: string }[]
          | null;
        const orgType = Array.isArray(chapter)
          ? chapter[0]?.org_type
          : chapter?.org_type;
        const realm = getRealmForOrgType(orgType);
        if (realm) realms.add(realm);
      }
      const list = REALMS.filter((r) => realms.has(r));
      if (list.length === 1) {
        const only = list[0]!;
        const target = realmEntryUrl(only);
        if (readAutoRealmGuard() === only || isCurrentEntryUrl(target)) {
          setStatus({ kind: "choose", realms: list });
          return;
        }
        writeAutoRealmGuard(only);
        setStatus({ kind: "redirecting", realm: only });
        window.location.assign(target);
        return;
      }
      setStatus({ kind: "choose", realms: list });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [hostRealm]);

  return status;
}

export function useHighlightedRealms(status: HubSession) {
  return useMemo(() => {
    if (status.kind === "choose") return new Set(status.realms);
    return new Set<Realm>();
  }, [status]);
}
