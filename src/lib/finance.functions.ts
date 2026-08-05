import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { competenceLabel, duesDescription } from "@/lib/cash-categories";
import {
  autoDueStatus,
  getChapterDefaultDuesAmount,
  memberInYearTable,
  type AwayPeriod,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { isBudgetCategoryName } from "@/lib/event-finance.functions";
import { currentYearMonthInAppTz, todayYmd } from "@/lib/timezone";

const chapterInput = z.object({ chapterId: z.string().uuid() });

export { competenceLabel };

/** Início do mês seguinte (YYYY-MM-01), sem depender de fuso do `Date`. */
function periodEndDate(year: number, month: number | null): string {
  if (month == null) return `${year + 1}-01-01`;
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

type CashAggRow = { kind: string; amount: number | string };

/** Soma entradas/saídas paginando para não cortar no limite padrão do PostgREST. */
async function aggregateCashAmounts(
  supabase: { from: (t: string) => any },
  chapterId: string,
  opts: { from?: string; until?: string } = {},
): Promise<{ income: number; expense: number; balance: number }> {
  const rows = await fetchAllPages<CashAggRow>((from, to) => {
    let q = supabase
      .from("cash_entries")
      .select("kind, amount")
      .eq("chapter_id", chapterId)
      .order("entry_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (opts.from) q = q.gte("entry_date", opts.from);
    if (opts.until) q = q.lt("entry_date", opts.until);
    return q;
  });

  let income = 0;
  let expense = 0;
  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    if (r.kind === "entrada") income += amount;
    else expense += amount;
  }

  return { income, expense, balance: income - expense };
}

/** Busca todas as páginas de uma consulta PostgREST (range), até esgotar. */
async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function loadAwayPeriodsByMember(
  supabase: { from: (t: string) => any },
  chapterId: string,
  memberIds: string[],
): Promise<Map<string, AwayPeriod[]>> {
  const map = new Map<string, AwayPeriod[]>();
  if (memberIds.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from("member_away_periods")
      .select("member_id, started_on, ended_on")
      .eq("chapter_id", chapterId)
      .in("member_id", memberIds);
    // Tabela pode ainda não existir se a migration não foi aplicada
    if (error) {
      console.error("loadAwayPeriodsByMember:", error.message);
      return map;
    }
    for (const row of data ?? []) {
      const list = map.get(row.member_id) ?? [];
      list.push({ started_on: row.started_on, ended_on: row.ended_on });
      map.set(row.member_id, list);
    }
  } catch (e: any) {
    console.error("loadAwayPeriodsByMember:", e?.message ?? e);
  }
  return map;
}

async function loadManualInclusionIds(
  supabase: { from: (t: string) => any },
  chapterId: string,
  year: number,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("member_dues_manual_inclusions")
      .select("member_id")
      .eq("chapter_id", chapterId)
      .eq("year", year);
    if (error) {
      console.error("loadManualInclusionIds:", error.message);
      return [];
    }
    return (data ?? []).map((r: { member_id: string }) => r.member_id);
  } catch (e: any) {
    console.error("loadManualInclusionIds:", e?.message ?? e);
    return [];
  }
}

function withAwayPeriods(
  members: DueMemberLite[],
  byMember: Map<string, AwayPeriod[]>,
): DueMemberLite[] {
  return members.map((m) => ({
    ...m,
    awayPeriods: byMember.get(m.id) ?? [],
  }));
}

async function applyAutoStatusesForOpenDues(
  supabase: { from: (t: string) => any },
  chapterId: string,
  year: number,
  rows: { member_id: string; competence_month: number; status: string }[],
) {
  const autoIsento = new Set(
    rows
      .filter((r) => r.status === "isento")
      .map((r) => `${r.member_id}:${r.competence_month}`),
  );
  const autoDesligado = new Set(
    rows
      .filter((r) => r.status === "desligado")
      .map((r) => `${r.member_id}:${r.competence_month}`),
  );
  if (autoIsento.size === 0 && autoDesligado.size === 0) return;

  const { data: openRows, error: openErr } = await supabase
    .from("member_dues")
    .select("id, member_id, competence_month")
    .eq("chapter_id", chapterId)
    .eq("competence_year", year)
    .eq("status", "em_aberto")
    .is("cash_entry_id", null);
  if (openErr) throw new Error(openErr.message);

  const isentoIds = (openRows ?? [])
    .filter((r: { member_id: string; competence_month: number }) =>
      autoIsento.has(`${r.member_id}:${r.competence_month}`),
    )
    .map((r: { id: string }) => r.id);
  const desligadoIds = (openRows ?? [])
    .filter((r: { member_id: string; competence_month: number }) =>
      autoDesligado.has(`${r.member_id}:${r.competence_month}`),
    )
    .map((r: { id: string }) => r.id);

  for (let i = 0; i < isentoIds.length; i += 200) {
    const chunk = isentoIds.slice(i, i + 200);
    const { error } = await supabase
      .from("member_dues")
      .update({ status: "isento", paid_at: null })
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < desligadoIds.length; i += 200) {
    const chunk = desligadoIds.slice(i, i + 200);
    const { error } = await supabase
      .from("member_dues")
      .update({ status: "desligado", paid_at: null })
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }
}

/* ----------------------------- Fluxo de caixa ---------------------------- */

/** Lista todos os lançamentos do período, paginando além do limite padrão do PostgREST. */
async function listCashEntriesRows(
  supabase: { from: (t: string) => any },
  chapterId: string,
  periodStart: string,
  periodEnd: string,
) {
  const pageSize = 1000;
  let offset = 0;
  const all: Array<{
    id: string;
    kind: "entrada" | "saida";
    category: string;
    subcategory: string | null;
    description: string;
    amount: number | string;
    entry_date: string;
    created_at: string;
    event_id: string | null;
    event_finance_item_id: string | null;
    calendar_event_id: string | null;
  }> = [];

  for (;;) {
    const { data, error } = await supabase
      .from("cash_entries")
      .select(
        "id, kind, category, subcategory, description, amount, entry_date, created_at, event_id, event_finance_item_id, calendar_event_id",
      )
      .eq("chapter_id", chapterId)
      .gte("entry_date", periodStart)
      .lt("entry_date", periodEnd)
      .order("entry_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/**
 * Lista lançamentos do mês ou de todo o ano (`month: null`) e devolve
 * totais do banco, além do saldo de abertura (caixa remanescente do ano anterior /
 * acumulado até o início do período).
 */
export const listCashEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        month: z.number().int().min(1).max(12).nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const periodStart = data.month
      ? `${data.year}-${String(data.month).padStart(2, "0")}-01`
      : `${data.year}-01-01`;
    const periodEnd = periodEndDate(data.year, data.month);

    const [entries, openingAgg, periodAgg, bankAgg] = await Promise.all([
      listCashEntriesRows(
        context.supabase,
        data.chapterId,
        periodStart,
        periodEnd,
      ),
      aggregateCashAmounts(context.supabase, data.chapterId, {
        until: periodStart,
      }),
      aggregateCashAmounts(context.supabase, data.chapterId, {
        from: periodStart,
        until: periodEnd,
      }),
      aggregateCashAmounts(context.supabase, data.chapterId),
    ]);

    const eventIds = [
      ...new Set(
        entries.map((e) => e.event_id).filter((id): id is string => !!id),
      ),
    ];
    const eventNameById = new Map<string, string>();
    if (eventIds.length > 0) {
      const { data: events, error: eventsErr } = await context.supabase
        .from("events")
        .select("id, name")
        .in("id", eventIds);
      if (eventsErr) throw new Error(eventsErr.message);
      for (const ev of events ?? []) {
        eventNameById.set(ev.id, ev.name);
      }
    }

    return {
      entries: entries.map((e) => ({
        ...e,
        event_name: e.event_id ? (eventNameById.get(e.event_id) ?? null) : null,
      })),
      totals: periodAgg,
      bank: bankAgg,
      opening: {
        balance: openingAgg.balance,
        previousYear: data.year - 1,
      },
    };
  });

export const createCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        kind: z.enum(["entrada", "saida"]),
        category: z.string().min(1).default("Outras"),
        subcategoryId: z.string().uuid().nullable().default(null),
        eventId: z.string().uuid().nullable().default(null),
        description: z.string().min(1, "Informe a descrição"),
        amount: z.number().nonnegative(),
        entry_date: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { resolveSubcategory } = await import("@/lib/cash-validation.server");
    const resolved = await resolveSubcategory(
      context.supabase,
      data.chapterId,
      data.category,
      data.subcategoryId,
      data.eventId,
    );
    const { error } = await context.supabase.from("cash_entries").insert({
      chapter_id: data.chapterId,
      kind: data.kind,
      category: data.category,
      subcategory: resolved.subcategory,
      calendar_event_id: resolved.calendar_event_id,
      event_id: resolved.event_id,
      event_finance_item_id: resolved.event_finance_item_id,
      description: data.description,
      amount: data.amount,
      entry_date: data.entry_date,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["entrada", "saida"]),
        category: z.string().min(1),
        subcategoryId: z.string().uuid().nullable().default(null),
        eventId: z.string().uuid().nullable().default(null),
        description: z.string().min(1),
        amount: z.number().nonnegative(),
        entry_date: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { resolveSubcategory } = await import("@/lib/cash-validation.server");
    const { data: current, error: curErr } = await context.supabase
      .from("cash_entries")
      .select("chapter_id")
      .eq("id", data.id)
      .single();
    if (curErr) throw new Error(curErr.message);

    const resolved = await resolveSubcategory(
      context.supabase,
      current.chapter_id,
      data.category,
      data.subcategoryId,
      data.eventId,
    );

    const { id, subcategoryId, eventId: _eventId, ...patch } = data;
    const { error } = await context.supabase
      .from("cash_entries")
      .update({
        ...patch,
        subcategory: resolved.subcategory,
        calendar_event_id: resolved.calendar_event_id,
        event_id: resolved.event_id,
        event_finance_item_id: resolved.event_finance_item_id,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    // Reverte pagamento de cobrança vinculado a este lançamento
    const { data: linkedPays } = await context.supabase
      .from("member_charge_payments" as never)
      .select("id, charge_id, chapter_id")
      .eq("cash_entry_id", data.id);

    for (const pay of (linkedPays as Array<{
      id: string;
      charge_id: string;
      chapter_id: string;
    }> | null) ?? []) {
      await context.supabase
        .from("member_charge_payments" as never)
        .delete()
        .eq("id", pay.id);
      await recalcMemberChargeStatus(
        context.supabase,
        pay.chapter_id,
        pay.charge_id,
      );
    }

    // Cobrança legada com cash_entry_id direto (sem linha de pagamento)
    const { data: linkedCharges } = await context.supabase
      .from("member_charges")
      .select("id, chapter_id, amount, status")
      .eq("cash_entry_id", data.id);
    for (const ch of linkedCharges ?? []) {
      const { data: pays } = await context.supabase
        .from("member_charge_payments" as never)
        .select("id")
        .eq("charge_id", ch.id)
        .limit(1);
      if (!pays?.length) {
        await context.supabase
          .from("member_charges")
          .update({
            status: ch.status === "isento" ? "isento" : "em_aberto",
            paid_at: null,
            cash_entry_id: null,
          })
          .eq("id", ch.id);
      } else {
        await context.supabase
          .from("member_charges")
          .update({ cash_entry_id: null })
          .eq("id", ch.id);
        await recalcMemberChargeStatus(context.supabase, ch.chapter_id, ch.id);
      }
    }

    // Mensalidade vinculada: reabre competência
    await context.supabase
      .from("member_dues")
      .update({ status: "em_aberto", paid_at: null, cash_entry_id: null })
      .eq("cash_entry_id", data.id);

    const { error } = await context.supabase
      .from("cash_entries")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function recalcMemberChargeStatus(
  supabase: { from: (t: string) => any },
  chapterId: string,
  chargeId: string,
) {
  const { data: charge, error: chErr } = await supabase
    .from("member_charges")
    .select("id, amount, status, cash_entry_id")
    .eq("id", chargeId)
    .eq("chapter_id", chapterId)
    .maybeSingle();
  if (chErr) throw new Error(chErr.message);
  if (!charge || charge.status === "isento") return;

  const totalDue = Number(charge.amount) || 0;
  const { data: pays, error: payErr } = await supabase
    .from("member_charge_payments" as never)
    .select("amount, paid_at, cash_entry_id")
    .eq("charge_id", chargeId);
  if (payErr) throw new Error(payErr.message);

  const rows = (pays ?? []) as Array<{
    amount: number | string;
    paid_at: string;
    cash_entry_id: string | null;
  }>;
  const paid = rows.reduce((s, p) => s + Number(p.amount), 0);
  const fullyPaid = totalDue > 0 && paid + 0.001 >= totalDue;
  const lastPaidAt =
    rows
      .map((p) => p.paid_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const lastCashId =
    rows.filter((p) => p.cash_entry_id).at(-1)?.cash_entry_id ?? null;

  const { error } = await supabase
    .from("member_charges")
    .update({
      status: fullyPaid ? "pago" : "em_aberto",
      paid_at: fullyPaid ? lastPaidAt : null,
      cash_entry_id: fullyPaid ? lastCashId : null,
    })
    .eq("id", chargeId);
  if (error) throw new Error(error.message);
}
/** Importação em lote (planilha revisada pelo usuário). */
export const importCashEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        rows: z
          .array(
            z.object({
              kind: z.enum(["entrada", "saida"]),
              category: z.string().min(1),
              description: z.string().min(1),
              amount: z.number().nonnegative(),
              entry_date: z.string().min(1),
            }),
          )
          .min(1)
          .max(1000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cash_entries").insert(
      data.rows.map((r) => ({
        chapter_id: data.chapterId,
        kind: r.kind,
        category: r.category,
        description: r.description,
        amount: r.amount,
        entry_date: r.entry_date,
        created_by: context.userId,
      })),
    );
    if (error) throw new Error(error.message);
    return { imported: data.rows.length };
  });

/* ------------------------------- Categorias ------------------------------ */

/**
 * Categorias fixas do capítulo + subcategorias dinâmicas configuradas pelas
 * comissões de Eventos e Hospitalaria (com os eventos do calendário).
 */
export const listCashCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const [cats, calendar, subs, opsEvents, financeItems] = await Promise.all([
      context.supabase
        .from("cash_categories")
        .select("id, name, sort_order, is_system")
        .eq("chapter_id", data.chapterId)
        .order("sort_order")
        .order("name"),
      context.supabase
        .from("calendar_events")
        .select("id, title, start_at")
        .eq("chapter_id", data.chapterId)
        .in("event_type", ["evento", "filantropia", "entretenimento"])
        .order("start_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("cash_subcategories")
        .select("id, scope, calendar_event_id, name, active")
        .eq("chapter_id", data.chapterId)
        .eq("active", true)
        .order("name"),
      context.supabase
        .from("events")
        .select("id, name, starts_at, status")
        .eq("chapter_id", data.chapterId)
        .in("status", ["rascunho", "publicado"])
        .order("starts_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("event_finance_items")
        .select(
          "id, event_id, category_id, name, unit_price, track_stock, stock_qty, active, category:event_finance_categories(name)",
        )
        .eq("chapter_id", data.chapterId)
        .eq("active", true)
        .order("name"),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (calendar.error) throw new Error(calendar.error.message);
    if (subs.error) throw new Error(subs.error.message);
    if (opsEvents.error) throw new Error(opsEvents.error.message);
    if (financeItems.error) throw new Error(financeItems.error.message);

    const revenueFinanceItems = (financeItems.data ?? []).filter((i) => {
      const cat = i.category as { name?: string } | null;
      return !isBudgetCategoryName(cat?.name ?? "");
    });

    return {
      categories: cats.data ?? [],
      /** @deprecated legado calendar_events — use operationalEvents */
      events: calendar.data ?? [],
      subcategories: subs.data ?? [],
      operationalEvents: (opsEvents.data ?? []).map((e) => ({
        id: e.id,
        title: e.name,
        start_at: e.starts_at,
        status: e.status,
      })),
      eventFinanceItems: revenueFinanceItems.map((i) => ({
        id: i.id,
        event_id: i.event_id,
        category_id: i.category_id,
        name: i.name,
        unit_price: i.unit_price == null ? null : Number(i.unit_price),
        track_stock: i.track_stock,
        stock_qty: i.stock_qty,
        active: i.active,
        scope: "eventos" as const,
      })),
    };
  });

export const upsertCashCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "Informe o nome").max(60),
        sort_order: z.number().int().default(100),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("cash_categories")
        .update({ name: data.name, sort_order: data.sort_order })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("cash_categories").insert({
        chapter_id: data.chapterId,
        name: data.name,
        sort_order: data.sort_order,
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCashCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cash_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Mensalidades ----------------------------- */

async function readDefaultDuesAmount(
  supabase: { from: (t: string) => any },
  chapterId: string,
): Promise<number> {
  const { data } = await supabase
    .from("chapters")
    .select("settings")
    .eq("id", chapterId)
    .single();
  return getChapterDefaultDuesAmount({
    settings: (data?.settings ?? {}) as Record<string, unknown>,
  });
}

async function readDuesEnabled(
  supabase: { from: (t: string) => any },
  chapterId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("chapters")
    .select("settings")
    .eq("id", chapterId)
    .single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  if (
    settings.dues_enabled === false ||
    settings.dues_enabled === "false" ||
    settings.dues_enabled === 0 ||
    settings.dues_enabled === "0"
  ) {
    return false;
  }
  return true;
}

/** Persistência do valor padrão de mensalidade em chapters.settings. */
export const saveDefaultDuesAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ amount: z.number().nonnegative() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: amount, error } = await context.supabase.rpc(
      "save_default_dues_amount" as never,
      {
        _chapter_id: data.chapterId,
        _amount: data.amount,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { amount: Number(amount ?? data.amount) };
  });

/** Liga/desliga cobrança de mensalidade do capítulo (settings.dues_enabled). */
export const saveChapterDuesEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ enabled: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: settings, error } = await context.supabase.rpc(
      "patch_chapter_settings" as never,
      {
        _chapter_id: data.chapterId,
        _patch: { dues_enabled: data.enabled },
      } as never,
    );
    if (error) throw new Error(error.message);
    return { enabled: data.enabled, settings };
  });

const MEMBER_DUES_SELECT =
  "id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico, phone";

type YearDuesResult = {
  members: DueMemberLite[];
  dues: {
    id: string;
    member_id: string;
    amount: number | string;
    status: string;
    paid_at: string | null;
    competence_year: number;
    competence_month: number;
    cash_entry_id: string | null;
  }[];
  defaultAmount: number;
};

/** Núcleo compartilhado do calendário anual (evita reentrada de createServerFn). */
async function fetchYearDues(
  supabase: { from: (t: string) => any },
  userId: string,
  chapterId: string,
  year: number,
  ensure: boolean,
): Promise<YearDuesResult> {
  const membersQuery = supabase
    .from("members")
    .select(MEMBER_DUES_SELECT)
    .eq("chapter_id", chapterId)
    .eq("status", "regular")
    .in("kind", ["demolay_ativo", "senior"])
    .order("full_name");

  const duesQuery = supabase
    .from("member_dues")
    .select(
      "id, member_id, amount, status, paid_at, competence_year, competence_month, cash_entry_id",
    )
    .eq("chapter_id", chapterId)
    .eq("competence_year", year);

  async function resolveMembers(
    baseRows: DueMemberLite[],
    inclusionIds: string[],
    duesMemberIds: string[],
  ): Promise<DueMemberLite[]> {
    const eligible = baseRows
      .filter((m) => memberInYearTable(m, year))
      .map((m) => ({ ...m, manualInclude: false }));

    const byId = new Map(eligible.map((m) => [m.id, m]));
    const extraIds = [
      ...new Set(
        [...inclusionIds, ...duesMemberIds].filter((id) => !byId.has(id)),
      ),
    ];

    if (extraIds.length > 0) {
      const { data: extra, error } = await supabase
        .from("members")
        .select(MEMBER_DUES_SELECT)
        .eq("chapter_id", chapterId)
        .in("id", extraIds)
        .order("full_name");
      if (error) throw new Error(error.message);
      const inclusionSet = new Set(inclusionIds);
      for (const m of (extra ?? []) as DueMemberLite[]) {
        byId.set(m.id, {
          ...m,
          // Sem tabela de inclusões, quem só entra via dues conta como manual
          manualInclude: inclusionSet.has(m.id) || !memberInYearTable(m, year),
        });
      }
    }

    for (const id of inclusionIds) {
      const m = byId.get(id);
      if (m) byId.set(id, { ...m, manualInclude: true });
    }

    return [...byId.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, "pt-BR"),
    );
  }

  const [defaultAmount, duesEnabled, membersRes, duesRes, inclusionIds] =
    await Promise.all([
      readDefaultDuesAmount(supabase, chapterId),
      readDuesEnabled(supabase, chapterId),
      membersQuery,
      duesQuery,
      loadManualInclusionIds(supabase, chapterId, year),
    ]);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (duesRes.error) throw new Error(duesRes.error.message);

  let dues = duesRes.data ?? [];
  const duesMemberIds = [
    ...new Set(
      dues.map((d: { member_id: string }) => d.member_id as string),
    ),
  ] as string[];

  let members = await resolveMembers(
    (membersRes.data ?? []) as DueMemberLite[],
    inclusionIds,
    duesMemberIds,
  );
  const away = await loadAwayPeriodsByMember(
    supabase,
    chapterId,
    members.map((m) => m.id),
  );
  members = withAwayPeriods(members, away);

  if (ensure && duesEnabled && members.length > 0) {
    const rows = members.flatMap((m) =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        return {
          chapter_id: chapterId,
          member_id: m.id,
          competence_year: year,
          competence_month: month,
          amount: defaultAmount,
          status: autoDueStatus(m, year, month),
          created_by: userId,
        };
      }),
    );
    const { error: ensErr } = await supabase.from("member_dues").upsert(rows, {
      onConflict: "chapter_id,member_id,competence_year,competence_month",
      ignoreDuplicates: true,
    });
    if (ensErr) {
      // Ainda devolve membros para a UI não ficar vazia (ex.: enum/migration pendente)
      console.error("listYearDues ensure upsert:", ensErr.message);
    } else {
      try {
        await applyAutoStatusesForOpenDues(supabase, chapterId, year, rows);
      } catch (e: any) {
        console.error("listYearDues applyAutoStatuses:", e?.message ?? e);
      }
      const refreshed = await duesQuery;
      if (!refreshed.error) dues = refreshed.data ?? [];
    }
  }

  return { members, dues, defaultAmount };
}

