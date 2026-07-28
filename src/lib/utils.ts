import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Remove acentos e normaliza para comparação de busca. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca livre: ignora acentos/caixa e exige que cada palavra da query
 * apareça em algum lugar do texto (não precisa ser match perfeito).
 * Ex.: "mest cons" encontra "Mestre Conselheiro · Capítulo".
 */
export function matchesLooseSearch(text: string, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const hay = normalizeSearch(text);
  if (hay.includes(q)) return true;
  return q.split(" ").filter(Boolean).every((token) => hay.includes(token));
}
