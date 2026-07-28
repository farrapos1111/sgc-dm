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
import { getMyOrgContext, type OrgLeadership, type OrgRoleName } from "@/lib/org.functions";

export type OrgScope = {
  key: string;
  type: "region" | "state";
  id: string;
  label: string;
  orgRole: OrgRoleName;
  chapterIds: string[];
};

type OrgScopeContextValue = {
  leaderships: OrgLeadership[];
  scopes: OrgScope[];
  loading: boolean;
  /** Escopo supra-capitular selecionado (null = navegando dentro de um capítulo). */
  activeScope: OrgScope | null;
  setActiveScopeKey: (key: string | null) => void;
  isGme: boolean;
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

  const leaderships = useMemo(() => data ?? [], [data]);

  const scopes = useMemo<OrgScope[]>(
    () =>
      leaderships.map((l) => {
        const type = l.region_id ? "region" : "state";
        const id = (l.region_id ?? l.state_id) as string;
        return {
          key: `${type}:${id}`,
          type: type as "region" | "state",
          id,
          label: l.region_name ?? l.state_name ?? "Escopo",
          orgRole: l.org_role,
          chapterIds: l.chapter_ids,
        };
      }),
    [leaderships],
  );

  const [activeScopeKey, setActiveScopeKeyState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const setActiveScopeKey = useCallback((key: string | null) => {
    setActiveScopeKeyState(key);
    if (typeof window === "undefined") return;
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Descarta seleção inválida (liderança removida/expirada).
  useEffect(() => {
    if (isLoading || !activeScopeKey) return;
    if (!scopes.some((s) => s.key === activeScopeKey)) setActiveScopeKey(null);
  }, [isLoading, activeScopeKey, scopes, setActiveScopeKey]);

  const activeScope = useMemo(
    () => scopes.find((s) => s.key === activeScopeKey) ?? null,
    [scopes, activeScopeKey],
  );

  const value = useMemo<OrgScopeContextValue>(
    () => ({
      leaderships,
      scopes,
      loading: isLoading,
      activeScope,
      setActiveScopeKey,
      isGme: leaderships.some((l) => l.org_role === "gme"),
    }),
    [leaderships, scopes, isLoading, activeScope, setActiveScopeKey],
  );

  return <OrgScopeContext.Provider value={value}>{children}</OrgScopeContext.Provider>;
}

export function useOrgScope() {
  const ctx = useContext(OrgScopeContext);
  if (!ctx) throw new Error("useOrgScope deve ser usado dentro de OrgScopeProvider");
  return ctx;
}

export { ROLE_PREFIX as ORG_ROLE_LABELS };
