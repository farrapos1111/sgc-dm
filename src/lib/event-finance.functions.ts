import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { datePartsInAppTz, todayYmd } from "@/lib/timezone";

const eventIdInput = z.object({ eventId: z.string().uuid() });

/** Categoria virtual sempre presente no Financeiro do evento. */
export const INGRESSOS_CATEGORY_ID = "__ingressos__";
export const INGRESSOS_CATEGORY_NAME = "Ingressos";

/** Categoria interna de despesas de orçamento (não aparece no catálogo de receita). */
export const BUDGET_CATEGORY_NAME = "Orçamento";

/** Chave única de nome (sem capitalização/espaços extras). */
export function normalizeFinanceNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isBudgetCategoryName(name: string) {
  return normalizeFinanceNameKey(name) === normalizeFinanceNameKey(BUDGET_CATEGORY_NAME);
}

export type EventFinanceCategory = {
  id: string;
  event_id: string;
  chapter_id: string;
  name: string;
  sort_order: number;
  /** Categoria gerenciada pela aba Ingressos (não editável no Financeiro). */
  is_system?: boolean;
};

export type EventFinanceItem = {
  id: string;
  category_id: string;
  event_id: string;
  chapter_id: string;
  name: string;
  unit_price: number | null;
  track_stock: boolean;
  stock_qty: number | null;
  active: boolean;
  is_system?: boolean;
  tickets_sold?: number;
};

export type EventTicketItemRow = {
  id: string;
  event_id: string;
  ticket_id: string;
  item_id: string;
  qty: number;
  unit_price: number;
  amount: number;
  cash_entry_id: string | null;
  /** true quando já há lançamento no caixa (baixado). */
  paid: boolean;
  created_at: string;
  item_name?: string;
  category_name?: string;
};

export type EventFinanceTotals = {
  totalIncome: number;
  totalExpense: number;
  total: number;
  ticketsIncome: number;
  otherIncome: number;
  byCategory: Array<{
    categoryId: string;
    name: string;
    income: number;
    expense: number;
    isSystem?: boolean;
  }>;
  byItem: Array<{
    itemId: string;
    name: string;
    categoryId: string;
    categoryName: string;
    income: number;
    expense: number;
    qty?: number;
    isSystem?: boolean;
  }>;
  entries: Array<{
    id: string;
    kind: string;
    amount: number | string;
    subcategory: string | null;
    description?: string | null;
    entry_date: string;
    event_finance_item_id: string | null;
  }>;
};

function ymdFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null;
  }
  const { year, month, day } = datePartsInAppTz(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Lista categorias + itens do financeiro do evento (+ Ingressos virtual). */
export const listEventFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => eventIdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const [cats, items, types, tickets, event] = await Promise.all([
      context.supabase
        .from("event_finance_categories")
        .select("id, event_id, chapter_id, name, sort_order")
        .eq("event_id", data.eventId)
        .order("sort_order")
        .order("name"),
      context.supabase
        .from("event_finance_items")
        .select(
          "id, category_id, event_id, chapter_id, name, unit_price, track_stock, stock_qty, active",
        )
        .eq("event_id", data.eventId)
        .order("name"),
      context.supabase
        .from("ticket_types")
        .select("id, name, price, quantity_total, sort_order")
        .eq("event_id", data.eventId)
        .order("sort_order")
        .order("name"),
      context.supabase
        .from("tickets")
        .select("id, ticket_type_id, price_paid, status")
        .eq("event_id", data.eventId),
      context.supabase
        .from("events")
        .select("id, chapter_id, name")
        .eq("id", data.eventId)
        .maybeSingle(),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (items.error) throw new Error(items.error.message);
    if (types.error) throw new Error(types.error.message);
    if (tickets.error) throw new Error(tickets.error.message);
    if (event.error) throw new Error(event.error.message);
    if (!event.data) throw new Error("Evento não encontrado");
    const eventRow = event.data;

    const soldByType = new Map<string | null, { count: number; raised: number }>();
    for (const t of tickets.data ?? []) {
      if (t.status === "cancelado") continue;
      const key = t.ticket_type_id;
      const cur = soldByType.get(key) ?? { count: 0, raised: 0 };
      cur.count += 1;
      cur.raised += Number(t.price_paid ?? 0);
      soldByType.set(key, cur);
    }

    const ingressosCat: EventFinanceCategory = {
      id: INGRESSOS_CATEGORY_ID,
      event_id: data.eventId,
      chapter_id: eventRow.chapter_id,
      name: INGRESSOS_CATEGORY_NAME,
      sort_order: 0,
      is_system: true,
    };

    const ingressosItems: EventFinanceItem[] = (types.data ?? []).map((tt) => {
      const sold = soldByType.get(tt.id) ?? { count: 0, raised: 0 };
      return {
        id: `ticket-type:${tt.id}`,
        category_id: INGRESSOS_CATEGORY_ID,
        event_id: data.eventId,
        chapter_id: eventRow.chapter_id,
        name: tt.name,
        unit_price: Number(tt.price),
        track_stock: false,
        stock_qty: null,
        active: true,
        is_system: true,
        tickets_sold: sold.count,
      };
    });

    const avulso = soldByType.get(null);
    if (avulso && avulso.count > 0) {
      ingressosItems.push({
        id: "ticket-type:avulso",
        category_id: INGRESSOS_CATEGORY_ID,
        event_id: data.eventId,
        chapter_id: eventRow.chapter_id,
        name: "Avulso",
        unit_price: null,
        track_stock: false,
        stock_qty: null,
        active: true,
        is_system: true,
        tickets_sold: avulso.count,
      });
    }

    // Evita duplicar se alguém criou categoria "Ingressos" manualmente;
    // Orçamento fica só na seção dedicada (não é catálogo de receita).
    const customCats = ((cats.data ?? []) as EventFinanceCategory[]).filter(
      (c) =>
        c.name.trim().toLowerCase() !== "ingressos" &&
        !isBudgetCategoryName(c.name),
    );
    const budgetCatIds = new Set(
      ((cats.data ?? []) as EventFinanceCategory[])
        .filter((c) => isBudgetCategoryName(c.name))
        .map((c) => c.id),
    );
    const catalogItems = ((items.data ?? []) as EventFinanceItem[]).filter(
      (i) => !budgetCatIds.has(i.category_id),
    );

    return {
      eventName: event.data.name as string,
      categories: [ingressosCat, ...customCats],
      items: [...ingressosItems, ...catalogItems],
    };
  });

/** Totais arrecadados por categoria/item (tickets + cash_entries do evento). */
export const getEventFinanceTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    eventIdInput
      .extend({
        from: z.string().optional().nullable(),
        until: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<EventFinanceTotals> => {
    let q = context.supabase
      .from("cash_entries")
      .select(
        "id, kind, amount, subcategory, description, entry_date, event_finance_item_id",
      )
      .eq("event_id", data.eventId)
      .eq("category", "Eventos");
    if (data.from) q = q.gte("entry_date", data.from);
    // Lançamentos futuros (após hoje) ainda não contabilizam.
    const today = todayYmd();
    const untilCap =
      data.until && data.until < today ? data.until : today;
    q = q.lte("entry_date", untilCap);

    const { data: entries, error } = await q.order("entry_date", {
      ascending: true,
    });
    if (error) throw new Error(error.message);

    const [itemsRes, catsRes, typesRes, ticketsRes] = await Promise.all([
      context.supabase
        .from("event_finance_items")
        .select("id, category_id, name")
        .eq("event_id", data.eventId),
      context.supabase
        .from("event_finance_categories")
        .select("id, name")
        .eq("event_id", data.eventId),
      context.supabase
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", data.eventId),
      context.supabase
        .from("tickets")
        .select("id, ticket_type_id, price_paid, status, sold_at")
        .eq("event_id", data.eventId),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (catsRes.error) throw new Error(catsRes.error.message);
    if (typesRes.error) throw new Error(typesRes.error.message);
    if (ticketsRes.error) throw new Error(ticketsRes.error.message);

    const itemMeta = new Map(
      (itemsRes.data ?? []).map((i) => [
        i.id,
        { category_id: i.category_id, name: i.name },
      ]),
    );
    const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));
    const typeName = new Map((typesRes.data ?? []).map((t) => [t.id, t.name]));

    let totalIncome = 0;
    let totalExpense = 0;
    let ticketsIncome = 0;
    let otherIncome = 0;
    const byItem = new Map<
      string,
      {
        itemId: string;
        name: string;
        categoryId: string;
        categoryName: string;
        income: number;
        expense: number;
        qty?: number;
        isSystem?: boolean;
      }
    >();
    const byCategory = new Map<
      string,
      {
        categoryId: string;
        name: string;
        income: number;
        expense: number;
        isSystem?: boolean;
      }
    >();

    // Ingressos (tickets)
    const ingressosCat = {
      categoryId: INGRESSOS_CATEGORY_ID,
      name: INGRESSOS_CATEGORY_NAME,
      income: 0,
      expense: 0,
      isSystem: true,
    };
    for (const t of ticketsRes.data ?? []) {
      if (t.status === "cancelado") continue;
      const day = ymdFromIso(t.sold_at);
      if (data.from && day && day < data.from) continue;
      if (day && day > untilCap) continue;
      const amount = Number(t.price_paid ?? 0);
      ticketsIncome += amount;
      totalIncome += amount;
      ingressosCat.income += amount;

      const typeId = t.ticket_type_id;
      const itemId = typeId ? `ticket-type:${typeId}` : "ticket-type:avulso";
      const name = typeId
        ? (typeName.get(typeId) ?? "Tipo removido")
        : "Avulso";
      const itemRow = byItem.get(itemId) ?? {
        itemId,
        name,
        categoryId: INGRESSOS_CATEGORY_ID,
        categoryName: INGRESSOS_CATEGORY_NAME,
        income: 0,
        expense: 0,
        qty: 0,
        isSystem: true,
      };
      itemRow.income += amount;
      itemRow.qty = (itemRow.qty ?? 0) + 1;
      byItem.set(itemId, itemRow);
    }
    if (ingressosCat.income > 0 || (typesRes.data ?? []).length > 0) {
      byCategory.set(INGRESSOS_CATEGORY_ID, ingressosCat);
      // Garante linhas zeradas para tipos sem venda
      for (const tt of typesRes.data ?? []) {
        const itemId = `ticket-type:${tt.id}`;
        if (!byItem.has(itemId)) {
          byItem.set(itemId, {
            itemId,
            name: tt.name,
            categoryId: INGRESSOS_CATEGORY_ID,
            categoryName: INGRESSOS_CATEGORY_NAME,
            income: 0,
            expense: 0,
            qty: 0,
            isSystem: true,
          });
        }
      }
    }

    for (const e of entries ?? []) {
      const amount = Number(e.amount) || 0;
      if (e.kind === "entrada") {
        totalIncome += amount;
        otherIncome += amount;
      } else totalExpense += amount;

      const meta = e.event_finance_item_id
        ? itemMeta.get(e.event_finance_item_id)
        : null;
      const itemId = e.event_finance_item_id ?? `snap:${e.subcategory ?? "?"}`;
      const name = meta?.name ?? e.subcategory ?? "Sem item";
      const categoryId = meta?.category_id ?? "other";
      const categoryName =
        catName.get(categoryId) ?? "Outros";

      // Orçamento não entra no breakdown de categorias/itens de receita
      if (isBudgetCategoryName(categoryName)) continue;

      const itemRow = byItem.get(itemId) ?? {
        itemId,
        name,
        categoryId,
        categoryName,
        income: 0,
        expense: 0,
      };
      if (e.kind === "entrada") itemRow.income += amount;
      else itemRow.expense += amount;
      byItem.set(itemId, itemRow);

      const catRow = byCategory.get(categoryId) ?? {
        categoryId,
        name: categoryName,
        income: 0,
        expense: 0,
      };
      if (e.kind === "entrada") catRow.income += amount;
      else catRow.expense += amount;
      byCategory.set(categoryId, catRow);
    }

    const sortedCats = [...byCategory.values()].sort((a, b) => {
      if (a.categoryId === INGRESSOS_CATEGORY_ID) return -1;
      if (b.categoryId === INGRESSOS_CATEGORY_ID) return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return {
      totalIncome,
      totalExpense,
      total: totalIncome - totalExpense,
      ticketsIncome,
      otherIncome,
      byCategory: sortedCats,
      byItem: [...byItem.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
      entries: entries ?? [],
    };
  });

export const upsertEventFinanceCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        eventId: z.string().uuid(),
        chapterId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        sort_order: z.number().int().default(100),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.name.trim().toLowerCase() === "ingressos") {
      throw new Error(
        "A categoria “Ingressos” é automática e gerenciada na aba Ingressos",
      );
    }
    if (isBudgetCategoryName(data.name)) {
      throw new Error(
        "A categoria “Orçamento” é gerenciada na seção Orçamento do Financeiro",
      );
    }
    if (data.id) {
      const { error } = await context.supabase
        .from("event_finance_categories")
        .update({ name: data.name, sort_order: data.sort_order })
        .eq("id", data.id)
        .eq("event_id", data.eventId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("event_finance_categories")
        .insert({
          event_id: data.eventId,
          chapter_id: data.chapterId,
          name: data.name,
          sort_order: data.sort_order,
        });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEventFinanceCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: categoryItems, error: itemsError } = await context.supabase
      .from("event_finance_items")
      .select("id")
      .eq("category_id", data.id);
    if (itemsError) throw new Error(itemsError.message);
    const itemIds = (categoryItems ?? []).map((item) => item.id);
    if (itemIds.length > 0) {
      const { count, error: linksError } = await context.supabase
        .from("event_ticket_items")
        .select("id", { count: "exact", head: true })
        .in("item_id", itemIds);
      if (linksError) throw new Error(linksError.message);
      if ((count ?? 0) > 0) {
        throw new Error(
          "Categoria possui itens vinculados a comandas e não pode ser excluída.",
        );
      }
    }
    const { error } = await context.supabase
      .from("event_finance_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertEventFinanceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        eventId: z.string().uuid(),
        chapterId: z.string().uuid(),
        categoryId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        unit_price: z.number().nonnegative().nullable().default(null),
        track_stock: z.boolean().default(false),
        stock_qty: z.number().int().nonnegative().nullable().default(null),
        active: z.boolean().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: category, error: categoryError } = await context.supabase
      .from("event_finance_categories")
      .select("id, event_id, name")
      .eq("id", data.categoryId)
      .maybeSingle();
    if (categoryError) throw new Error(categoryError.message);
    if (!category || category.event_id !== data.eventId) {
      throw new Error("Categoria não pertence a este evento");
    }
    if (isBudgetCategoryName(category.name)) {
      throw new Error(
        "Itens de Orçamento são gerenciados na seção Orçamento, não no catálogo",
      );
    }

    const payload = {
      name: data.name,
      unit_price: data.unit_price,
      track_stock: data.track_stock,
      stock_qty: data.track_stock ? data.stock_qty : null,
      active: data.active,
      category_id: data.categoryId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("event_finance_items")
        .update(payload)
        .eq("id", data.id)
        .eq("event_id", data.eventId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("event_finance_items").insert({
        ...payload,
        event_id: data.eventId,
        chapter_id: data.chapterId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEventFinanceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { count, error: linksError } = await context.supabase
      .from("event_ticket_items")
      .select("id", { count: "exact", head: true })
      .eq("item_id", data.id);
    if (linksError) throw new Error(linksError.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        "Item vinculado a comandas. Desative o item em vez de excluir.",
      );
    }
    const { error } = await context.supabase
      .from("event_finance_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lança despesa de orçamento do evento no caixa (saída Eventos). */
export const addEventBudgetExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        eventId: z.string().uuid(),
        chapterId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        amount: z.number().positive(),
        entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: event, error: eventErr } = await context.supabase
      .from("events")
      .select("id, name, chapter_id")
      .eq("id", data.eventId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    if (!event) throw new Error("Evento não encontrado");

    const budgetKey = normalizeFinanceNameKey(BUDGET_CATEGORY_NAME);
    const { data: cat, error: catErr } = await context.supabase
      .from("event_finance_categories")
      .upsert(
        {
          event_id: data.eventId,
          chapter_id: data.chapterId,
          name: BUDGET_CATEGORY_NAME,
          name_key: budgetKey,
        },
        { onConflict: "event_id,name_key" },
      )
      .select("id, name")
      .single();
    if (catErr) throw new Error(catErr.message);
    if (!cat) throw new Error("Não foi possível resolver a categoria de Orçamento");

    const expenseName = data.name.trim();
    const expenseKey = normalizeFinanceNameKey(expenseName);
    const { data: item, error: itemErr } = await context.supabase
      .from("event_finance_items")
      .upsert(
        {
          event_id: data.eventId,
          chapter_id: data.chapterId,
          category_id: cat.id,
          name: expenseName,
          name_key: expenseKey,
        },
        { onConflict: "category_id,name_key" },
      )
      .select("id, name")
      .single();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("Não foi possível resolver o item de Orçamento");

    const amountLabel = data.amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const label = `Evento ${event.name} - Despesa ${expenseName} - ${amountLabel}`;

    const { error: cashErr } = await context.supabase.from("cash_entries").insert({
      chapter_id: data.chapterId,
      kind: "saida",
      category: "Eventos",
      subcategory: label,
      description: label,
      amount: data.amount,
      entry_date: data.entry_date,
      event_id: data.eventId,
      event_finance_item_id: item.id,
      created_by: context.userId,
    });
    if (cashErr) throw new Error(cashErr.message);

    return { ok: true, label };
  });

/** Lista despesas de orçamento (saídas Eventos) do evento. */
export const listEventBudgetExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => eventIdInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: budgetItems, error: itemsErr } = await context.supabase
      .from("event_finance_items")
      .select("id, category:event_finance_categories!inner(name)")
      .eq("event_id", data.eventId);
    if (itemsErr) throw new Error(itemsErr.message);

    const budgetItemIds = (budgetItems ?? [])
      .filter((row) => {
        const cat = row.category as { name?: string } | null;
        return isBudgetCategoryName(cat?.name ?? "");
      })
      .map((row) => row.id);

    if (budgetItemIds.length === 0) return [];

    const { data: rows, error } = await context.supabase
      .from("cash_entries")
      .select(
        "id, subcategory, description, amount, entry_date, event_finance_item_id, created_at",
      )
      .eq("event_id", data.eventId)
      .eq("kind", "saida")
      .eq("category", "Eventos")
      .in("event_finance_item_id", budgetItemIds)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  });

/** Linhas da comanda de um ingresso (ou de todos do evento). */
export const listEventTicketItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        eventId: z.string().uuid(),
        ticketId: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("event_ticket_items")
      .select(
        "id, event_id, ticket_id, item_id, qty, unit_price, amount, cash_entry_id, created_at",
      )
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false });
    if (data.ticketId) q = q.eq("ticket_id", data.ticketId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const itemIds = [...new Set((rows ?? []).map((r) => r.item_id))];
    const { data: items } =
      itemIds.length === 0
        ? { data: [] as { id: string; name: string; category_id: string }[] }
        : await context.supabase
            .from("event_finance_items")
            .select("id, name, category_id")
            .in("id", itemIds);
    const catIds = [...new Set((items ?? []).map((i) => i.category_id))];
    const { data: cats } =
      catIds.length === 0
        ? { data: [] as { id: string; name: string }[] }
        : await context.supabase
            .from("event_finance_categories")
            .select("id, name")
            .in("id", catIds);

    const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
    const catMap = new Map((cats ?? []).map((c) => [c.id, c.name]));

    return (rows ?? []).map((r) => {
      const item = itemMap.get(r.item_id);
      return {
        ...r,
        qty: Number(r.qty),
        unit_price: Number(r.unit_price),
        amount: Number(r.amount),
        paid: !!r.cash_entry_id,
        item_name: item?.name,
        category_name: item ? catMap.get(item.category_id) : undefined,
      } satisfies EventTicketItemRow;
    });
  });

export const addEventTicketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        ticketId: z.string().uuid(),
        itemId: z.string().uuid(),
        qty: z.number().int().positive().default(1),
        unit_price: z.number().nonnegative().nullable().optional(),
        description: z.string().max(200).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertComandaEditable(context.supabase, { ticketId: data.ticketId });

    const { data: itemMeta, error: itemErr } = await context.supabase
      .from("event_finance_items")
      .select("id, category_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (itemMeta?.category_id) {
      const { data: cat, error: catErr } = await context.supabase
        .from("event_finance_categories")
        .select("name")
        .eq("id", itemMeta.category_id)
        .maybeSingle();
      if (catErr) throw new Error(catErr.message);
      if (cat?.name?.trim().toLowerCase() === "ingressos") {
        throw new Error("Ingressos não podem ser lançados na comanda");
      }
    }

    const { data: result, error } = await context.supabase.rpc(
      "add_event_ticket_item",
      {
        _ticket_id: data.ticketId,
        _item_id: data.itemId,
        _qty: data.qty,
        _unit_price: data.unit_price ?? undefined,
        _description: data.description ?? undefined,
      },
    );
    if (error) throw new Error(error.message);
    return result as {
      id: string;
      cash_entry_id: string;
      amount: number;
      unit_price: number;
      qty: number;
    };
  });