/**
 * Calendário anual: membros elegíveis + inclusões manuais + quem já tem competência no ano.
 */
export const listYearDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        ensure: z.boolean().optional().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) =>
    fetchYearDues(
      context.supabase,
      context.userId,
      data.chapterId,
      data.year,
      data.ensure ?? true,
    ),
  );

/** Candidatos a inclusão manual (qualquer membro do capítulo fora da tabela do ano, incl. irregulares). */
export const listDuesInclusionCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ year: z.number().int() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const yearData = await fetchYearDues(
      context.supabase,
      context.userId,
      data.chapterId,
      data.year,
      false,
    );
    const inTable = new Set(yearData.members.map((m) => m.id));

    const { data: all, error } = await context.supabase
      .from("members")
      .select("id, full_name, status, kind")
      .eq("chapter_id", data.chapterId)
      .order("full_name");
    if (error) throw new Error(error.message);

    const candidates = ((all ?? []) as DueMemberLite[])
      .filter((m) => !inTable.has(m.id))
      .map((m) => ({
        id: m.id,
        full_name: m.full_name,
        status: m.status,
        kind: m.kind,
      }));

    candidates.sort((a, b) => {
      const ai = a.status === "irregular" ? 0 : 1;
      const bi = b.status === "irregular" ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.full_name.localeCompare(b.full_name, "pt-BR");
    });

    return {
      candidates,
      inTableCount: inTable.size,
      chapterMemberCount: (all ?? []).length,
    };
  });

