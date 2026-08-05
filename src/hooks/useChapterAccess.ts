import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { listMyCommissions } from "@/lib/commissions.functions";
import { getMyCurrentPositions } from "@/lib/members.functions";
import { currentTerm } from "@/lib/terms";
import {
  canAccess,
  canAction,
  resolveAccess,
  type AccessContext,
  type ActionPermission,
  type Permission,
} from "@/lib/permissions";

export function useChapterAccess() {
  const { active } = useActiveChapter();
  const term = currentTerm();
  const chapterId = active?.chapter_id ?? "";
  const roleName = active?.role.name ?? null;

  const { data: positionRows = [] } = useQuery({
    queryKey: ["my-positions", chapterId, term.year, term.semester],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      getMyCurrentPositions({
        data: {
          chapterId,
          year: term.year,
          semester: term.semester as 1 | 2,
        },
      }),
  });

  const positions = useMemo(
    () => positionRows.map((p) => p.code),
    [positionRows],
  );

  const { data: commissions = [] } = useQuery({
    queryKey: ["my-commissions", chapterId, term.year, term.semester],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      listMyCommissions({
        data: {
          chapterId,
          year: term.year,
          semester: term.semester as 1 | 2,
        },
      }),
  });

  const ctx: AccessContext = useMemo(
    () => ({
      roleName,
      currentPositions: positions,
      commissionRoles: commissions.map((c) => ({
        code: c.code,
        role: c.role,
      })),
    }),
    [roleName, positions, commissions],
  );

  const permissions = useMemo(() => resolveAccess(ctx), [ctx]);

  return {
    ctx,
    permissions,
    can: (perm: Permission) => canAccess(ctx, perm),
    canDo: (action: ActionPermission, commissionCode?: string) =>
      canAction(ctx, action, commissionCode),
    positions,
    positionLabels: positionRows,
    commissions,
  };
}
