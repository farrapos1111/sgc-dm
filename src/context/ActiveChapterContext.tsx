import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { getClientRealm, getRealmForOrgType } from "@/lib/realm";

export type Membership = {
  id: string;
  chapter_id: string;
  role_id: number;
  chapter: {
    id: string;
    name: string;
    number: string;
    city: string | null;
    primary_color: string;
    logo_url: string | null;
    org_type?: string | null;
    settings?: Record<string, any> | null;
  };
  role: {
    id: number;
    name: string;
    label: string;
  };
};

/** Ordem preferencial das visões de cargo no seletor (setinhas). */
export const ROLE_VIEW_ORDER: RoleName[] = [
  "mestre_conselheiro",
  "escrivao",
  "tesoureiro",
  "presidente_comissao",
  "membro",
  "consultor",
  "presidente_conselho",
  "admin_total",
];

type ActiveChapterContextValue = {
  memberships: Membership[];
  /** Vínculos em outros realms (ex.: Loja quando o host é ODM). */
  otherRealmMemberships: Membership[];
  loading: boolean;
  activeChapterId: string | null;
  active: Membership | null;
  /** Nome completo do perfil (auth). */
  profileFullName: string | null;
  /** Papel real do vínculo (sem override de visão). */
  realRoleName: string | null;
  /** Há múltiplos papéis distintos no capítulo ativo — pode alternar visão. */
  canSwitchRoleView: boolean;
  /** Há 2+ instituições distintas — pode ciclar capítulo. */
  canSwitchChapter: boolean;
  setActiveChapterId: (id: string | null) => void;
  cycleRoleView: () => string;
  /** Cicla instituição ativa; retorna o nome do capítulo escolhido. */
  cycleChapter: (direction: "prev" | "next") => string;
  refetch: () => void;
};

/** Legado — não usar. Capítulos multi-filiados não persistem entre logins. */
const LEGACY_STORAGE_KEY = "sgcdm.activeChapterId";
/** Escolha só na aba/sessão atual; limpa no logout. */
const SESSION_KEY = "sgcdm.sessionChapterId";
/** Legado global — migrado para chave por capítulo. */
const LEGACY_ROLE_VIEW_KEY = "sgcdm.roleView";
const ROLE_VIEW_PREFIX = "sgcdm.roleView.";

export function clearChapterSessionStorage() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ROLE_VIEW_KEY);
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(ROLE_VIEW_PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) window.localStorage.removeItem(k);
}

const ActiveChapterContext = createContext<ActiveChapterContextValue | null>(
  null,
);

function roleViewStorageKey(chapterId: string): string {
  return `${ROLE_VIEW_PREFIX}${chapterId}`;
}

function readStoredRoleView(chapterId: string | null): RoleName | null {
  if (typeof window === "undefined" || !chapterId) return null;
  window.localStorage.removeItem(LEGACY_ROLE_VIEW_KEY);
  const raw = window.localStorage.getItem(roleViewStorageKey(chapterId));
  if (!raw) return null;
  return (ROLE_VIEW_ORDER as string[]).includes(raw) ? (raw as RoleName) : null;
}

function writeStoredRoleView(chapterId: string | null, name: RoleName | null) {
  if (typeof window === "undefined" || !chapterId) return;
  window.localStorage.removeItem(LEGACY_ROLE_VIEW_KEY);
  const key = roleViewStorageKey(chapterId);
  if (name) window.localStorage.setItem(key, name);
  else window.localStorage.removeItem(key);
}

function readSessionChapterId(): string | null {
  if (typeof window === "undefined") return null;
  // Remove persistência antiga entre logins.
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  return window.sessionStorage.getItem(SESSION_KEY);
}

function roleViewsForChapter(
  memberships: Membership[],
  chapterId: string | null,
): RoleName[] {
  if (!chapterId) return [];
  const names = new Set<string>();
  for (const m of memberships) {
    if (m.chapter_id === chapterId) names.add(m.role.name);
  }
  return ROLE_VIEW_ORDER.filter((r) => names.has(r)).concat(
    [...names].filter(
      (n) => !(ROLE_VIEW_ORDER as string[]).includes(n),
    ) as RoleName[],
  );
}

/** Preferência estável: membro base primeiro (poder vem dos cargos); senão ROLE_VIEW_ORDER. */
function pickPreferredMembership(
  memberships: Membership[],
  chapterId: string,
): Membership | null {
  const inChapter = memberships.filter((m) => m.chapter_id === chapterId);
  if (inChapter.length === 0) return null;
  const membro = inChapter.find((m) => m.role.name === "membro");
  if (membro) return membro;
  for (const role of ROLE_VIEW_ORDER) {
    const match = inChapter.find((m) => m.role.name === role);
    if (match) return match;
  }
  return inChapter[0] ?? null;
}

