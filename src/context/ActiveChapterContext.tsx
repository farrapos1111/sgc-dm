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

type ActiveChapterContextValue = {
  memberships: Membership[];
  loading: boolean;
  activeChapterId: string | null;
  active: Membership | null;
  setActiveChapterId: (id: string | null) => void;
  refetch: () => void;
};

const STORAGE_KEY = "sgcdm.activeChapterId";

const ActiveChapterContext = createContext<ActiveChapterContextValue | null>(null);

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
          "id, chapter_id, role_id, active, chapter:chapters(id, name, number, city, primary_color, logo_url, settings), role:roles(id, name, label)"
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

  const [activeChapterId, setActiveChapterIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Persistente entre dispositivos: sincroniza capítulo ativo no perfil
  const setActiveChapterId = useCallback((id: string | null) => {
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
  }, [userId]);

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
    if (activeChapterId && !memberships.some((m) => m.chapter_id === activeChapterId)) {
      setActiveChapterId(null);
    }
  }, [isLoading, memberships, activeChapterId, setActiveChapterId]);

  const active = useMemo(
    () => memberships.find((m) => m.chapter_id === activeChapterId) ?? null,
    [memberships, activeChapterId]
  );

  const value = useMemo<ActiveChapterContextValue>(
    () => ({
      memberships,
      loading: isLoading,
      activeChapterId,
      active,
      setActiveChapterId,
      refetch,
    }),
    [memberships, isLoading, activeChapterId, active, setActiveChapterId, refetch],
  );

  return <ActiveChapterContext.Provider value={value}>{children}</ActiveChapterContext.Provider>;
}

export function useActiveChapter() {
  const ctx = useContext(ActiveChapterContext);
  if (!ctx) throw new Error("useActiveChapter deve ser usado dentro de ActiveChapterProvider");
  return ctx;
}
