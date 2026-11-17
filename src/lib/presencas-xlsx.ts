import type { AttendancePdfInput } from "@/lib/presencas-pdf";

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Relatório de frequência em planilha (mesmas colunas do PDF). */
export async function exportAttendanceXlsx(input: AttendancePdfInput) {
  const XLSX = await import("xlsx");
  const aoa: (string | number | null)[][] = [
    [input.chapterName],
    [`Relatório de Frequência — ${input.periodLabel}`],
    [],
    ["Nome", "Situação", "Presenças", "Faltas", "Frequência (%)", "Obs."],
    ...input.rows.map((r) => [
      r.name,
      r.situation,
      r.present,
      r.total - r.present,
      r.pct,
      r.obs,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 38 }, { wch: 11 }, { wch: 11 }, { wch: 9 }, { wch: 15 }, { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Frequência");
  XLSX.writeFile(wb, `frequencia-${fileSafe(input.periodLabel)}.xlsx`);
}
