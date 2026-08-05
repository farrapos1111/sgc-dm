/** Predicado: registro pertence ao capítulo atual (ou legado sem chapter_id). */
export function belongsToChapter(
  row: { chapter_id?: string | null },
  chapterId: string,
): boolean {
  return row.chapter_id === chapterId || !row.chapter_id;
}

/** Normaliza ID DeMolay para comparação/armazenamento (trim + lower + alfanumérico). */
export function normalizeDemolayId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/gi, "");
}