/** Inclui membro manualmente no calendário do ano e gera competências. */
export const includeMemberInYearDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        memberId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: mErr } = await context.supabase
      .from("members")
      .select(
        "id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico, chapter_id",
      )
      .eq("id", data.memberId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Membro não encontrado neste capítulo");

    const { error: incErr } = await context.supabase
      .from("member_dues_manual_inclusions")
      .upsert(
        {
          chapter_id: data.chapterId,
          member_id: data.memberId,
          year: data.year,
          created_by: context.userId,
        },
        { onConflict: "chapter_id,member_id,year" },
      );
    if (incErr) {
      if (
        /member_dues_manual_inclusions|does not exist|schema cache/i.test(
          incErr.message,
        )
      ) {
        // Migration ainda não aplicada: segue só com as competências do ano
        console.warn(
          "includeMemberInYearDues: tabela de inclusões ausente — usando só member_dues",
        );
      } else {
        throw new Error(incErr.message);
      }
    }

    // Irregular sem período aberto: abre afastamento no ano para marcar meses como desligado
    if (member.status === "irregular") {
      const { data: openAway } = await context.supabase
        .from("member_away_periods")
        .select("id")
        .eq("member_id", data.memberId)
        .is("ended_on", null)
        .maybeSingle();
      if (!openAway) {
        const { error: awayErr } = await context.supabase
          .from("member_away_periods")
          .insert({
            member_id: data.memberId,
            chapter_id: data.chapterId,
            started_on: `${data.year}-01-01`,
            ended_on: null,
            created_by: context.userId,
          });
        if (awayErr) {
          if (
            !/member_away_periods|does not exist|schema cache/i.test(
              awayErr.message,
            )
          ) {
            throw new Error(awayErr.message);
          }
          console.warn(
            "includeMemberInYearDues: tabela de afastamentos ausente",
          );
        }
      }
    }

    const defaultAmount = await readDefaultDuesAmount(
      context.supabase,
      data.chapterId,
    );
    const away = await loadAwayPeriodsByMember(
      context.supabase,
      data.chapterId,
      [data.memberId],
    );
    const lite: DueMemberLite = {
      ...(member as DueMemberLite),
      awayPeriods: away.get(data.memberId) ?? [],
      manualInclude: true,
    };

    const rows = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return {
        chapter_id: data.chapterId,
        member_id: data.memberId,
        competence_year: data.year,
        competence_month: month,
        amount: defaultAmount,
        status: autoDueStatus(lite, data.year, month),
        created_by: context.userId,
      };
    });

    const { error: duesErr } = await context.supabase
      .from("member_dues")
      .upsert(rows, {
        onConflict: "chapter_id,member_id,competence_year,competence_month",
        ignoreDuplicates: true,
      });
    if (duesErr) throw new Error(duesErr.message);

    await applyAutoStatusesForOpenDues(
      context.supabase,
      data.chapterId,
      data.year,
      rows,
    );

    return { ok: true, memberId: data.memberId };
  });

