import { useQuery } from "@tanstack/react-query";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { useNavGroups } from "@/hooks/useNavGroups";
import { canAccess } from "@/lib/permissions";
import { countPendingMemberRequests } from "@/lib/member-change-requests.functions";
import { getDashboardFinance } from "@/lib/finance.functions";

/** Contadores do menu (Membros e Atrasados) — usados no menu lateral e no "Tudo do capítulo". */
export function useNavBadges(): Record<string, number | undefined> {
  const { active } = useActiveChapter();
  const { activeScope } = useOrgScope();
  const { canSee } = useNavGroups();
  const { ctx: accessCtx, canScreen } = useChapterAccess();

  const canRequests =
    !activeScope &&
    canSee("/membros") &&
    (canScreen("membros", "edit") ||
      canAccess(accessCtx, "secretaria") ||
      canAccess(accessCtx, "conselho") ||
      canAccess(accessCtx, "admin"));
  const { data: pendingRequests } = useQuery({
    queryKey: ["member-change-requests-count", active?.chapter_id],
    queryFn: () => countPendingMemberRequests({ data: { originChapterId: active!.chapter_id } }),
    enabled: Boolean(active?.chapter_id) && canRequests,
    refetchInterval: 120_000,
  });
  const { data: navFinance } = useQuery({
    queryKey: ["dashboard-finance", active?.chapter_id],
    queryFn: () => getDashboardFinance({ data: { chapterId: active!.chapter_id } }),
    enabled: Boolean(active?.chapter_id) && !activeScope && canSee("/tesouraria/atrasados"),
    staleTime: 60_000,
  });
  return {
    "/membros": pendingRequests?.count || undefined,
    "/tesouraria/atrasados": navFinance?.pendingMembers || undefined,
  };
}