export const updateEventTicketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        lineId: z.string().uuid(),
        qty: z.number().int().positive().optional(),
        unit_price: z.number().nonnegative().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertComandaEditable(context.supabase, { lineId: data.lineId });

    const { data: result, error } = await context.supabase.rpc(
      "update_event_ticket_item",
      {
        _line_id: data.lineId,
        _qty: data.qty ?? undefined,
        _unit_price: data.unit_price ?? undefined,
      },
    );
    if (error) throw new Error(error.message);
    return result as {
      ok: boolean;
      id: string;
      qty: number;
      unit_price: number;
      amount: number;
    };
  });

export const deleteEventTicketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ lineId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertComandaEditable(context.supabase, {
      lineId: data.lineId,
      allowPaidLine: true,
    });

    const { data: result, error } = await context.supabase.rpc(
      "delete_event_ticket_item",
      { _line_id: data.lineId },
    );
    if (error) throw new Error(error.message);
    return result as { ok: boolean; id: string };
  });

export const deleteEventTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ ticketId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "delete_event_ticket",
      { _ticket_id: data.ticketId },
    );
    if (error) throw new Error(error.message);
    return result as {
      ok: boolean;
      id: string;
      comanda_items_removed: number;
    };
  });

/** Bloqueia alteração se o ingresso estiver cancelado. */
async function assertComandaEditable(
  supabase: {
    from: (table: string) => any;
  },
  opts: {
    ticketId?: string;
    lineId?: string;
    /** Se true, permite linhas já baixadas (ex.: exclusão com estorno no caixa). */
    allowPaidLine?: boolean;
  },
) {
  let ticketId = opts.ticketId ?? null;
  if (!ticketId && opts.lineId) {
    const { data: line, error } = await supabase
      .from("event_ticket_items")
      .select("ticket_id, cash_entry_id")
      .eq("id", opts.lineId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    ticketId = line?.ticket_id ?? null;
    if (!opts.allowPaidLine && line?.cash_entry_id) {
      throw new Error("Item já baixado — não é possível alterar");
    }
  }
  if (!ticketId) return;

  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select("status")
    .eq("id", ticketId)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (ticket?.status === "cancelado") {
    throw new Error("Ingresso cancelado");
  }

  const { data: checkin, error: cinErr } = await supabase
    .from("checkins")
    .select("id")
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (cinErr) throw new Error(cinErr.message);
  if (!checkin) {
    throw new Error(
      "Comanda disponível somente após o check-in no evento",
    );
  }
}

/** Dados do recibo de checkout da comanda (ingresso + itens + Pix). */
export const getComandaCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        eventId: z.string().uuid(),
        ticketId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: event, error: eventErr } = await context.supabase
      .from("events")
      .select("id, chapter_id, name, starts_at, location")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    if (!event) throw new Error("Evento não encontrado");

    const { data: ticket, error: ticketErr } = await context.supabase
      .from("tickets")
      .select(
        "id, event_id, buyer_name, price_paid, status, seller_member_id, seller_charge_id",
      )
      .eq("id", data.ticketId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (ticketErr) throw new Error(ticketErr.message);
    if (!ticket) throw new Error("Ingresso não encontrado");

    const { data: lineRows, error: linesErr } = await context.supabase
      .from("event_ticket_items")
      .select(
        "id, event_id, ticket_id, item_id, qty, unit_price, amount, cash_entry_id, created_at",
      )
      .eq("event_id", data.eventId)
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });
    if (linesErr) throw new Error(linesErr.message);

    const itemIds = [...new Set((lineRows ?? []).map((r) => r.item_id))];
    const { data: items } =
      itemIds.length === 0
        ? { data: [] as { id: string; name: string; category_id: string }[] }
        : await context.supabase
            .from("event_finance_items")
            .select("id, name, category_id")
            .in("id", itemIds);
    const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
    const lines = (lineRows ?? []).map((r) => {
      const item = itemMap.get(r.item_id);
      return {
        ...r,
        qty: Number(r.qty),
        unit_price: Number(r.unit_price),
        amount: Number(r.amount),
        paid: !!r.cash_entry_id,
        item_name: item?.name,
      };
    });

    let charge: {
      id: string;
      status: string;
      amount: number | string;
      description: string;
      amount_paid: number;
      remaining: number;
    } | null = null;
    if (ticket.seller_charge_id) {
      const { data: c, error: cErr } = await context.supabase
        .from("member_charges")
        .select("id, status, amount, description")
        .eq("id", ticket.seller_charge_id)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (c) {
        const totalDue = Number(c.amount) || 0;
        const { data: pays, error: payErr } = await context.supabase
          .from("member_charge_payments" as never)
          .select("amount")
          .eq("charge_id", c.id);
        if (payErr) throw new Error(payErr.message);
        let amountPaid = (
          (pays as Array<{ amount: number | string }> | null) ?? []
        ).reduce((s, p) => s + Number(p.amount), 0);
        // Baixas antigas sem linhas em member_charge_payments.
        // Não tratar cobrança R$ 0 como “paga no valor atual” (evita mascarar
        // troca de cortesia → ingresso pago se o status ainda estiver pago).
        if (amountPaid === 0 && c.status === "pago" && totalDue > 0) {
          amountPaid = totalDue;
        }
        charge = {
          ...c,
          amount_paid: Math.min(amountPaid, totalDue),
          remaining: Math.max(0, totalDue - amountPaid),
        };
      }
    }

    const { data: chapter, error: chErr } = await context.supabase
      .from("chapters")
      .select("id, name, number, settings")
      .eq("id", event.chapter_id)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    const settings = (chapter?.settings ?? {}) as Record<string, unknown>;
    const pixKey =
      typeof settings.pix_key === "string" ? settings.pix_key.trim() : "";
    const pixQrPath =
      typeof settings.pix_qr_path === "string"
        ? settings.pix_qr_path.trim()
        : "";

    let sellerName: string | null = null;
    if (ticket.seller_member_id) {
      const { data: seller, error: sellerErr } = await context.supabase
        .from("members")
        .select("full_name")
        .eq("id", ticket.seller_member_id)
        .maybeSingle();
      if (sellerErr) throw new Error(sellerErr.message);
      sellerName = seller?.full_name ?? null;
    }

    const ticketAmount = Number(ticket.price_paid ?? 0);
    const comandaTotal = lines.reduce((s, l) => s + Number(l.amount), 0);

    return {
      event: {
        id: event.id,
        name: event.name,
        starts_at: event.starts_at,
        location: event.location,
        chapter_id: event.chapter_id,
      },
      chapterName: chapter
        ? `${chapter.name} nº ${chapter.number}`
        : null,
      pixKey: pixKey || null,
      pixQrPath: pixQrPath || null,
      ticket: {
        id: ticket.id,
        buyer_name: ticket.buyer_name,
        price_paid: ticketAmount,
        status: ticket.status,
        seller_member_id: ticket.seller_member_id,
        seller_name: sellerName,
        seller_charge_id: ticket.seller_charge_id,
      },
      charge: charge
        ? {
            id: charge.id,
            status: charge.status,
            amount: Number(charge.amount),
            description: charge.description,
            amount_paid: charge.amount_paid,
            remaining: charge.remaining,
          }
        : null,
      lines,
      ticketAmount,
      comandaTotal,
      unpaidComandaTotal: lines
        .filter((l) => !l.paid)
        .reduce((s, l) => s + Number(l.amount), 0),
      grandTotal: ticketAmount + comandaTotal,
    };
  });

