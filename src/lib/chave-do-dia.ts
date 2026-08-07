import {
  datePartsInAppTz,
  formatTimeInAppTz,
  APP_TIMEZONE,
} from "@/lib/timezone";

export type ChaveItem = {
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  address?: string | null;
  dress_code?: string | null;
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DIAS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateBR(d: Date) {
  const { day, month, year } = datePartsInAppTz(d);
  return `${pad(day)}/${pad(month)}/${year}`;
}

export function timeBR(d: Date) {
  return formatTimeInAppTz(d);
}

function weekdayIndexInAppTz(d: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** Modelo padrão da chave do dia (usa variáveis dinâmicas entre colchetes). */
export const DEFAULT_CHAVE_TEMPLATE = `🔺🗝️ CHAVE DIA [data]🗝️🔺

—————🕯️🕯️🕯️🕯️🕯️🕯️🕯️—————

Neste [dia_semana], dia [dia] de [mes] de [ano], teremos a pauta [titulo].

[descricao]

📆 Data: [data]
📍 Local: [local]
🕴️ Traje: [traje]
📍 Pauta: [titulo]
⏰ Horário de Chegada: [hora_inicio]
⏰ Horário Previsto de Encerramento: [hora_fim]

Presença obrigatória de todos os demolays ativos.

Para quaisquer dúvidas, estamos à disposição! Fiquem todos com o Pai Celestial! 🔺⚔️`;

/** Variáveis disponíveis no editor do modelo. */
export const CHAVE_VARIABLES: { key: string; label: string }[] = [
  { key: "titulo", label: "Título / pauta" },
  { key: "descricao", label: "Descrição" },
  { key: "data", label: "Data (dd/mm/aaaa)" },
  { key: "dia_semana", label: "Dia da semana" },
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Mês por extenso" },
  { key: "ano", label: "Ano (AAAA)" },
  { key: "local", label: "Local" },
  { key: "endereco", label: "Endereço" },
  { key: "local_completo", label: "Local + endereço" },
  { key: "traje", label: "Traje" },
  { key: "hora_inicio", label: "Hora de início" },
  { key: "hora_fim", label: "Hora de término" },
  { key: "capitulo", label: "Nome do capítulo" },
];

export function chaveValues(
  item: ChaveItem,
  opts?: { chapterName?: string | null },
): Record<string, string> {
  const start = new Date(item.start_at);
  const end = item.end_at ? new Date(item.end_at) : null;
  const parts = datePartsInAppTz(start);
  const local = (item.location ?? "").trim();
  const endereco = (item.address ?? "").trim();

  return {
    titulo: item.title,
    descricao: (item.description ?? "").trim(),
    data: dateBR(start),
    dia_semana: DIAS[weekdayIndexInAppTz(start)] ?? "",
    dia: String(parts.day),
    mes: MESES[parts.month - 1],
    ano: String(parts.year),
    local: local || "A definir",
    endereco: endereco || "A definir",
    local_completo: [local, endereco].filter(Boolean).join(" — ") || "A definir",
    traje: (item.dress_code ?? "").trim() || "A definir",
    hora_inicio: timeBR(start),
    hora_fim: end ? timeBR(end) : "A definir",
    capitulo: (opts?.chapterName ?? "").trim(),
  };
}

/** Aplica as variáveis no modelo, removendo linhas que ficaram vazias por variável sem valor. */
export function renderChaveTemplate(
  template: string,
  values: Record<string, string>,
): string {
  const lines = template.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const usedKeys = [...line.matchAll(/\[([a-z_]+)\]/gi)].map((m) => m[1].toLowerCase());
    const rendered = line.replace(/\[([a-z_]+)\]/gi, (full, key: string) => {
      const v = values[key.toLowerCase()];
      return v === undefined ? full : v;
    });
    // Linha que existia só para uma variável vazia (ex.: [descricao]) é descartada.
    const onlyVariables = usedKeys.length > 0 && line.replace(/\[[a-z_]+\]/gi, "").trim() === "";
    if (onlyVariables && rendered.trim() === "") continue;
    out.push(rendered);
  }

  return out
    .join("\n")
    // colapsa eventuais linhas em branco triplicadas
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Monta o texto da "chave do dia" pronto para copiar. */
export function buildChaveDoDia(
  item: ChaveItem,
  opts?: { template?: string | null; chapterName?: string | null },
): string {
  const template = (opts?.template ?? "").trim() || DEFAULT_CHAVE_TEMPLATE;
  return renderChaveTemplate(template, chaveValues(item, { chapterName: opts?.chapterName }));
}

export type SindicanciaChaveInput = {
  chapterName?: string | null;
  nominee: string;
  start_at: string;
  location?: string | null;
  sindicante?: string | null;
  senior?: string | null;
  escrivao?: string | null;
  padrinho?: string | null;
  template?: string | null;
};

const DEFAULT_SINDICANCIA_CHAVE_FALLBACK = `[capítulo]
CHAVE DE SINDICÂNCIA

Indicado: [indicado]
Padrinho: [padrinho]
Data: [data] às [hora]
Local: [local]
Sindicante: [sindicante]
Tio/Senior: [senior]
Escrivão de Parecer: [escrivao]
`;

/** Monta a chave de sindicância com o modelo da comissão. */
export function buildSindicanciaChave(input: SindicanciaChaveInput): string {
  const start = new Date(input.start_at);
  const template =
    (input.template ?? "").trim() || DEFAULT_SINDICANCIA_CHAVE_FALLBACK;
  const values: Record<string, string> = {
    capítulo: (input.chapterName ?? "").trim(),
    capitulo: (input.chapterName ?? "").trim(),
    indicado: (input.nominee ?? "").trim(),
    padrinho: (input.padrinho ?? "").trim() || "A definir",
    data: dateBR(start),
    hora: timeBR(start),
    local: (input.location ?? "").trim() || "A definir",
    sindicante: (input.sindicante ?? "").trim() || "A definir",
    senior: (input.senior ?? "").trim() || "A definir",
    escrivao: (input.escrivao ?? "").trim() || "A definir",
  };
  // renderChaveTemplate só aceita [a-z_]; "capítulo" tem acento — normalizar no template
  const normalized = template.replace(/\[capítulo\]/gi, "[capitulo]");
  return renderChaveTemplate(normalized, values);
}

/** Exemplo usado na pré-visualização do editor de modelo. */
export function chavePreviewItem(): ChaveItem {
  const start = new Date();
  start.setHours(13, 30, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return {
    title: "Sessão Ordinária do Grau DeMolay",
    description: "Traga seu manual e chegue com 15 minutos de antecedência.",
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    location: "Loja Exemplo",
    address: "Rua das Acácias, 100 — Centro",
    dress_code: "Traje social completo",
  };
}
