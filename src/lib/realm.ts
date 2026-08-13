import {
  ORG_TYPE_LABELS,
  normalizeOrgType,
  type OrgType,
} from "@/lib/org-types";

export const REALMS = ["odm", "fdj", "lodge"] as const;
export type Realm = (typeof REALMS)[number];

export const REALM_ORG_TYPES: Record<Realm, readonly OrgType[]> = {
  odm: ["capitulo", "alumni", "castelo", "priorado"],
  fdj: ["bethel"],
  lodge: ["loja"],
};

export const REALM_LABELS: Record<Realm, string> = {
  odm: "ODM",
  fdj: "Bethel",
  lodge: "Loja",
};

export const REALM_CARD_BLURB: Record<Realm, string> = {
  odm: "Gestão para Capítulos DeMolay, Colégios Alumni, Castelos e Priorados.",
  fdj: "Gestão para Bethéis da Filha de Jó.",
  lodge: "Gestão completa para Lojas Maçônicas.",
};

const ORG_TYPE_TO_REALM: Record<OrgType, Realm | null> = {
  capitulo: "odm",
  alumni: "odm",
  castelo: "odm",
  priorado: "odm",
  bethel: "fdj",
  loja: "lodge",
  arco_iris: null,
  apj: null,
  outro: null,
};

export function isRealm(value: string | null | undefined): value is Realm {
  return Boolean(value && (REALMS as readonly string[]).includes(value));
}

/** Realm derivado do tipo — nunca do subdomínio. */
export function getRealmForOrgType(
  orgType: string | null | undefined,
): Realm | null {
  if (!orgType) return null;
  if (!(orgType in ORG_TYPE_TO_REALM)) return null;
  return ORG_TYPE_TO_REALM[orgType as OrgType];
}

export function orgTypesForRealm(realm: Realm): readonly OrgType[] {
  return REALM_ORG_TYPES[realm];
}

export function orgTypeBelongsToRealm(
  orgType: string | null | undefined,
  realm: Realm,
): boolean {
  return getRealmForOrgType(orgType) === realm;
}

const SUBDOMAIN_TO_REALM: Record<string, Realm> = {
  odm: "odm",
  fdj: "fdj",
  lodge: "lodge",
};

function hostnameWithoutPort(host: string): string {
  return host.trim().toLowerCase().split(":")[0] ?? "";
}

function isLocalApexHostname(hostname: string): boolean {
  const h = hostnameWithoutPort(hostname);
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * Apex e www = hub (null). Prefixo odm/fdj/lodge = realm.
 * `devOverride` só vale em localhost / 127.0.0.1 (sem prefixo de realm).
 */
export function resolveRealmFromHost(
  host: string,
  devOverride?: string | null,
): Realm | null {
  const hostname = hostnameWithoutPort(host);
  const first = hostname.split(".")[0] ?? "";
  if (first in SUBDOMAIN_TO_REALM && hostname.includes(".")) {
    return SUBDOMAIN_TO_REALM[first];
  }
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  if (isLocal && isRealm(devOverride ?? null)) {
    return devOverride as Realm;
  }
  return null;
}

export function getDevRealmOverride(): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DEV_REALM) {
    return String(import.meta.env.VITE_DEV_REALM);
  }
  if (typeof process !== "undefined" && process.env?.VITE_DEV_REALM) {
    return process.env.VITE_DEV_REALM;
  }
  return undefined;
}

/** Realm no browser (hostname + VITE_DEV_REALM em localhost). */
export function getClientRealm(): Realm | null {
  if (typeof window === "undefined") return null;
  return resolveRealmFromHost(
    window.location.hostname,
    getDevRealmOverride(),
  );
}

export function isHubHost(host?: string): boolean {
  if (host) {
    return resolveRealmFromHost(host, getDevRealmOverride()) === null;
  }
  return getClientRealm() === null;
}

function apexFromHostname(hostname: string): string {
  const h = hostnameWithoutPort(hostname);
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
    return "localhost";
  }
  return h.replace(/^(www|odm|fdj|lodge)\./, "");
}

/** Origem absoluta do hub (apex). */
export function hubAbsoluteUrl(fromHostname?: string): string {
  if (typeof window !== "undefined") {
    const hostname = fromHostname ?? window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : "";
    const proto = window.location.protocol;
    const apex = apexFromHostname(hostname);
    if (apex === "localhost") return `${proto}//localhost${port}`;
    return `${proto}//${apex}${port}`;
  }
  return "https://templovirtual.app";
}

/** Origem absoluta de um subdomínio de realm. */
export function realmAbsoluteUrl(realm: Realm, fromHostname?: string): string {
  if (typeof window !== "undefined") {
    const hostname = fromHostname ?? window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : "";
    const proto = window.location.protocol;
    const apex = apexFromHostname(hostname);
    if (apex === "localhost") return `${proto}//${realm}.localhost${port}`;
    return `${proto}//${realm}.${apex}${port}`;
  }
  return `https://${realm}.templovirtual.app`;
}

/**
 * URL para entrar no app de um realm.
 * Em localhost o Vite não atende `odm.localhost` — fica no mesmo origin.
 */
export function realmEntryUrl(realm: Realm, fromHostname?: string): string {
  if (typeof window !== "undefined") {
    const hostname = fromHostname ?? window.location.hostname;
    if (isLocalApexHostname(hostname)) return "/inicio";
  }
  return realmAbsoluteUrl(realm, fromHostname);
}

export function orgTypeDisplayLabel(orgType: string | null | undefined): string {
  return ORG_TYPE_LABELS[normalizeOrgType(orgType)];
}
