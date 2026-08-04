import { normalizeSearch } from "@/lib/utils";

export type MinuteMentionTitle = "Irmão" | "Tio";

export type MinuteMentionMember = {
  id: string;
  full_name: string;
  kind: string | null;
};

export type MinuteMentionMatch = {
  title: MinuteMentionTitle;
  /** Prefixo do nome digitado (sem espaços). */
  query: string;
  /** Índice do início do título no texto. */
  titleIndex: number;
  /** Índice do início do query (após "Irmão "/"Tio "). */
  queryIndex: number;
};

/** Detecta "Irmão|Tio" + ≥3 caracteres sem espaço, imediatamente antes do cursor. */
export function detectMinuteMention(
  textBeforeCursor: string,
): MinuteMentionMatch | null {
  // Título no fim do trecho até o cursor: (início/separador) + Irmão|Tio + espaço + ≥3 não-espaço
  const re =
    /(?:^|[\s\n([{«"'“])((?:[Ii]rm[aã]o)|(?:[Tt]io))(\s+)(\S{3,})$/u;
  const m = textBeforeCursor.match(re);
  if (!m || m.index == null) return null;

  const rawTitle = m[1];
  const spacing = m[2];
  const query = m[3];
  const titleNorm = normalizeSearch(rawTitle);
  const title: MinuteMentionTitle =
    titleNorm === "tio" ? "Tio" : "Irmão";

  // índice do título no texto = fim - (título + espaçamento + query)
  const matched = m[0];
  // m[0] pode incluir o separador à esquerda
  const titleInMatch = matched.search(/[IiTt]/);
  const titleIndex =
    m.index + (titleInMatch >= 0 ? titleInMatch : 0);
  const queryIndex = titleIndex + rawTitle.length + spacing.length;

  return { title, query, titleIndex, queryIndex };
}

function bigramDice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bg = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      set.set(g, (set.get(g) ?? 0) + 1);
    }
    return set;
  };
  const A = bg(a);
  const B = bg(b);
  let inter = 0;
  for (const [g, c] of A) {
    inter += Math.min(c, B.get(g) ?? 0);
  }
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

/** Pontuação de similaridade do query com o nome (maior = melhor). */
export function scoreMemberName(query: string, fullName: string): number {
  const q = normalizeSearch(query);
  const name = normalizeSearch(fullName);
  if (!q || !name) return 0;

  if (name.startsWith(q)) return 1000 + (100 - Math.min(name.length, 100));

  const tokens = name.split(" ").filter(Boolean);
  let bestToken = 0;
  for (const t of tokens) {
    if (t.startsWith(q)) bestToken = Math.max(bestToken, 850);
    else if (t.includes(q)) bestToken = Math.max(bestToken, 600);
    else bestToken = Math.max(bestToken, Math.round(bigramDice(q, t) * 500));
  }

  if (name.includes(q)) return Math.max(bestToken, 700);

  return Math.max(bestToken, Math.round(bigramDice(q, name) * 400));
}

export function filterMembersForMention(
  members: MinuteMentionMember[],
  title: MinuteMentionTitle,
  query: string,
  limit = 8,
): MinuteMentionMember[] {
  const kinds =
    title === "Tio"
      ? new Set(["macom"])
      : new Set(["demolay_ativo", "senior"]);

  return members
    .filter((m) => m.kind && kinds.has(m.kind))
    .map((m) => ({ m, score: scoreMemberName(query, m.full_name) }))
    .filter((x) => x.score >= 280)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.m.full_name.localeCompare(b.m.full_name, "pt-BR"),
    )
    .slice(0, limit)
    .map((x) => x.m);
}

/** Substitui o trecho do query pelo nome completo, preservando o título. */
export function applyMinuteMention(
  fullText: string,
  caret: number,
  match: MinuteMentionMatch,
  fullName: string,
): { text: string; caret: number } {
  const after = fullText.slice(caret);
  const titlePart = fullText.slice(match.titleIndex, match.queryIndex);
  const insert = `${titlePart}${fullName}`;
  const head = fullText.slice(0, match.titleIndex);
  const text = `${head}${insert}${after}`;
  return { text, caret: head.length + insert.length };
}
