import { useMemo } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { isChapterDuesEnabled, isDuesOnlyNavPath } from "@/lib/dues-rules";
import { filterGroupsForFdj, visibleGroups, visibleOrgGroups, type NavGroup } from "@/lib/nav";
import { getRealmForOrgType } from "@/lib/realm";

/**
 * Grupos do menu visíveis para quem está logado (mesma regra do menu lateral).
 * `canSee(to)` diz se uma rota aparece no menu — usado em atalhos e abas.
 */
export function useNavGroups(): {
  groups: NavGroup[];
  canSee: (to: string) => boolean;
  isFdj: boolean;
  duesEnabled: boolean;
} {
  const { active } = useActiveChapter();
  const { canView } = useCommissionAccess();
  const { ctx: accessCtx, canScreen, isAdminTotal } = useChapterAccess();
  const { activeScope, canManageOrg, canManageChapters, canManageLeaderships } = useOrgScope();
  const duesEnabled = isChapterDuesEnabled(
    active?.chapter as { settings?: Record<string, unknown> } | undefined,
  );
  const isFdj = getRealmForOrgType(active?.chapter?.org_type) === "fdj";

  const groups = useMemo(() => {
    const raw = activeScope
      ? visibleOrgGroups({ canManageOrg, canManageChapters, canManageLeaderships })
      : visibleGroups(active?.role.name ?? null, canView, accessCtx, {
          canScreen,
          isAdminTotal,
        });
    if (!activeScope && isFdj) return filterGroupsForFdj(raw);
    if (activeScope || duesEnabled) return raw;
    return raw.map((g) => ({
      ...g,
      items: (g.items ?? []).filter((i) => !isDuesOnlyNavPath(i.to)),
    }));
  }, [
    activeScope,
    canManageOrg,
    canManageChapters,
    canManageLeaderships,
    active?.role.name,
    canView,
    accessCtx,
    canScreen,
    isAdminTotal,
    duesEnabled,
    isFdj,
  ]);

  const paths = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.to) set.add(g.to);
      for (const i of g.items ?? []) set.add(i.to);
    }
    return set;
  }, [groups]);

  return { groups, canSee: (to: string) => paths.has(to), isFdj, duesEnabled };
}