/** Remove inclusão manual e as competências do ano (lançamentos de caixa já feitos permanecem). */
export const removeMemberFromYearDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        memberId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error: incErr } = await context.supabase
      .from("member_dues_manual_inclusions")
      .delete()
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .eq("year", data.year);
    if (
      incErr &&
      !/member_dues_manual_inclusions|does not exist|schema cache/i.test(
        incErr.message,
      )
    ) {
      throw new Error(incErr.message);
    }

    // Sem isso o membro reaparece via competências existentes no ano
    const { error: duesErr } = await context.supabase
      .from("member_dues")
      .delete()
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .eq("competence_year", data.year);
    if (duesErr) throw new Error(duesErr.message);

    return { ok: true };
  });

/** Compat: lista um mês a partir do calendário anual. */
export const listDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const yearData = await fetchYearDues(
      context.supabase,
      context.userId,
      data.chapterId,
      data.year,
      false,
    );
    return {
      members: yearData.members,
      dues: yearData.dues.filter((d) => d.competence_month === data.month),
      defaultAmount: yearData.defaultAmount,
    };
  });

export const upsertDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        memberId: z.string().uuid(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        amount: z.number().nonnegative(),
        status: z.enum(["em_aberto", "pago", "isento", "desligado"]),
        paidAt: z.string().optional(),
        /** Se true, marca pago sem criar lançamento no fluxo de caixa. */
        skipCashEntry: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const paidAt = data.paidAt || todayYmd();

    const { data: existing } = await context.supabase
      .from("member_dues")
      .select("id, status, cash_entry_id")
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .eq("competence_year", data.year)
      .eq("competence_month", data.month)
      .maybeSingle();

    let cashEntryId: string | null = existing?.cash_entry_id ?? null;

    if (data.status !== "pago" && cashEntryId) {
      await context.supabase
        .from("cash_entries")
        .delete()
        .eq("id", cashEntryId);
      cashEntryId = null;
    }

    const needsCashEntry =
      data.status === "pago" &&
      !cashEntryId &&
      data.amount > 0 &&
      !data.skipCashEntry;

    if (needsCashEntry) {
      const { data: member, error: memberErr } = await context.supabase
        .from("members")
        .select("full_name")
        .eq("id", data.memberId)
        .single();
      if (memberErr) throw new Error(memberErr.message);

      const { data: entry, error: entryErr } = await context.supabase
        .from("cash_entries")
        .insert({
          chapter_id: data.chapterId,
          kind: "entrada",
          category: "Mensalidades",
          description: `Mensalidade - ${member.full_name} - ${competenceLabel(data.year, data.month)}`,
          amount: data.amount,
          entry_date: paidAt,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (entryErr) throw new Error(entryErr.message);
      cashEntryId = entry.id;
    }

    const payload = {
      chapter_id: data.chapterId,
      member_id: data.memberId,
      competence_year: data.year,
      competence_month: data.month,
      amount: data.amount,
      status: data.status,
      paid_at: data.status === "pago" ? paidAt : null,
      cash_entry_id: cashEntryId,
      created_by: context.userId,
    };

    const { data: row, error } = await context.supabase
      .from("member_dues")
      .upsert(payload, {
        onConflict: "chapter_id,member_id,competence_year,competence_month",
      })
      .select(
        "id, member_id, amount, status, paid_at, competence_year, competence_month, cash_entry_id",
      )
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Ações em lote no calendário do ano.
 * - pay_all / pay_except_jan_dec: baixa em aberto (mês atual e anteriores)
 *   (pay_except_jan_dec = exceto janeiro; dezembro é cobrado)
 * - open_all: reabre todas as competências do ano (remove caixa vinculado)
 * - exempt_all: isenta todas as competências do ano (remove caixa vinculado)
 */
export const bulkYearDuesAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        action: z.enum([
          "pay_all",
          "pay_except_jan_dec",
          "open_all",
          "exempt_all",
        ]),
        amount: z.number().nonnegative().optional(),
        paidAt: z.string().optional(),
        skipCashEntry: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const amount =
      data.amount ??
      (await readDefaultDuesAmount(context.supabase, data.chapterId));
    const paidAt = data.paidAt || todayYmd();
    const { year: currentYear, month: currentMonth } =
      currentYearMonthInAppTz();
    const maxMonth =
      data.year > currentYear ? 0 : data.year < currentYear ? 12 : currentMonth;

    if (data.action === "pay_all" || data.action === "pay_except_jan_dec") {
      if (maxMonth === 0) return { updated: 0, action: data.action };

      let q = context.supabase
        .from("member_dues")
        .select(
          "id, member_id, competence_month, cash_entry_id, members(full_name)",
        )
        .eq("chapter_id", data.chapterId)
        .eq("competence_year", data.year)
        .eq("status", "em_aberto")
        .lte("competence_month", maxMonth);

      const { data: openRows, error: openErr } = await q;
      if (openErr) throw new Error(openErr.message);

      const toPay = (openRows ?? []).filter((d) =>
        data.action === "pay_except_jan_dec" ? d.competence_month !== 1 : true,
      );

      let updated = 0;
      for (const d of toPay) {
        let cashEntryId: string | null = d.cash_entry_id ?? null;
        const memberName =
          (d.members as { full_name?: string } | null)?.full_name ?? "Membro";

        if (!cashEntryId && amount > 0 && !data.skipCashEntry) {
          const { data: entry, error: entryErr } = await context.supabase
            .from("cash_entries")
            .insert({
              chapter_id: data.chapterId,
              kind: "entrada",
              category: "Mensalidades",
              description: `Mensalidade - ${memberName} - ${competenceLabel(data.year, d.competence_month)}`,
              amount,
              entry_date: paidAt,
              created_by: context.userId,
            })
            .select("id")
            .single();
          if (entryErr) throw new Error(entryErr.message);
          cashEntryId = entry.id;
        }

        const { error } = await context.supabase
          .from("member_dues")
          .update({
            status: "pago",
            amount,
            paid_at: paidAt,
            cash_entry_id: cashEntryId,
          })
          .eq("id", d.id);
        if (error) throw new Error(error.message);
        updated += 1;
      }
      return { updated, action: data.action };
    }

    // open_all / exempt_all
    const targetStatus = data.action === "open_all" ? "em_aberto" : "isento";
    const { data: rows, error: rowsErr } = await context.supabase
      .from("member_dues")
      .select("id, cash_entry_id, status")
      .eq("chapter_id", data.chapterId)
      .eq("competence_year", data.year);
    if (rowsErr) throw new Error(rowsErr.message);

    const cashIds = (rows ?? [])
      .map((r) => r.cash_entry_id)
      .filter((id): id is string => !!id);
    if (cashIds.length > 0) {
      for (let i = 0; i < cashIds.length; i += 200) {
        const chunk = cashIds.slice(i, i + 200);
        const { error: delErr } = await context.supabase
          .from("cash_entries")
          .delete()
          .in("id", chunk);
        if (delErr) throw new Error(delErr.message);
      }
    }

    const ids = (rows ?? []).map((r) => r.id);
    let updated = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error, count } = await context.supabase
        .from("member_dues")
        .update({
          status: targetStatus,
          paid_at: null,
          cash_entry_id: null,
          amount,
        })
        .in("id", chunk);
      if (error) throw new Error(error.message);
      updated += count ?? chunk.length;
    }
    return { updated, action: data.action };
  });

