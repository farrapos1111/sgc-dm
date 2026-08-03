import { datePartsInAppTz } from "@/lib/timezone";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type SindicanciaAtaVarContext = {
  candidato?: string | null;
  rg?: string | null;
  cpf?: string | null;
  capitulo_nome?: string | null;
  numero?: string | number | null;
  cidade?: string | null;
  sindicante?: string | null;
  escrivao?: string | null;
  senior?: string | null;
  date?: string | null;
};

/** Variáveis da declaração / textos introdutórios da ata de sindicância. */
export function buildSindicanciaAtaVarMap(
  ctx: SindicanciaAtaVarContext,
): Record<string, string> {
  const start = ctx.date ? new Date(ctx.date) : new Date();
  const parts = datePartsInAppTz(start);
  const blank = (v: string | number | null | undefined, fallback = "—") => {
    const s = v == null ? "" : String(v).trim();
    return s || fallback;
  };

  return {
    candidato: blank(ctx.candidato),
    indicado: blank(ctx.candidato),
    rg: blank(ctx.rg),
    cpf: blank(ctx.cpf),
    capitulo_nome: blank(ctx.capitulo_nome),
    capitulo: blank(ctx.capitulo_nome),
    capítulo: blank(ctx.capitulo_nome),
    numero: blank(ctx.numero),
    número: blank(ctx.numero),
    cidade: blank(ctx.cidade),
    "cidade da loja sede": blank(ctx.cidade),
    sindicante: blank(ctx.sindicante),
    escrivao: blank(ctx.escrivao),
    escrivão: blank(ctx.escrivao),
    senior: blank(ctx.senior),
    "tio/senior": blank(ctx.senior),
    "tio/senior ": blank(ctx.senior),
    dia: String(parts.day).padStart(2, "0"),
    mes: MESES[parts.month - 1] ?? "",
    mês: MESES[parts.month - 1] ?? "",
    ano: String(parts.year),
  };
}

export function applySindicanciaAtaVars(
  text: string,
  ctx: SindicanciaAtaVarContext,
): string {
  const map = buildSindicanciaAtaVarMap(ctx);
  return text.replace(/\[([^\]\n]+)\]/g, (full, key: string) => {
    const k = key.trim();
    if (Object.prototype.hasOwnProperty.call(map, k)) return map[k]!;
    return full;
  });
}
