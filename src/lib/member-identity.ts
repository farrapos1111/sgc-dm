/** Predicado permissivo (listagem/exibição): capítulo atual ou legado sem chapter_id. */
export function belongsToChapter(
  row: { chapter_id?: string | null },
  chapterId: string,
): boolean {
  return row.chapter_id === chapterId || !row.chapter_id;
}

/** Predicado estrito (ações de escrita/remoção): só match exato com chapterId não vazio. */
export function isSameChapter(
  row: { chapter_id?: string | null },
  chapterId: string,
): boolean {
  return Boolean(chapterId) && row.chapter_id === chapterId;
}

/**
 * Forma canônica do ID DeMolay (paridade com public.normalize_demolay_id):
 * trim → remove fora de [A-Za-z0-9] → lower.
 */
export function normalizeDemolayId(raw: string): string {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

export {
  resolveLinkedMemberIdsForChapter,
  resolveLinkedMemberIdsGlobal,
} from "@/lib/resolve-linked-members";
