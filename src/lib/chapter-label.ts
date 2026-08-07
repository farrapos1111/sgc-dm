/** Formata capítulo solicitante / instituição: Nome Nº X — Cidade */
export function formatChapterIdentity(chapter: {
  name?: string | null;
  number?: string | null;
  city?: string | null;
} | null | undefined): string {
  if (!chapter?.name) return "Outro capítulo";
  const num = chapter.number ? ` Nº ${chapter.number}` : "";
  const city = chapter.city?.trim() ? ` — ${chapter.city.trim()}` : "";
  return `${chapter.name}${num}${city}`;
}
