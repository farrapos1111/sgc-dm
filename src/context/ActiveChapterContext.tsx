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
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";

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
  loading: boolean;
  activeChapterId: string | null;
  active: Membership | null;
  /** Nome completo do perfil (auth). */
  profileFullName: string | null;
  /** Papel real do vínculo (sem override de visão). */
  realRoleName: string | null;
  /** Há múltiplos papéis distintos no capítulo ativo — pode alternar visão. */
  canSwitchRoleView: boolean;
  /** Capítulos distintos com vínculo ativo (para seletor). */
  distinctChapters: { id: string; name: string; number: string }[];
  /** Há 2+ instituições distintas — pode trocar de capítulo. */
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
const ROLE_VIEW_KEY = "sgcdm.roleView";

export function clearChapterSessionStorage() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

const ActiveChapterContext = createContext<ActiveChapterContextValue | null>(
  null,
);

function readStoredRoleView(): RoleName | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ROLE_VIEW_KEY);
  if (!raw) return null;
  return (ROLE_VIEW_ORDER as string[]).includes(raw) ? (raw as RoleName) : null;
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

export function ActiveChapterProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["memberships", userId],
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("chapter_members")
        .select(
          "id, chapter_id, role_id, active, chapter:chapters(id, name, number, city, primary_color, logo_url, settings), role:roles(id, name, label)",
        )
        .eq("user_id", userId)
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = data ?? [];

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

  const [roleView, setRoleViewState] = useState<RoleName | null>(() =>
    readStoredRoleView(),
  );

  const setRoleView = useCallback((name: RoleName | null) => {
    setRoleViewState(name);
    if (typeof window === "undefined") return;
    if (name) window.localStorage.setItem(ROLE_VIEW_KEY, name);
    else window.localStorage.removeItem(ROLE_VIEW_KEY);
  }, []);

  // Sessão atual apenas — multi-filiado escolhe de novo a cada login.
  const setActiveChapterId = useCallback(
    (id: string | null) => {
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
    [userId],
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

  // Ao mudar de capítulo (ou se a visão guardada for inválida), alinha/limpa roleView
  useEffect(() => {
    if (!activeChapterId) {
      if (roleView) setRoleView(null);
      return;
    }
    if (chapterRoleViews.length === 0) {
      if (roleView) setRoleView(null);
      return;
    }
    if (roleView && !chapterRoleViews.includes(roleView)) {
      setRoleView(null);
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
    return memberships.find((m) => m.chapter_id === activeChapterId) ?? null;
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
    setRoleView(next);
    return ROLE_LABELS[next] ?? next;
  }, [chapterRoleViews, effectiveRoleView, realRoleName, setRoleView]);

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
      loading: isLoading,
      activeChapterId,
      active,
      profileFullName,
      realRoleName,
      canSwitchRoleView,
      distinctChapters,
      canSwitchChapter,
      setActiveChapterId,
      cycleRoleView,
      cycleChapter,
      refetch,
    }),
    [
      memberships,
      isLoading,
      activeChapterId,
      active,
      profileFullName,
      realRoleName,
      canSwitchRoleView,
      distinctChapters,
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
