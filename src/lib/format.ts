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

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function isMinor(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const bd = new Date(birthDate);
  const now = new Date();
  const age =
    now.getFullYear() -
    bd.getFullYear() -
    (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
  return age < 18;
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

export const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  senior: "Senior DeMolay",
  macom: "Maçom",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

export function ageFrom(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
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

/** Grau atual do membro a partir das datas de iniciação/exame. */
export function grauOf(m: MemberGrauInfo): { code: "DM" | "GI" | null; label: string } {
  if (m.iniciacao_grau_demolay || m.exam_grau_demolay) return { code: "DM", label: "DM — DeMolay" };
  if (m.iniciacao_ordem || m.exam_grau_iniciatico)
    return { code: "GI", label: "GI — Grau Iniciático" };
  return { code: null, label: "Sem grau" };
}

/** Fez o exame de grau iniciático mas ainda não foi iniciado no Grau DeMolay. */
export function isAptoGrauDemolay(m: MemberGrauInfo): boolean {
  return Boolean(m.exam_grau_iniciatico) && !m.iniciacao_grau_demolay;
}

