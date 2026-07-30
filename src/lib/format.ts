export function formatCpfMask(last2: string | null | undefined): string {
  if (!last2) return "***.***.***-**";
  return `***.***.***-${last2}`;
}

export function formatRgMask(last2: string | null | undefined): string {
  if (!last2) return "**.***.**-*";
  return `**.***.***-${last2}`;
}

export function formatBRL(value: number | null | undefined): string {
  const v = typeof value === "number" ? value : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Datas do tipo `date` (YYYY-MM-DD) devem ser lidas em horário local.
 * `new Date("2008-07-16")` é UTC meia-noite e no Brasil vira o dia anterior.
 */
export function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateBR(iso: string | null | undefined): string {
  const d = parseDateOnly(iso);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function isMinor(birthDate: string | null | undefined): boolean {
  const age = ageFrom(birthDate);
  return age !== null && age < 18;
}

export function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function maskCpfInput(v: string): string {
  const d = digitsOnly(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskPhoneInput(v: string): string {
  const d = digitsOnly(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCepInput(v: string): string {
  const d = digitsOnly(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export const STATUS_LABELS: Record<string, string> = {
  regular: "Regular",
  irregular: "Irregular",
};

export const KIND_LABELS: Record<string, string> = {
  demolay_ativo: "Demolay Ativo",
  senior: "Senior Demolay",
  macom: "Maçom",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

export function kindLabel(kind: string | null | undefined): string {
  if (!kind) return "—";
  return KIND_LABELS[kind] ?? kind;
}

export function ageFrom(birthDate: string | null | undefined): number | null {
  const bd = parseDateOnly(birthDate);
  if (!bd) return null;
  const now = new Date();
  return (
    now.getFullYear() -
    bd.getFullYear() -
    (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0)
  );
}

export function isUnder21(birthDate: string | null | undefined): boolean {
  const age = ageFrom(birthDate);
  return age !== null && age < 21;
}

export function is21OrOlder(birthDate: string | null | undefined): boolean {
  const age = ageFrom(birthDate);
  return age !== null && age >= 21;
}

export type MemberGrauInfo = {
  exam_grau_demolay?: string | null;
  exam_grau_iniciatico?: string | null;
  iniciacao_ordem?: string | null;
  iniciacao_grau_demolay?: string | null;
};

/** Grau atual do membro. Sem iniciação à Ordem, não é considerado DeMolay. */
export function grauOf(m: MemberGrauInfo): { code: "DM" | "GI" | null; label: string } {
  if (!m.iniciacao_ordem) return { code: null, label: "Não DeMolay" };
  if (m.iniciacao_grau_demolay || m.exam_grau_demolay) return { code: "DM", label: "DM — DeMolay" };
  if (m.exam_grau_iniciatico || m.iniciacao_ordem)
    return { code: "GI", label: "GI — Grau Iniciático" };
  return { code: null, label: "Sem grau" };
}

/** Iniciado na Ordem, fez exame GI, ainda sem iniciação no Grau DeMolay. */
export function isAptoGrauDemolay(m: MemberGrauInfo): boolean {
  return Boolean(m.iniciacao_ordem) && Boolean(m.exam_grau_iniciatico) && !m.iniciacao_grau_demolay;
}

/** Critérios cadastrais para apto a voto (frequência ≥50% nos últimos 6 meses é avaliada à parte). */
export function meetsVoteCadastro(
  m: MemberGrauInfo & { status: string; kind?: string | null },
): boolean {
  return (
    m.status === "regular" &&
    m.kind === "demolay_ativo" &&
    Boolean(m.exam_grau_iniciatico) &&
    Boolean(m.exam_grau_demolay)
  );
}
