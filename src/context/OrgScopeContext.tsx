import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMyOrgContext,
  type OrgLeadership,
  type OrgRoleName,
} from "@/lib/org.functions";

export type OrgScope = {
  key: string;
  type: "region" | "state";
  id: string;
  label: string;
  orgRole: OrgRoleName;
  chapterIds: string[];
  primaryColor?: string | null;
  logoUrl?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
};

type OrgScopeContextValue = {
  leaderships: OrgLeadership[];
  scopes: OrgScope[];
  loading: boolean;
  /** Escopo supra-capitular selecionado (null = navegando dentro de um capítulo). */
  activeScope: OrgScope | null;
  setActiveScopeKey: (key: string | null) => void;
  isGme: boolean;
  isMcr: boolean;
  isOe: boolean;
  /** Pode cadastrar regiões e lideranças GME/MCE. */
  canManageOrg: boolean;
  /** Pode criar/inativar instituições e membros do escopo (GME, MCR, OE). */
  canManageChapters: boolean;
  canAppointMcr: boolean;
  canAppointOe: boolean;
  /** Pode abrir a tela de lideranças (nomear ou ver). */
  canManageLeaderships: boolean;
};

const STORAGE_KEY = "sgcdm.activeOrgScope";

const OrgScopeContext = createContext<OrgScopeContextValue | null>(null);

const ROLE_PREFIX: Record<OrgRoleName, string> = {
  gme: "Grande Mestre Estadual",
  mce: "Mestre Conselheiro Estadual",
  mcr: "Mestre Conselheiro Regional",
  oe: "Oficial Executivo",
};

export function OrgScopeProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["org-context"],
    queryFn: () => getMyOrgContext(),
    staleTime: 60_000,
  });

  const leaderships = useMemo(() => data?.leaderships ?? [], [data]);

  const scopes = useMemo<OrgScope[]>(
    () =>
      leaderships
        .filter((l) => Boolean(l.region_id ?? l.state_id))
        .map((l) => {
          const type = l.region_id ? "region" : "state";
          const id = (l.region_id ?? l.state_id) as string;
          return {
            key: `${type}:${id}`,
            type: type as "region" | "state",
            id,
            label: l.region_name ?? l.state_name ?? "Escopo",
            orgRole: l.org_role,
            chapterIds: l.chapter_ids,
            primaryColor: l.region_primary_color ?? null,
            logoUrl: l.region_logo_url ?? null,
            startsOn: l.starts_on ?? null,
            endsOn: l.ends_on ?? null,
          };
        }),
    [leaderships],
  );

  const [activeScopeKey, setActiveScopeKeyState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(STORAGE_KEY);
    },
  );

  const setActiveScopeKey = useCallback((key: string | null) => {
    setActiveScopeKeyState(key);
    if (typeof window === "undefined") return;
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (isLoading || !activeScopeKey) return;
    if (!scopes.some((s) => s.key === activeScopeKey)) setActiveScopeKey(null);
  }, [isLoading, activeScopeKey, scopes, setActiveScopeKey]);

  const activeScope = useMemo(
    () => scopes.find((s) => s.key === activeScopeKey) ?? null,
    [scopes, activeScopeKey],
  );

  const isGme = leaderships.some((l) => l.org_role === "gme");
  const isMcr = leaderships.some((l) => l.org_role === "mcr");
  const isOe = leaderships.some((l) => l.org_role === "oe");
  const canManageOrg = isGme;
  const canManageChapters = isGme || isMcr || isOe;
  // Hierarquia: GME → ambos; MCR → MCR; OE → OE e MCR
  const canAppointMcr = isGme || isMcr || isOe;
  const canAppointOe = isGme || isOe;
  const canManageLeaderships = canAppointMcr || canAppointOe;

  const value = useMemo<OrgScopeContextValue>(
    () => ({
      leaderships,
      scopes,
      loading: isLoading,
      activeScope,
      setActiveScopeKey,
      isGme,
      isMcr,
      isOe,
      canManageOrg,
      canManageChapters,
      canAppointMcr,
      canAppointOe,
      canManageLeaderships,
    }),
    [
      leaderships,
      scopes,
      isLoading,
      activeScope,
      setActiveScopeKey,
      isGme,
      isMcr,
      isOe,
      canManageOrg,
      canManageChapters,
      canAppointMcr,
      canAppointOe,
      canManageLeaderships,
    ],
  );

  return (
    <OrgScopeContext.Provider value={value}>{children}</OrgScopeContext.Provider>
  );
}

export function useOrgScope() {
  const ctx = useContext(OrgScopeContext);
  if (!ctx)
    throw new Error("useOrgScope deve ser usado dentro de OrgScopeProvider");
  return ctx;
}

export { ROLE_PREFIX as ORG_ROLE_LABELS };
