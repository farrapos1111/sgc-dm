import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRAZO_KINDS = [
  "until_day",
  "within_month",
  "until_month",
  "date_range",
] as const;

export type PrazoKind = (typeof PRAZO_KINDS)[number];

export type OrgMandatoryDate = {
  id: string;
  scope: "region" | "state";
  region_id: string | null;
  state_id: string | null;
  title: string;
  description: string | null;
  prazo_kind: PrazoKind;
  due_date: string | null;
  due_year: number | null;
  due_month: number | null;
  due_day: number | null;
  start_month: number | null;
  start_day: number | null;
  created_at: string;
};

const MONTH_NAMES = [
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

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(month: number): number {
  if (month < 1 || month > 12) return 31;
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

function formatDayMonth(day: number, month: number): string {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  return `${day} de ${name}`;
}

/** Ordenação anual: mês*100 + dia. */
function dayOfYearKey(month: number, day: number): number {
  return month * 100 + day;
}

export function formatPrazoLabel(row: {
  prazo_kind: PrazoKind;
  due_date?: string | null;
  due_year?: number | null;
  due_month?: number | null;
  due_day?: number | null;
  start_month?: number | null;
  start_day?: number | null;
}): string {
  if (row.prazo_kind === "date_range") {
    const sm = row.start_month;
    const sd = row.start_day;
    const em = row.due_month;
    const ed = row.due_day;
    if (sm && sd && em && ed) {
      return `De ${formatDayMonth(sd, sm)} até ${formatDayMonth(ed, em)}`;
    }
    return "De uma data até outra";
  }
  if (row.prazo_kind === "until_day") {
    let month = row.due_month ?? null;
    let day = row.due_day ?? null;
    if ((!month || !day) && row.due_date) {
      const [, m, d] = row.due_date.slice(0, 10).split("-").map(Number);
      month = m;
      day = d;
    }
    if (month && day) {
      return `Até ${formatDayMonth(day, month)}`;
    }
    return "Até uma data";
  }
  const month = row.due_month ?? 0;
  const name = MONTH_NAMES[month - 1] ?? String(month);
  if (row.prazo_kind === "within_month") {
    return month ? `Dentro de ${name}` : "Dentro de um mês";
  }
  return month ? `Até ${name}` : "Até um mês";
}

export function mandatoryDateAppliesToMonth(
  row: {
    prazo_kind: PrazoKind;
    due_date?: string | null;
    due_year?: number | null;
    due_month?: number | null;
    due_day?: number | null;
    start_month?: number | null;
    start_day?: number | null;
  },
  _year: number,
  month: number,
): boolean {
  if (row.prazo_kind === "date_range") {
    const sm = row.start_month;
    const em = row.due_month;
    if (sm == null || em == null) return false;
    // Intervalo no mesmo ano civil (ex.: mar→mai)
    if (sm <= em) return month >= sm && month <= em;
    // Cruza virada de ano (ex.: nov→fev)
    return month >= sm || month <= em;
  }
  if (row.prazo_kind === "until_day") {
    if (row.due_month != null) return row.due_month === month;
    if (row.due_date) {
      const m = Number(row.due_date.slice(5, 7));
      return m === month;
    }
    return false;
  }
  if (row.prazo_kind === "within_month") {
    return row.due_month === month;
  }
  if (row.prazo_kind === "until_month") {
    return month <= (row.due_month ?? 0);
  }
  return false;
}

const scopeInput = z.discriminatedUnion("scopeType", [
  z.object({
    scopeType: z.literal("region"),
    scopeId: z.string().uuid(),
  }),
  z.object({
    scopeType: z.literal("state"),
    scopeId: z.string().uuid(),
  }),
]);

const upsertInput = scopeInput.and(
  z.object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Informe o nome").max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    prazoKind: z.enum(PRAZO_KINDS),
    dueMonth: z.number().int().min(1).max(12).optional().nullable(),
    dueDay: z.number().int().min(1).max(31).optional().nullable(),
    startMonth: z.number().int().min(1).max(12).optional().nullable(),
    startDay: z.number().int().min(1).max(31).optional().nullable(),
  }),
);

function assertDayInMonth(day: number, month: number, label: string) {
  const maxDay = daysInMonth(month);
  if (day > maxDay) {
    throw new Error(`${label}: dia inválido para o mês (máx. ${maxDay})`);
  }
}

