import * as XLSX from "xlsx";

export type SheetRow = {
  kind: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  entry_date: string;
};

export type ParsedRow = SheetRow & { line: number; error?: string };

function toISODate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function toAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.abs(value) : null;
  if (value == null) return null;
  const text = String(value)
    .replace(/[R$\s]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of Object.keys(row)) {
    const norm = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    if (keys.includes(norm)) return row[key];
  }
  return undefined;
}

/** Lê a planilha (Data | Tipo | Valor | Categoria | Descrição) e valida linha a linha. */
export async function parseCashSheet(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return json.map((row, index) => {
    const line = index + 2;
    const date = toISODate(pick(row, ["data", "date"]));
    const rawKind = String(pick(row, ["tipo", "kind"]) ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    const kind: "entrada" | "saida" | null =
      rawKind.startsWith("e") ? "entrada" : rawKind.startsWith("s") ? "saida" : null;
    const amount = toAmount(pick(row, ["valor", "amount"]));
    const category = String(pick(row, ["categoria", "category"]) ?? "").trim() || "Outras";
    const description = String(pick(row, ["descricao", "description"]) ?? "").trim();

    const errors: string[] = [];
    if (!date) errors.push("data inválida");
    if (!kind) errors.push("tipo deve ser Entrada ou Saída");
    if (amount == null) errors.push("valor inválido");
    if (!description) errors.push("descrição vazia");

    return {
      line,
      entry_date: date ?? "",
      kind: kind ?? "entrada",
      amount: amount ?? 0,
      category,
      description,
      error: errors.length ? errors.join(", ") : undefined,
    };
  });
}

/** Modelo de planilha para importação. */
export function downloadCashTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Data", "Tipo", "Valor", "Categoria", "Descrição"],
    ["01/01/2026", "Entrada", 50, "Mensalidades", "Mensalidade - Exemplo - Janeiro/2026"],
    ["05/01/2026", "Saída", 120.5, "Hospitalaria", "Compra de insumos"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "modelo-fluxo-de-caixa.xlsx");
}

export function exportCashXlsx(
  entries: Array<{
    entry_date: string;
    kind: string;
    category: string;
    description: string;
    amount: number | string;
  }>,
  fileName: string,
) {
  const rows = entries.map((e) => ({
    Data: e.entry_date.split("-").reverse().join("/"),
    Tipo: e.kind === "entrada" ? "Entrada" : "Saída",
    Categoria: e.category,
    Descrição: e.description,
    Valor: Number(e.amount),
  }));
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["Data", "Tipo", "Categoria", "Descrição", "Valor"],
  });
  ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 48 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fluxo de caixa");
  XLSX.writeFile(wb, fileName);
}
