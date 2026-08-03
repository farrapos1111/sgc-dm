import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventIdInput = z.object({ eventId: z.string().uuid() });

/** Categoria virtual sempre presente no Financeiro do evento. */
export const INGRESSOS_CATEGORY_ID = "__ingressos__";
export const INGRESSOS_CATEGORY_NAME = "Ingressos";

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
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // sold_at já vem em ISO; usa data local BR aproximada via ISO date slice
  return iso.slice(0, 10);
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
      chapter_id: event.data.chapter_id,
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
        chapter_id: event.data.chapter_id,
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
        chapter_id: event.data.chapter_id,
        name: "Avulso",
        unit_price: null,
        track_stock: false,
        stock_qty: null,
        active: true,
        is_system: true,
        tickets_sold: avulso.count,
      });
    }

    // Evita duplicar se alguém criou categoria "Ingressos" manualmente
    const customCats = ((cats.data ?? []) as EventFinanceCategory[]).filter(
      (c) => c.name.trim().toLowerCase() !== "ingressos",
    );

    return {
      eventName: event.data.name as string,
      categories: [ingressosCat, ...customCats],
      items: [
        ...ingressosItems,
        ...((items.data ?? []) as EventFinanceItem[]),
      ],
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
    if (data.until) q = q.lte("entry_date", data.until);

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
      if (data.until && day && day > data.until) continue;
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
        catName.get(categoryId) ??
        (categoryId === "other" ? "Outros" : "Outros");

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
    const { error } = await context.supabase
      .from("event_finance_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
        qty: z.number().positive().default(1),
        unit_price: z.number().nonnegative().nullable().optional(),
        description: z.string().max(200).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "add_event_ticket_item",
      {
        _ticket_id: data.ticketId,
        _item_id: data.itemId,
        _qty: data.qty,
        _unit_price: data.unit_price ?? null,
        _description: data.description ?? null,
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
        qty: z.number().positive().optional(),
        unit_price: z.number().nonnegative().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "update_event_ticket_item",
      {
        _line_id: data.lineId,
        _qty: data.qty ?? null,
        _unit_price: data.unit_price ?? null,
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