/** Gera competências do ano/mês com isenções automáticas (não sobrescreve existentes). */
export const generateDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        month: z.number().int().min(1).max(12).optional(),
        amount: z.number().nonnegative().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (!(await readDuesEnabled(context.supabase, data.chapterId))) {
      throw new Error(
        "Este capítulo não cobra mensalidade. Ative em Configurações.",
      );
    }
    const amount =
      data.amount ??
      (await readDefaultDuesAmount(context.supabase, data.chapterId));

    const { data: allMembers, error: mErr } = await context.supabase
      .from("members")
      .select(
        "id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico",
      )
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .in("kind", ["demolay_ativo", "senior"]);
    if (mErr) throw new Error(mErr.message);

    let members = ((allMembers ?? []) as DueMemberLite[]).filter((m) =>
      memberInYearTable(m, data.year),
    );
    const away = await loadAwayPeriodsByMember(
      context.supabase,
      data.chapterId,
      members.map((m) => m.id),
    );
    members = withAwayPeriods(members, away);

    const months = data.month
      ? [data.month]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    const rows = members.flatMap((m) =>
      months.map((month) => ({
        chapter_id: data.chapterId,
        member_id: m.id,
        competence_year: data.year,
        competence_month: month,
        amount,
        status: autoDueStatus(m, data.year, month),
        created_by: context.userId,
      })),
    );

    if (rows.length === 0) return { created: 0 };

    const { error } = await context.supabase.from("member_dues").upsert(rows, {
      onConflict: "chapter_id,member_id,competence_year,competence_month",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });

/* --------------------- Assinaturas do relatório (PDF) -------------------- */

/** Nomes de PCC, MC, Tesoureiro e Consultor da Tesouraria para o relatório. */
export const getFinanceSigners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { year, month } = currentYearMonthInAppTz();
    const semester = month <= 6 ? 1 : 2;

    const { data: rows, error } = await context.supabase
      .from("member_positions")
      .select(
        "member_id, term_year, term_semester, positions(code, label), members(full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .eq("term_year", year)
      .eq("term_semester", semester);
    if (error) throw new Error(error.message);

    type PositionRow = {
      positions: { code: string } | null;
      members: { full_name: string | null } | null;
    };

    const find = (codes: string[]) =>
      ((rows ?? []) as PositionRow[]).find((r) =>
        codes.includes(r.positions?.code ?? ""),
      )?.members?.full_name ?? "";

    return [
      {
        role: "Presidente do Conselho Consultivo",
        name: find(["presidente_conselho", "pcc"]),
      },
      { role: "Mestre Conselheiro", name: find(["mestre_conselheiro", "mc"]) },
      { role: "Tesoureiro", name: find(["tesoureiro", "tes"]) },
      {
        role: "Consultor da Tesouraria",
        name: find(["consultor_tesouraria", "consultor"]),
      },
    ];
  });

/* -------------------- Mensalidade: lançamento manual --------------------- */

/**
 * Lançamento manual de mensalidade (vários meses, valor negociado, ajustes).
 * Mantém a descrição padrão e marca as competências como pagas.
 */
