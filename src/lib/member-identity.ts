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
 * Forma canônica do ID DeMolay para comparação e gravação:
 * trim + lower + remove tudo que não for a-z/0-9 (espaços, hífens, etc.).
 */
export function normalizeDemolayId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
