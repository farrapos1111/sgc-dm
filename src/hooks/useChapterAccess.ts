import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { listMyCommissions } from "@/lib/commissions.functions";
import { getMyCurrentPositions } from "@/lib/members.functions";
import { currentTerm } from "@/lib/terms";
import { normalizeOrgType, type OrgType } from "@/lib/org-types";
import {
  canAccess,
  canAction,
  resolveAccess,
  type AccessContext,
  type ActionPermission,
  type Permission,
} from "@/lib/permissions";
import {
  isAdminTotal,
  resolveHardcodedCanScreen,
  resolveHardcodedScreenAccess,
  type ScreenAction,
  type ScreenId,
} from "@/lib/screen-access";

export function useChapterAccess() {
  const { active, realRoleName } = useActiveChapter();
  const term = currentTerm();
  const chapterId = active?.chapter_id ?? "";
  const roleName = active?.role.name ?? null;
  const orgType: OrgType = normalizeOrgType(
    (active?.chapter as { org_type?: string | null } | undefined)?.org_type,
  );

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

  /** Contexto com o papel real (sem override de visão) — para gates de admin_total. */
  const realCtx: AccessContext = useMemo(
    () => ({
      ...ctx,
      roleName: realRoleName ?? roleName,
    }),
    [ctx, realRoleName, roleName],
  );

  const permissions = useMemo(() => resolveAccess(ctx), [ctx]);
  const screenMap = useMemo(() => resolveHardcodedScreenAccess(ctx), [ctx]);
  const adminBypass = isAdminTotal(realCtx);

  const canScreen = useCallback(
    (screenId: ScreenId | string, action: ScreenAction): boolean =>
      resolveHardcodedCanScreen(ctx, screenId, action, adminBypass),
    [adminBypass, ctx],
  );

  const can = useCallback(
    (perm: Permission) => canAccess(ctx, perm),
    [ctx],
  );

  const canDo = useCallback(
    (action: ActionPermission, commissionCode?: string) =>
      canAction(ctx, action, commissionCode),
    [ctx],
  );

  return {
    ctx,
    realCtx,
    permissions,
    orgType,
    can,
    canDo,
    canScreen,
    isAdminTotal: adminBypass,
    screenMap,
    matrixLoading: false,
    positions,
    positionLabels: positionRows,
    commissions,
  };
}