/** Baixa um item da comanda (lança no fluxo de caixa). */
export const payEventTicketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        lineId: z.string().uuid(),
        paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertComandaEditable(context.supabase, {
      lineId: data.lineId,
      allowPaidLine: true,
    });
    const paidAt = data.paidAt ?? todayYmd();
    const { data: result, error } = await context.supabase.rpc(
      "pay_event_ticket_item" as never,
      {
        _line_id: data.lineId,
        _paid_at: paidAt,
      } as never,
    );
    if (error) throw new Error(error.message);
    const row = result as {
      ok?: boolean;
      already_paid?: boolean;
      amount?: number;
    };
    return {
      ok: true as const,
      alreadyPaid: Boolean(row?.already_paid),
      amount: Number(row?.amount) || 0,
    };
  });

/** Baixa a cobrança do ingresso (parcial ou total) e lança no fluxo. */
export const checkoutEventTicketComanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        eventId: z.string().uuid(),
        ticketId: z.string().uuid(),
        amount: z.number().positive().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertComandaEditable(context.supabase, { ticketId: data.ticketId });
    const paidAt = todayYmd();
    const { data: checkout, error: checkoutErr } = await context.supabase.rpc(
      "checkout_event_ticket_comanda" as never,
      {
        _event_id: data.eventId,
        _ticket_id: data.ticketId,
        _paid_at: paidAt,
        _amount: data.amount ?? null,
      } as never,
    );
    if (checkoutErr) throw new Error(checkoutErr.message);
    const result = checkout as {
      ok?: boolean;
      already_paid?: boolean;
      fully_paid?: boolean;
      amount?: number;
      remaining?: number;
    };
    return {
      ok: true as const,
      alreadyPaid: Boolean(result?.already_paid),
      fullyPaid: Boolean(result?.fully_paid),
      amount: Number(result?.amount) || 0,
      remaining: Number(result?.remaining) || 0,
    };
  });
