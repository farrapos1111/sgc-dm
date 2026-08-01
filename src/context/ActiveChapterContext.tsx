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
  /** Papel real do vínculo (sem override de visão). */
  realRoleName: string | null;
  /** Há múltiplos papéis distintos no capítulo ativo — pode alternar visão. */
  canSwitchRoleView: boolean;
  setActiveChapterId: (id: string | null) => void;
  cycleRoleView: () => string;
  refetch: () => void;
};

const STORAGE_KEY = "sgcdm.activeChapterId";
const ROLE_VIEW_KEY = "sgcdm.roleView";

const ActiveChapterContext = createContext<ActiveChapterContextValue | null>(
  null,
);

function readStoredRoleView(): RoleName | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ROLE_VIEW_KEY);
  if (!raw) return null;
  return (ROLE_VIEW_ORDER as string[]).includes(raw) ? (raw as RoleName) : null;
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
        .select("active_chapter_id")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
  });

  const [activeChapterId, setActiveChapterIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(STORAGE_KEY);
    },
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

  // Persistente entre dispositivos: sincroniza capítulo ativo no perfil
  const setActiveChapterId = useCallback(
    (id: string | null) => {
      setActiveChapterIdState(id);
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
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

  // Inicializa do perfil quando não há localStorage
  useEffect(() => {
    if (activeChapterId) return;
    const fromProfile = profile?.active_chapter_id;
    if (fromProfile && memberships.some((m) => m.chapter_id === fromProfile)) {
      setActiveChapterId(fromProfile);
    }
  }, [profile, activeChapterId, memberships, setActiveChapterId]);

  // Auto-seleciona ou valida o capítulo ativo
  useEffect(() => {
    if (isLoading) return;
    if (memberships.length === 0) {
      setActiveChapterId(null);
      return;
    }
    if (memberships.length === 1) {
      const only = memberships[0].chapter_id;
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

  const value = useMemo<ActiveChapterContextValue>(
    () => ({
      memberships,
      loading: isLoading,
      activeChapterId,
      active,
      realRoleName,
      canSwitchRoleView,
      setActiveChapterId,
      cycleRoleView,
      refetch,
    }),
    [
      memberships,
      isLoading,
      activeChapterId,
      active,
      realRoleName,
      canSwitchRoleView,
      setActiveChapterId,
      cycleRoleView,
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