export const createManualDuesEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        memberId: z.string().uuid(),
        competences: z
          .array(
            z.object({
              year: z.number().int(),
              month: z.number().int().min(1).max(12),
            }),
          )
          .min(1, "Selecione ao menos uma competência")
          .max(24),
        amount: z.number().nonnegative(),
        entry_date: z.string().min(1),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: memberErr } = await context.supabase
      .from("members")
      .select("full_name")
      .eq("id", data.memberId)
      .single();
    if (memberErr) throw new Error(memberErr.message);

    const description = duesDescription(member.full_name, data.competences);

    const { data: entry, error: entryErr } = await context.supabase
      .from("cash_entries")
      .insert({
        chapter_id: data.chapterId,
        kind: "entrada",
        category: "Mensalidades",
        description,
        amount: data.amount,
        entry_date: data.entry_date,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (entryErr) throw new Error(entryErr.message);

    const share =
      data.competences.length > 0 ? data.amount / data.competences.length : 0;
    const { error: duesErr } = await context.supabase
      .from("member_dues")
      .upsert(
        data.competences.map((c) => ({
          chapter_id: data.chapterId,
          member_id: data.memberId,
          competence_year: c.year,
          competence_month: c.month,
          amount: Number(share.toFixed(2)),
          status: "pago" as const,
          paid_at: data.entry_date,
          cash_entry_id: entry.id,
          notes: data.notes ?? null,
          created_by: context.userId,
        })),
        { onConflict: "chapter_id,member_id,competence_year,competence_month" },
      );
    if (duesErr) throw new Error(duesErr.message);

    return { ok: true, description };
  });

/** Membros ativos do capítulo (para o lançamento manual de mensalidade). */
export const listActiveMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("members")
      .select("id, full_name")
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .eq("kind", "demolay_ativo")
      .order("full_name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ------------------------------- Cobranças ------------------------------- */

export const listMemberCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        status: z
          .enum(["all", "em_aberto", "pago", "isento"])
          .optional()
          .default("all"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("member_charges")
      .select(
        "id, member_id, kind, category, subcategory, description, amount, due_date, status, paid_at, cash_entry_id, notes, created_at, members(full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .order("due_date", { ascending: false })
      .limit(500);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const chargeIds = (rows ?? []).map((r: any) => r.id as string);
    const paidByCharge = new Map<string, number>();
    if (chargeIds.length) {
      const { data: payments, error: payErr } = await context.supabase
        .from("member_charge_payments" as never)
        .select("charge_id, amount")
        .eq("chapter_id", data.chapterId)
        .in("charge_id", chargeIds);
      if (payErr) {
        // Tabela pode ainda não existir se a migration não foi aplicada
        console.error("listMemberCharges payments:", payErr.message);
      } else {
        for (const p of (payments as Array<{
          charge_id: string;
          amount: number | string;
        }>) ?? []) {
          paidByCharge.set(
            p.charge_id,
            (paidByCharge.get(p.charge_id) ?? 0) + Number(p.amount),
          );
        }
      }
    }

    return (rows ?? []).map((r: any) => {
      const amount = Number(r.amount) || 0;
      let amountPaid = paidByCharge.get(r.id) ?? 0;
      // Legacy: pago com cash_entry e sem linhas de pagamento
      if (amountPaid === 0 && r.status === "pago" && r.cash_entry_id) {
        amountPaid = amount;
      }
      return {
        ...r,
        member_name: r.members?.full_name ?? "",
        members: undefined,
        amount_paid: Math.min(amountPaid, amount),
      };
    });
  });

export const listChargePayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chargeId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("member_charge_payments" as never)
      .select("id, amount, paid_at, cash_entry_id, notes, created_at")
      .eq("charge_id", data.chargeId)
      .order("paid_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addChargePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        chargeId: z.string().uuid(),
        amount: z.number().positive(),
        paidAt: z.string().min(1),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: charge, error: chargeErr } = await context.supabase
      .from("member_charges")
      .select(
        "id, chapter_id, kind, category, subcategory, description, amount, status, cash_entry_id",
      )
      .eq("id", data.chargeId)
      .eq("chapter_id", data.chapterId)
      .single();
    if (chargeErr) throw new Error(chargeErr.message);
    if (charge.status === "isento") {
      throw new Error("Cobrança isenta não recebe pagamentos");
    }

    const totalDue = Number(charge.amount) || 0;

    const { data: existingPays, error: payListErr } = await context.supabase
      .from("member_charge_payments" as never)
      .select("amount")
      .eq("charge_id", data.chargeId);
    if (payListErr) throw new Error(payListErr.message);

    let alreadyPaid = (
      (existingPays as Array<{ amount: number | string }>) ?? []
    ).reduce((s, p) => s + Number(p.amount), 0);

    // Legacy: pago integral sem linhas de pagamento
    if (alreadyPaid === 0 && charge.status === "pago" && charge.cash_entry_id) {
      alreadyPaid = totalDue;
    }

    const remaining = Math.max(0, totalDue - alreadyPaid);
    if (remaining <= 0) throw new Error("Cobrança já está quitada");
    if (data.amount > remaining + 0.001) {
      throw new Error(
        `Valor excede o saldo em aberto (${remaining.toFixed(2)})`,
      );
    }

    const { data: entry, error: entryErr } = await context.supabase
      .from("cash_entries")
      .insert({
        chapter_id: data.chapterId,
        kind: charge.kind,
        category: charge.category,
        subcategory: charge.subcategory,
        description: charge.description,
        amount: data.amount,
        entry_date: data.paidAt,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (entryErr) throw new Error(entryErr.message);

    const { error: payErr } = await context.supabase
      .from("member_charge_payments" as never)
      .insert({
        chapter_id: data.chapterId,
        charge_id: data.chargeId,
        amount: data.amount,
        paid_at: data.paidAt,
        cash_entry_id: entry.id,
        notes: data.notes ?? null,
        created_by: context.userId,
      } as never);
    if (payErr) {
      await context.supabase.from("cash_entries").delete().eq("id", entry.id);
      throw new Error(payErr.message);
    }

    const newPaid = alreadyPaid + data.amount;
    const fullyPaid = newPaid + 0.001 >= totalDue;
    const { error: updErr } = await context.supabase
      .from("member_charges")
      .update({
        status: fullyPaid ? "pago" : "em_aberto",
        paid_at: fullyPaid ? data.paidAt : null,
        cash_entry_id: fullyPaid ? entry.id : charge.cash_entry_id,
      })
      .eq("id", data.chargeId);
    if (updErr) throw new Error(updErr.message);

    return {
      ok: true,
      amountPaid: newPaid,
      remaining: Math.max(0, totalDue - newPaid),
      fullyPaid,
    };
  });

/** Atualiza valor/data de um pagamento e sincroniza o lançamento no fluxo. */
export const updateChargePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        paymentId: z.string().uuid(),
        amount: z.number().positive(),
        paidAt: z.string().min(1),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: payment, error: payErr } = await context.supabase
      .from("member_charge_payments" as never)
      .select("id, charge_id, amount, cash_entry_id, chapter_id")
      .eq("id", data.paymentId)
      .eq("chapter_id", data.chapterId)
      .single();
    if (payErr) throw new Error(payErr.message);

    const pay = payment as {
      id: string;
      charge_id: string;
      amount: number | string;
      cash_entry_id: string | null;
      chapter_id: string;
    };

    const { data: charge, error: chErr } = await context.supabase
      .from("member_charges")
      .select("id, amount, status, kind, category, subcategory, description")
      .eq("id", pay.charge_id)
      .single();
    if (chErr) throw new Error(chErr.message);

    const totalDue = Number(charge.amount) || 0;
    const { data: otherPays, error: listErr } = await context.supabase
      .from("member_charge_payments" as never)
      .select("id, amount")
      .eq("charge_id", pay.charge_id);
    if (listErr) throw new Error(listErr.message);

    const othersPaid = (
      (otherPays as Array<{ id: string; amount: number | string }>) ?? []
    )
      .filter((p) => p.id !== pay.id)
      .reduce((s, p) => s + Number(p.amount), 0);

    const remainingForThis = Math.max(0, totalDue - othersPaid);
    if (data.amount > remainingForThis + 0.001) {
      throw new Error(
        `Valor excede o saldo disponível (${remainingForThis.toFixed(2)})`,
      );
    }

    const { error: updPayErr } = await context.supabase
      .from("member_charge_payments" as never)
      .update({
        amount: data.amount,
        paid_at: data.paidAt,
        notes: data.notes ?? null,
      } as never)
      .eq("id", pay.id);
    if (updPayErr) throw new Error(updPayErr.message);

    if (pay.cash_entry_id) {
      const { error: cashErr } = await context.supabase
        .from("cash_entries")
        .update({
          amount: data.amount,
          entry_date: data.paidAt,
          description: charge.description,
          category: charge.category,
          subcategory: charge.subcategory,
          kind: charge.kind,
        })
        .eq("id", pay.cash_entry_id);
      if (cashErr) throw new Error(cashErr.message);
    }

    await recalcMemberChargeStatus(
      context.supabase,
      data.chapterId,
      pay.charge_id,
    );
    return { ok: true };
  });