function rowFields(data: z.infer<typeof upsertInput>) {
  if (data.prazoKind === "date_range") {
    if (
      !data.startMonth ||
      !data.startDay ||
      !data.dueMonth ||
      !data.dueDay
    ) {
      throw new Error("Informe o início e o fim do intervalo");
    }
    assertDayInMonth(data.startDay, data.startMonth, "Início");
    assertDayInMonth(data.dueDay, data.dueMonth, "Fim");
    if (
      dayOfYearKey(data.startMonth, data.startDay) ===
      dayOfYearKey(data.dueMonth, data.dueDay)
    ) {
      throw new Error("Início e fim do intervalo devem ser datas diferentes");
    }
    return {
      prazo_kind: data.prazoKind,
      due_date: null as string | null,
      due_year: null as number | null,
      start_month: data.startMonth,
      start_day: data.startDay,
      due_month: data.dueMonth,
      due_day: data.dueDay,
    };
  }
  if (data.prazoKind === "until_day") {
    if (!data.dueMonth || !data.dueDay) {
      throw new Error("Informe o dia e o mês do prazo");
    }
    assertDayInMonth(data.dueDay, data.dueMonth, "Data");
    return {
      prazo_kind: data.prazoKind,
      due_date: null as string | null,
      due_year: null as number | null,
      start_month: null as number | null,
      start_day: null as number | null,
      due_month: data.dueMonth,
      due_day: data.dueDay,
    };
  }
  if (!data.dueMonth) {
    throw new Error("Informe o mês do prazo");
  }
  return {
    prazo_kind: data.prazoKind,
    due_date: null as string | null,
    due_year: null as number | null,
    start_month: null as number | null,
    start_day: null as number | null,
    due_month: data.dueMonth,
    due_day: null as number | null,
  };
}

const SELECT_COLS =
  "id, scope, region_id, state_id, title, description, prazo_kind, due_date, due_year, due_month, due_day, start_month, start_day, created_at";

export const listOrgMandatoryDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => scopeInput.parse(raw))
  .handler(async ({ data, context }): Promise<OrgMandatoryDate[]> => {
    let q = context.supabase
      .from("org_mandatory_dates" as never)
      .select(SELECT_COLS)
      .order("created_at", { ascending: false });

    if (data.scopeType === "region") {
      q = q.eq("scope" as never, "region").eq("region_id" as never, data.scopeId);
    } else {
      q = q.eq("scope" as never, "state").eq("state_id" as never, data.scopeId);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as OrgMandatoryDate[];
  });

export const upsertOrgMandatoryDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => upsertInput.parse(raw))
  .handler(async ({ data, context }) => {
    const fields = rowFields(data);
    const payload = {
      scope: data.scopeType,
      region_id: data.scopeType === "region" ? data.scopeId : null,
      state_id: data.scopeType === "state" ? data.scopeId : null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      ...fields,
      created_by: context.userId,
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("org_mandatory_dates" as never)
        .update({
          title: payload.title,
          description: payload.description,
          prazo_kind: payload.prazo_kind,
          due_date: payload.due_date,
          due_year: payload.due_year,
          due_month: payload.due_month,
          due_day: payload.due_day,
          start_month: payload.start_month,
          start_day: payload.start_day,
        } as never)
        .eq("id" as never, data.id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Registro não encontrado ou sem permissão");
      return { id: (row as { id: string }).id };
    }

    const { data: row, error } = await context.supabase
      .from("org_mandatory_dates" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteOrgMandatoryDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("org_mandatory_dates" as never)
      .delete()
      .eq("id" as never, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMandatoryDatesForChapterMonth = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const rows = await loadMandatoryDatesForChapter(
      context.supabase,
      data.chapterId,
    );
    return rows
      .filter((r) => mandatoryDateAppliesToMonth(r, data.year, data.month))
      .map((r) => ({
        ...r,
        prazo_label: formatPrazoLabel(r),
      }));
  });

/** Todas as datas obrigatórias do capítulo (região/estado), sem filtrar por mês. */
export const listMandatoryDatesForChapter = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ chapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const rows = await loadMandatoryDatesForChapter(
      context.supabase,
      data.chapterId,
    );
    return rows.map((r) => ({
      ...r,
      prazo_label: formatPrazoLabel(r),
    }));
  });

async function loadMandatoryDatesForChapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chapterId: string,
): Promise<OrgMandatoryDate[]> {
  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .select("id, region_id, state_id")
    .eq("id", chapterId)
    .maybeSingle();
  if (chErr) throw new Error(chErr.message);
  if (!chapter) throw new Error("Capítulo não encontrado");

  const filters: string[] = [];
  if (chapter.region_id) {
    filters.push(`and(scope.eq.region,region_id.eq.${chapter.region_id})`);
  }
  if (chapter.state_id) {
    filters.push(`and(scope.eq.state,state_id.eq.${chapter.state_id})`);
  }
  if (filters.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("org_mandatory_dates" as never)
    .select(SELECT_COLS)
    .or(filters.join(","));
  if (error) throw new Error(error.message);

  return (rows ?? []) as OrgMandatoryDate[];
}
