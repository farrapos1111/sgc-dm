/** Tipos de ata e senhas do link público (chapters.settings.minute_passwords). */

export const MINUTE_KINDS = [
  "publica",
  "grau_iniciatico",
  "grau_demolay",
] as const;

export type MinuteKind = (typeof MINUTE_KINDS)[number];

/** Nível 1 = Pública … 3 = Grau DeMolay (ordem do slider). */
export const MINUTE_KIND_LEVELS = [1, 2, 3] as const;
export type MinuteKindLevel = (typeof MINUTE_KIND_LEVELS)[number];

export const MINUTE_KIND_LABELS: Record<MinuteKind, string> = {
  publica: "Pública",
  grau_iniciatico: "Grau Iniciático",
  grau_demolay: "Grau DeMolay",
};

export const MINUTE_KIND_SHORT_LABELS: Record<MinuteKind, string> = {
  publica: "Pública",
  grau_iniciatico: "Iniciático",
  grau_demolay: "DeMolay",
};

export function minuteKindToLevel(kind: MinuteKind): MinuteKindLevel {
  const idx = MINUTE_KINDS.indexOf(kind);
  return (idx >= 0 ? idx + 1 : 1) as MinuteKindLevel;
}

export function minuteKindFromLevel(level: number): MinuteKind {
  const idx = Math.min(
    MINUTE_KINDS.length - 1,
    Math.max(0, Math.round(level) - 1),
  );
  return MINUTE_KINDS[idx]!;
}

export type MinutePasswords = Record<MinuteKind, string>;

export const EMPTY_MINUTE_PASSWORDS: MinutePasswords = {
  publica: "",
  grau_iniciatico: "",
  grau_demolay: "",
};

/** Fallback legado da ata pública quando ainda não há senha configurada. */
export const DEFAULT_PUBLIC_MINUTE_PASSWORD = "senha";

export function isMinuteKind(value: unknown): value is MinuteKind {
  return (
    typeof value === "string" &&
    (MINUTE_KINDS as readonly string[]).includes(value)
  );
}

export function parseMinutePasswords(
  settings: Record<string, unknown> | null | undefined,
): MinutePasswords {
  const raw = settings?.minute_passwords;
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = { ...EMPTY_MINUTE_PASSWORDS };
  for (const kind of MINUTE_KINDS) {
    const v = obj[kind];
    out[kind] = typeof v === "string" ? v : "";
  }
  return out;
}

/** Senha esperada para o link público deste tipo (null = não configurada). */
export function expectedMinutePublicPassword(
  settings: Record<string, unknown> | null | undefined,
  kind: MinuteKind,
): string | null {
  const configured = parseMinutePasswords(settings)[kind].trim();
  if (configured) return configured;
  if (kind === "publica") return DEFAULT_PUBLIC_MINUTE_PASSWORD;
  return null;
}

/** Dados mínimos do membro para decidir acesso à ata. */
export type MinuteMemberAccessInfo = {
  kind?: string | null;
  exam_grau_iniciatico?: string | null;
  exam_grau_demolay?: string | null;
  iniciacao_ordem?: string | null;
  iniciacao_grau_demolay?: string | null;
};

/**
 * Nível de acesso do membro às atas por grau:
 * - full: maçom, senior ou Grau DeMolay → todos os tipos
 * - iniciatico: só Grau Iniciático → pública + iniciático
 * - none: sem grau DeMolay reconhecido → usa senha de visitante
 */
export function minuteAccessTier(
  m: MinuteMemberAccessInfo,
): "full" | "iniciatico" | "none" {
  if (m.kind === "macom" || m.kind === "senior") return "full";
  if (m.iniciacao_grau_demolay || m.exam_grau_demolay) return "full";
  if (m.exam_grau_iniciatico || m.iniciacao_ordem) return "iniciatico";
  return "none";
}

/** Se o membro pode abrir este tipo de ata sem senha. */
export function memberCanAccessMinuteKind(
  m: MinuteMemberAccessInfo,
  kind: MinuteKind,
): boolean {
  const tier = minuteAccessTier(m);
  if (tier === "full") return true;
  if (tier === "iniciatico") {
    return kind === "publica" || kind === "grau_iniciatico";
  }
  return false;
}