/** Remove pagamento da cobrança e o lançamento correspondente no fluxo. */
export const deleteChargePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ paymentId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: payment, error: payErr } = await context.supabase
      .from("member_charge_payments" as never)
      .select("id, charge_id, cash_entry_id")
      .eq("id", data.paymentId)
      .eq("chapter_id", data.chapterId)
      .single();
    if (payErr) throw new Error(payErr.message);

    const pay = payment as {
      id: string;
      charge_id: string;
      cash_entry_id: string | null;
    };

    const { error: delPayErr } = await context.supabase
      .from("member_charge_payments" as never)
      .delete()
      .eq("id", pay.id);
    if (delPayErr) throw new Error(delPayErr.message);

    if (pay.cash_entry_id) {
      // Evita loop: limpa vínculos legados antes de apagar o lançamento
      await context.supabase
        .from("member_charges")
        .update({ cash_entry_id: null })
        .eq("cash_entry_id", pay.cash_entry_id);
      await context.supabase
        .from("cash_entries")
        .delete()
        .eq("id", pay.cash_entry_id);
    }

    await recalcMemberChargeStatus(
      context.supabase,
      data.chapterId,
      pay.charge_id,
    );
    return { ok: true };
  });

export const upsertMemberCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        id: z.string().uuid().optional(),
        memberId: z.string().uuid(),
        kind: z.enum(["entrada", "saida"]).default("entrada"),
        category: z.string().min(1).default("Outras"),
        subcategory: z.string().nullable().optional().default(null),
        description: z.string().min(1),
        amount: z
          .number()
          .finite()
          .min(0.01, "O valor da cobrança deve ser pelo menos R$ 0,01"),
        dueDate: z.string().min(1),
        status: z.enum(["em_aberto", "pago", "isento"]).default("em_aberto"),
        paidAt: z.string().optional(),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const paidAt = data.paidAt || todayYmd();

    const { data: member, error: memberErr } = await context.supabase
      .from("members")
      .select("full_name")
      .eq("id", data.memberId)
      .single();
    if (memberErr) throw new Error(memberErr.message);

    // Edição: não recria fluxo automático se já houver pagamentos parciais
    let existingPayments = 0;
    if (data.id) {
      const { data: pays } = await context.supabase
        .from("member_charge_payments" as never)
        .select("amount")
        .eq("charge_id", data.id);
      existingPayments = (
        (pays as Array<{ amount: number | string }>) ?? []
      ).reduce((s, p) => s + Number(p.amount), 0);
    }

    let cashEntryId: string | null = null;
    if (data.id) {
      const { data: existing } = await context.supabase
        .from("member_charges")
        .select("cash_entry_id")
        .eq("id", data.id)
        .maybeSingle();
      cashEntryId = existing?.cash_entry_id ?? null;
    }

    // Fluxo legado (pago integral sem tabela de pagamentos)
    if (existingPayments === 0) {
      if (data.status !== "pago" && cashEntryId) {
        await context.supabase
          .from("cash_entries")
          .delete()
          .eq("id", cashEntryId);
        cashEntryId = null;
      }

      if (data.status === "pago" && !cashEntryId && data.amount > 0) {
        const { data: entry, error: entryErr } = await context.supabase
          .from("cash_entries")
          .insert({
            chapter_id: data.chapterId,
            kind: data.kind,
            category: data.category,
            subcategory: data.subcategory,
            description: data.description,
            amount: data.amount,
            entry_date: paidAt,
            created_by: context.userId,
          })
          .select("id")
          .single();
        if (entryErr) throw new Error(entryErr.message);
        cashEntryId = entry.id;
      }
    }

    const payload = {
      chapter_id: data.chapterId,
      member_id: data.memberId,
      kind: data.kind,
      category: data.category,
      subcategory: data.subcategory,
      description: data.description,
      amount: data.amount,
      due_date: data.dueDate,
      status: data.status,
      paid_at: data.status === "pago" ? paidAt : null,
      cash_entry_id: cashEntryId,
      notes: data.notes ?? null,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("member_charges")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      // Se marcou pago integral sem pagamentos e insert de payment falhou por falta de charge_id no insert acima
      if (data.status === "pago" && existingPayments === 0 && cashEntryId) {
        const { data: pays } = await context.supabase
          .from("member_charge_payments" as never)
          .select("id")
          .eq("charge_id", data.id)
          .limit(1);
        if (!pays?.length) {
          await context.supabase
            .from("member_charge_payments" as never)
            .insert({
              chapter_id: data.chapterId,
              charge_id: data.id,
              amount: data.amount,
              paid_at: paidAt,
              cash_entry_id: cashEntryId,
              created_by: context.userId,
            } as never);
        }
      }
    } else {
      const { data: created, error } = await context.supabase
        .from("member_charges")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (data.status === "pago" && cashEntryId && created?.id) {
        await context.supabase.from("member_charge_payments" as never).insert({
          chapter_id: data.chapterId,
          charge_id: created.id,
          amount: data.amount,
          paid_at: paidAt,
          cash_entry_id: cashEntryId,
          created_by: context.userId,
        } as never);
      }
    }

    return { ok: true, memberName: member.full_name };
  });

export const deleteMemberCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("member_charges")
      .select("cash_entry_id")
      .eq("id", data.id)
      .maybeSingle();

    const { data: payments } = await context.supabase
      .from("member_charge_payments" as never)
      .select("cash_entry_id")
      .eq("charge_id", data.id);

    const cashIds = new Set<string>();
    if (existing?.cash_entry_id) cashIds.add(existing.cash_entry_id);
    for (const p of (payments as Array<{ cash_entry_id: string | null }>) ??
      []) {
      if (p.cash_entry_id) cashIds.add(p.cash_entry_id);
    }

    // Apaga pagamentos antes (FK); depois entradas e cobrança
    await context.supabase
      .from("member_charge_payments" as never)
      .delete()
      .eq("charge_id", data.id);

    for (const cashId of cashIds) {
      await context.supabase.from("cash_entries").delete().eq("id", cashId);
    }

    const { error } = await context.supabase
      .from("member_charges")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Membros regulares (qualquer tipo) para atribuir cobranças. */
