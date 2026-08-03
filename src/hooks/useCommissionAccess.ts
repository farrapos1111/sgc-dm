import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyCommissions, type MyCommission } from "@/lib/commissions.functions";
import { getMySindicanciaAccess } from "@/lib/investigations.functions";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { currentTerm } from "@/lib/terms";
import { can } from "@/lib/permissions";

export type CommissionAccess = {
  commissions: MyCommission[];
  /** Vê o setor da comissão na sidebar. */
  canView: (code: string) => boolean;
  /** Pode criar/editar/excluir dentro do setor da comissão. */
  canManage: (code: string) => boolean;
  /** Templates de sindicância: presidente/vice da comissão, MC ou admin. */
  canEditSindicanciasTemplates: () => boolean;
};

export function useCommissionAccess(): CommissionAccess {
  const { active } = useActiveChapter();
  const term = currentTerm();
  const fetchMine = useServerFn(listMyCommissions);
  const fetchSindAccess = useServerFn(getMySindicanciaAccess);

  const { data } = useQuery({
    queryKey: ["my-commissions", active?.chapter_id, term.year, term.semester],
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

  const { data: sindAccess } = useQuery({
    queryKey: ["sindicancia-access", active?.chapter_id, term.year, term.semester],
    enabled: !!active,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchSindAccess({ data: { chapterId: active!.chapter_id } }),
  });

  const commissions = data ?? [];
  const role = active?.role.name ?? null;
  const isAdmin = can(role, "admin") || can(role, "conselho");
  const isMC = role === "mestre_conselheiro";
  const voteAccess = Boolean(sindAccess?.canAccess);

  const canView = useCallback(
    (code: string) =>
      isAdmin ||
      commissions.some((c) => c.code === code) ||
      (code === "sindicancias" && voteAccess),
    [commissions, isAdmin, voteAccess],
  );

  const canManage = useCallback(
    (code: string) =>
      isAdmin || commissions.some((c) => c.code === code && c.isPresident),
    [commissions, isAdmin],
  );

  const canEditSindicanciasTemplates = useCallback(
    () => isAdmin || isMC || canManage("sindicancias"),
    [isAdmin, isMC, canManage],
  );

  return useMemo(
    () => ({ commissions, canView, canManage, canEditSindicanciasTemplates }),
    [commissions, canView, canManage, canEditSindicanciasTemplates],
  );
}
