import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyCommissions, type MyCommission } from "@/lib/commissions.functions";
import { getMySindicanciaAccess } from "@/lib/investigations.functions";
import { getMyCurrentPositions } from "@/lib/members.functions";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { currentTerm } from "@/lib/terms";
import { canAccess, canAction, type AccessContext } from "@/lib/permissions";

export type CommissionAccess = {
  commissions: MyCommission[];
  /** Vê o setor da comissão na sidebar. */
  canView: (code: string) => boolean;
  /** Pode criar/editar dentro do setor (presidente e vice). */
  canManage: (code: string) => boolean;
  /** Pode excluir no setor (só presidente). */
  canDelete: (code: string) => boolean;
  /** Templates de sindicância: presidente/vice da comissão, MC ou admin. */
  canEditSindicanciasTemplates: () => boolean;
};

export function useCommissionAccess(): CommissionAccess {
  const { active } = useActiveChapter();
  const term = currentTerm();
  const fetchMine = useServerFn(listMyCommissions);
  const fetchSindAccess = useServerFn(getMySindicanciaAccess);
  const chapterId = active?.chapter_id;

  const { data } = useQuery({
    queryKey: ["my-commissions", chapterId, term.year, term.semester],
    enabled: !!active,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchMine({
        data: {
          chapterId: active!.chapter_id,
          year: term.year,
          semester: term.semester as 1 | 2,
        },
      }),
  });

  const { data: positionRows = [] } = useQuery({
    queryKey: ["my-positions", chapterId, term.year, term.semester],
    enabled: !!active,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      getMyCurrentPositions({
        data: {
          chapterId: active!.chapter_id,
          year: term.year,
          semester: term.semester as 1 | 2,
        },
      }),
  });

  const positions = useMemo(
    () => positionRows.map((p) => p.code),
    [positionRows],
  );

  const { data: sindAccess } = useQuery({
    queryKey: ["sindicancia-access", chapterId, term.year, term.semester],
    enabled: !!active,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchSindAccess({ data: { chapterId: active!.chapter_id } }),
  });

  const commissions = data ?? [];
  const role = active?.role.name ?? null;

  const ctx: AccessContext = useMemo(
    () => ({
      roleName: role,
      currentPositions: positions,
      commissionRoles: commissions.map((c) => ({ code: c.code, role: c.role })),
    }),
    [role, positions, commissions],
  );

  const isAdmin = canAccess(ctx, "admin") || canAccess(ctx, "conselho");
  const isMC =
    role === "mestre_conselheiro" || positions.includes("mestre_conselheiro");
  const voteAccess = Boolean(sindAccess?.canAccess);

  const canView = useCallback(
    (code: string) =>
      isAdmin ||
      canAccess(ctx, "visualizar_total") ||
      canAction(ctx, "comissao.view", code) ||
      // Qualquer papel na comissão (membro / auxiliar sênior / vice / presidente)
      commissions.some((c) => c.code === code) ||
      (code === "sindicancias" && voteAccess),
    [commissions, isAdmin, voteAccess, ctx],
  );

  const canManage = useCallback(
    // Presidente e Vice: CRU; membro/sênior não
    (code: string) => isAdmin || canAction(ctx, "comissao.edit", code),
    [isAdmin, ctx],
  );

  const canDelete = useCallback(
    (code: string) => isAdmin || canAction(ctx, "comissao.delete", code),
    [isAdmin, ctx],
  );

  const canEditSindicanciasTemplates = useCallback(
    () => isAdmin || isMC || canManage("sindicancias"),
    [isAdmin, isMC, canManage],
  );

  return useMemo(
    () => ({
      commissions,
      canView,
      canManage,
      canDelete,
      canEditSindicanciasTemplates,
    }),
    [commissions, canView, canManage, canDelete, canEditSindicanciasTemplates],
  );
}