const RBAC_QUERY_PREFIXES = [
  "my-positions",
  "my-commissions",
  "sindicancia-access",
  "my-chapter-access-labels",
] as const;

export function ActiveChapterProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["memberships", userId],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("chapter_members")
        .select(
          "id, chapter_id, role_id, active, chapter:chapters(id, name, number, city, primary_color, logo_url, org_type, settings), role:roles(id, name, label)",
        )
        .eq("user_id", userId)
        .eq("active", true);
      if (error) throw error;
      // Vínculo ativo em chapter_members é a fonte de verdade.
      // Não filtrar por platform_org_type_has_any_view: a matriz de Loja/outras
      // esferas pode estar com can_view=false e escondia a instituição inteira.
      return (data ?? []) as unknown as Membership[];
    },
  });

  const allMemberships = data ?? [];
  const hostRealm = getClientRealm();
  const memberships = hostRealm
    ? allMemberships.filter(
        (m) => getRealmForOrgType(m.chapter.org_type) === hostRealm,
      )
    : allMemberships;
  const otherRealmMemberships = hostRealm
    ? allMemberships.filter(
        (m) => getRealmForOrgType(m.chapter.org_type) !== hostRealm,
      )
    : [];

  const { data: profile } = useQuery({
    queryKey: ["profile-active-chapter", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("active_chapter_id, full_name")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
  });

  const profileFullName = profile?.full_name ?? null;

  const [activeChapterId, setActiveChapterIdState] = useState<string | null>(
    () => readSessionChapterId(),
  );
  const activeChapterIdRef = useRef(activeChapterId);

  const [roleView, setRoleViewState] = useState<RoleName | null>(() =>
    readStoredRoleView(readSessionChapterId()),
  );

  const setRoleView = useCallback(
    (name: RoleName | null, chapterId: string | null = activeChapterId) => {
      setRoleViewState(name);
      writeStoredRoleView(chapterId, name);
    },
    [activeChapterId],
  );

  const invalidateRbacQueries = useCallback(() => {
    for (const prefix of RBAC_QUERY_PREFIXES) {
      void queryClient.resetQueries({ queryKey: [prefix] });
    }
  }, [queryClient]);

  // Sessão atual apenas — multi-filiado escolhe de novo a cada login.
  const setActiveChapterId = useCallback(
    (id: string | null) => {
      if (id) {
        const realm = getClientRealm();
        if (realm) {
          const target = allMemberships.find((m) => m.chapter_id === id);
          if (
            target &&
            getRealmForOrgType(target.chapter.org_type) !== realm
          ) {
            return;
          }
        }
      }
      const prev = activeChapterIdRef.current;
      activeChapterIdRef.current = id;
      if (prev !== id) {
        // Carrega roleView keyed pelo novo capítulo; não apaga o do anterior.
        const nextView = readStoredRoleView(id);
        setRoleViewState(nextView);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(LEGACY_ROLE_VIEW_KEY);
        }
        invalidateRbacQueries();
      }
      setActiveChapterIdState(id);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (id) window.sessionStorage.setItem(SESSION_KEY, id);
        else window.sessionStorage.removeItem(SESSION_KEY);
      }
      if (userId) {
        supabase
          .from("profiles")
          .update({ active_chapter_id: id })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) console.error("Erro ao salvar capítulo ativo:", error);
          });
      }
    },
    [userId, invalidateRbacQueries, data],
  );

  // Auto-seleciona (1 capítulo) ou valida o capítulo ativo (2+).
  // Multi-filiado: NÃO restaura do perfil — exige escolha se a sessão não tiver.
  useEffect(() => {
    if (isLoading) return;
    if (memberships.length === 0) {
      if (activeChapterId) setActiveChapterId(null);
      return;
    }
    const distinctChapterIds = [
      ...new Set(memberships.map((m) => m.chapter_id)),
    ];
    if (distinctChapterIds.length === 1) {
      const only = distinctChapterIds[0]!;
      if (activeChapterId !== only) {
        setActiveChapterId(only);
      }
      return;
    }
    if (
      activeChapterId &&
      !memberships.some((m) => m.chapter_id === activeChapterId)
    ) {
      setActiveChapterId(null);
    }
  }, [isLoading, memberships, activeChapterId, setActiveChapterId]);

  const chapterRoleViews = useMemo(
    () => roleViewsForChapter(memberships, activeChapterId),
    [memberships, activeChapterId],
  );

  const canSwitchRoleView = chapterRoleViews.length > 1;

  // Alinha roleView ao capítulo ativo (chave por capítulo).
  useEffect(() => {
    if (!activeChapterId) {
      if (roleView) setRoleView(null, null);
      return;
    }
    const stored = readStoredRoleView(activeChapterId);
    if (stored && chapterRoleViews.includes(stored)) {
      if (roleView !== stored) setRoleViewState(stored);
      return;
    }
    if (roleView && !chapterRoleViews.includes(roleView)) {
      setRoleView(null, activeChapterId);
    }
  }, [activeChapterId, chapterRoleViews, roleView, setRoleView]);

  const realMembership = useMemo(() => {
    if (!activeChapterId) return null;
    if (roleView && chapterRoleViews.includes(roleView)) {
      const match = memberships.find(
        (m) => m.chapter_id === activeChapterId && m.role.name === roleView,
      );
      if (match) return match;
    }
    return pickPreferredMembership(memberships, activeChapterId);
  }, [memberships, activeChapterId, roleView, chapterRoleViews]);

  const realRoleName = realMembership?.role.name ?? null;

  const effectiveRoleView =
    roleView && chapterRoleViews.includes(roleView) ? roleView : null;

  const active = useMemo(() => {
    if (!realMembership) return null;
    if (!canSwitchRoleView || !effectiveRoleView) return realMembership;
    if (effectiveRoleView === realMembership.role.name) return realMembership;
    const label = ROLE_LABELS[effectiveRoleView] ?? effectiveRoleView;
    return {
      ...realMembership,
      role: {
        ...realMembership.role,
        name: effectiveRoleView,
        label,
      },
    };
  }, [realMembership, canSwitchRoleView, effectiveRoleView]);

  const cycleRoleView = useCallback(() => {
    if (chapterRoleViews.length === 0) {
      return realRoleName
        ? (ROLE_LABELS[realRoleName as RoleName] ?? realRoleName)
        : "";
    }
    const current = (effectiveRoleView ??
      realRoleName ??
      chapterRoleViews[0]) as string;
    const idx = chapterRoleViews.findIndex((r) => r === current);
    const next =
      chapterRoleViews[(idx + 1) % chapterRoleViews.length] ??
      chapterRoleViews[0];
    setRoleView(next, activeChapterId);
    return ROLE_LABELS[next] ?? next;
  }, [
    chapterRoleViews,
    effectiveRoleView,
    realRoleName,
    setRoleView,
    activeChapterId,
  ]);

  const distinctChapters = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; name: string; number: string }
    >();
    for (const m of memberships) {
      if (!byId.has(m.chapter_id)) {
        byId.set(m.chapter_id, {
          id: m.chapter_id,
          name: m.chapter.name,
          number: m.chapter.number,
        });
      }
    }
    return [...byId.values()].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, "pt-BR", {
        sensitivity: "base",
      });
      if (byName !== 0) return byName;
      return a.number.localeCompare(b.number, "pt-BR", { numeric: true });
    });
  }, [memberships]);

  const canSwitchChapter = distinctChapters.length > 1;

  const cycleChapter = useCallback(
    (direction: "prev" | "next") => {
      if (distinctChapters.length === 0) return "";
      const idx = distinctChapters.findIndex((c) => c.id === activeChapterId);
      const from = idx >= 0 ? idx : 0;
      const delta = direction === "next" ? 1 : -1;
      const next =
        distinctChapters[
          (from + delta + distinctChapters.length) % distinctChapters.length
        ]!;
      setActiveChapterId(next.id);
      return next.name;
    },
    [distinctChapters, activeChapterId, setActiveChapterId],
  );

  const value = useMemo<ActiveChapterContextValue>(
    () => ({
      memberships,
      otherRealmMemberships,
      loading: isLoading,
      activeChapterId,
      active,
      profileFullName,
      realRoleName,
      canSwitchRoleView,
      canSwitchChapter,
      setActiveChapterId,
      cycleRoleView,
      cycleChapter,
      refetch,
    }),
    [
      memberships,
      otherRealmMemberships,
      isLoading,
      activeChapterId,
      active,
      profileFullName,
      realRoleName,
      canSwitchRoleView,
      canSwitchChapter,
      setActiveChapterId,
      cycleRoleView,
      cycleChapter,
      refetch,
    ],
  );

  return (
    <ActiveChapterContext.Provider value={value}>
      {children}
    </ActiveChapterContext.Provider>
  );
}

export function useActiveChapter() {
  const ctx = useContext(ActiveChapterContext);
  if (!ctx)
    throw new Error(
      "useActiveChapter deve ser usado dentro de ActiveChapterProvider",
    );
  return ctx;
}