export const listChargeMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("members")
      .select("id, full_name, kind")
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .order("full_name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ---------------------- Dashboard + financeiro do membro ---------------------- */

/** Resumo para o início: saldo do mês atual + mensalidades em aberto. */
export const getDashboardFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { year, month } = currentYearMonthInAppTz();
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = periodEndDate(year, month);

    const [monthAgg, bankAgg, duesOpen, defaultAmount, allCharges] =
      await Promise.all([
        aggregateCashAmounts(context.supabase, data.chapterId, {
          from: periodStart,
          until: periodEnd,
        }),
        aggregateCashAmounts(context.supabase, data.chapterId),
        fetchAllPages<{
          member_id: string;
          competence_month: number;
          amount: number | string;
          status: string;
        }>((from, to) =>
          context.supabase
            .from("member_dues")
            .select("member_id, competence_month, amount, status")
            .eq("chapter_id", data.chapterId)
            .eq("competence_year", year)
            .eq("status", "em_aberto")
            .lte("competence_month", month)
            .order("member_id", { ascending: true })
            .order("competence_month", { ascending: true })
            .range(from, to),
        ),
        readDefaultDuesAmount(context.supabase, data.chapterId),
        fetchAllPages<{
          id: string;
          amount: number | string;
          status: string;
          cash_entry_id: string | null;
          kind: string;
        }>((from, to) =>
          context.supabase
            .from("member_charges")
            .select("id, amount, status, cash_entry_id, kind")
            .eq("chapter_id", data.chapterId)
            .neq("status", "isento")
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ]);

    const memberIds = new Set<string>();
    let pendingAmount = 0;
    let pendingCompetences = 0;
    for (const d of duesOpen) {
      memberIds.add(d.member_id);
      pendingCompetences += 1;
      const amt = Number(d.amount);
      pendingAmount += Number.isFinite(amt) && amt > 0 ? amt : defaultAmount;
    }

    // Mesma regra da tela de Cobranças / extrato do membro:
    // saldo = amount − pagamentos (legado: pago + cash_entry sem linhas).
    const chargeIds = allCharges.map((c) => c.id);
    const paidByCharge = new Map<string, number>();
    const CHARGE_ID_CHUNK = 200;
    for (let i = 0; i < chargeIds.length; i += CHARGE_ID_CHUNK) {
      const chunk = chargeIds.slice(i, i + CHARGE_ID_CHUNK);
      const payments = await fetchAllPages<{
        charge_id: string;
        amount: number | string;
      }>(
        (from, to) =>
          context.supabase
            .from("member_charge_payments" as never)
            .select("charge_id, amount")
            .eq("chapter_id", data.chapterId)
            .in("charge_id", chunk)
            .order("charge_id", { ascending: true })
            .range(from, to) as never,
      );
      for (const p of payments) {
        paidByCharge.set(
          p.charge_id,
          (paidByCharge.get(p.charge_id) ?? 0) + Number(p.amount),
        );
      }
    }

    let openChargesAmount = 0;
    let openChargesCount = 0;
    for (const c of allCharges) {
      // Só entradas contam como "a receber"
      if (c.kind === "saida") continue;
      const total = Number(c.amount) || 0;
      let paid = paidByCharge.get(c.id) ?? 0;
      if (paid === 0 && c.status === "pago" && c.cash_entry_id) {
        paid = total;
      }
      paid = Math.min(paid, total);
      const remaining = Math.max(0, total - paid);
      if (remaining <= 0) continue;
      openChargesAmount += remaining;
      openChargesCount += 1;
    }

    const receivableTotal = pendingAmount + openChargesAmount;

    return {
      year,
      month,
      monthBalance: monthAgg.balance,
      monthIncome: monthAgg.income,
      monthExpense: monthAgg.expense,
      bankBalance: bankAgg.balance,
      bankIncome: bankAgg.income,
      bankExpense: bankAgg.expense,
      pendingMembers: memberIds.size,
      pendingCompetences,
      pendingAmount,
      openChargesAmount,
      openChargesCount,
      receivableTotal,
      defaultAmount,
    };
  });

/** Extrato financeiro de um membro: mensalidades + cobranças. */
export const getMemberFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        memberId: z.string().uuid(),
        year: z.number().int().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { year: appYear, month: appMonth } = currentYearMonthInAppTz();
    const year = data.year ?? appYear;

    const [defaultAmount, duesRes, chargesRes] = await Promise.all([
      readDefaultDuesAmount(context.supabase, data.chapterId),
      context.supabase
        .from("member_dues")
        .select(
          "id, competence_year, competence_month, amount, status, paid_at, cash_entry_id",
        )
        .eq("chapter_id", data.chapterId)
        .eq("member_id", data.memberId)
        .eq("competence_year", year)
        .order("competence_month", { ascending: true }),
      context.supabase
        .from("member_charges")
        .select(
          "id, kind, category, description, amount, due_date, status, paid_at, cash_entry_id, created_at",
        )
        .eq("chapter_id", data.chapterId)
        .eq("member_id", data.memberId)
        .order("due_date", { ascending: false })
        .limit(200),
    ]);

    if (duesRes.error) throw new Error(duesRes.error.message);
    if (chargesRes.error) throw new Error(chargesRes.error.message);

    const charges = chargesRes.data ?? [];
    const chargeIds = charges.map((c) => c.id);
    const paidByCharge = new Map<string, number>();
    if (chargeIds.length) {
      const { data: payments, error: payErr } = await context.supabase
        .from("member_charge_payments" as never)
        .select("charge_id, amount")
        .eq("chapter_id", data.chapterId)
        .in("charge_id", chargeIds);
      if (payErr) throw new Error(payErr.message);
      for (const p of (payments as Array<{
        charge_id: string;
        amount: number | string;
      }>) ?? []) {
        paidByCharge.set(
          p.charge_id,
          (paidByCharge.get(p.charge_id) ?? 0) + Number(p.amount),
        );
      }
    }

    const dues = (duesRes.data ?? []).map((d) => {
      const stored = Number(d.amount);
      const status = d.status as string;
      // Pago mantém o valor efetivo; demais usam o padrão atual do capítulo
      const amount =
        status === "pago" && Number.isFinite(stored) ? stored : defaultAmount;
      return {
        id: d.id,
        year: d.competence_year,
        month: d.competence_month,
        amount,
        status,
        paid_at: d.paid_at as string | null,
      };
    });

    const chargesOut = charges.map((c) => {
      const amount = Number(c.amount) || 0;
      let amountPaid = paidByCharge.get(c.id) ?? 0;
      if (amountPaid === 0 && c.status === "pago" && c.cash_entry_id) {
        amountPaid = amount;
      }
      amountPaid = Math.min(amountPaid, amount);
      return {
        id: c.id,
        kind: c.kind as string,
        category: c.category,
        description: c.description,
        amount,
        amount_paid: amountPaid,
        remaining: Math.max(0, amount - amountPaid),
        due_date: c.due_date as string,
        status: c.status as string,
        paid_at: c.paid_at as string | null,
      };
    });

    let duesOpenAmount = 0;
    let duesOpenCount = 0;
    const cy = appYear;
    const cm = appMonth;
    for (const d of dues) {
      if (d.status !== "em_aberto") continue;
      // Meses futuros não entram no "em aberto"
      if (d.year > cy || (d.year === cy && d.month > cm)) continue;
      duesOpenCount += 1;
      duesOpenAmount += d.amount;
    }

    let chargesOpenAmount = 0;
    let chargesOpenCount = 0;
    for (const c of chargesOut) {
      if (c.status === "isento") continue;
      if (c.remaining <= 0) continue;
      chargesOpenCount += 1;
      chargesOpenAmount += c.remaining;
    }

    return {
      year,
      defaultAmount,
      dues,
      charges: chargesOut,
      summary: {
        duesOpenCount,
        duesOpenAmount,
        chargesOpenCount,
        chargesOpenAmount,
        totalOpen: duesOpenAmount + chargesOpenAmount,
      },
    };
  });
