import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ chapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: events, error } = await context.supabase
      .from("events")
      .select(
        "id, name, description, location, starts_at, ends_at, goal_amount, status, created_at",
      )
      .eq("chapter_id", data.chapterId)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!events || events.length === 0) return [];

    const ids = events.map((e) => e.id);
    const { data: tickets, error: tErr } = await context.supabase
      .from("tickets")
      .select("event_id, price_paid, status")
      .in("event_id", ids);
    if (tErr) throw new Error(tErr.message);

    const totals = new Map<string, { raised: number; count: number }>();
    for (const t of tickets ?? []) {
      const cur = totals.get(t.event_id) ?? { raised: 0, count: 0 };
      if (t.status !== "cancelado") {
        cur.raised += Number(t.price_paid ?? 0);
        cur.count += 1;
      }
      totals.set(t.event_id, cur);
    }
    return events.map((e) => ({
      ...e,
      raised: totals.get(e.id)?.raised ?? 0,
      tickets_sold: totals.get(e.id)?.count ?? 0,
    }));
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        name: z.string().min(2).max(120),
        description: z.string().max(2000).optional().default(""),
        location: z.string().max(200).optional().default(""),
        starts_at: z.string(),
        ends_at: z.string().optional().nullable(),
        goal_amount: z.number().min(0).default(0),
        status: z
          .enum(["rascunho", "publicado", "encerrado"])
          .default("rascunho"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("events")
      .insert({
        chapter_id: data.chapter_id,
        name: data.name,
        description: data.description,
        location: data.location,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        goal_amount: data.goal_amount,
        status: data.status,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const eventRes = await context.supabase
      .from("events")
      .select(
        "id, chapter_id, name, description, location, starts_at, ends_at, goal_amount, status",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (eventRes.error) throw new Error(eventRes.error.message);
    if (!eventRes.data) throw new Error("Evento não encontrado");

    const tablesRes = await context.supabase
      .from("event_tables")
      .select("*")
      .eq("event_id", data.id)
      .order("label");
    if (tablesRes.error) throw new Error(tablesRes.error.message);
    const tables = tablesRes.data ?? [];
    const tableIds = tables.map((r) => r.id);

    const [types, tickets, seats, checkins] = await Promise.all([
      context.supabase
        .from("ticket_types")
        .select("*")
        .eq("event_id", data.id)
        .order("sort_order"),
      context.supabase
        .from("tickets")
        .select(
          "id, ticket_type_id, buyer_name, buyer_email, qr_code, status, price_paid, sold_at",
        )
        .eq("event_id", data.id)
        .order("sold_at", { ascending: false }),
      tableIds.length > 0
        ? context.supabase
            .from("seats")
            .select("id, table_id, seat_number, ticket_id")
            .in("table_id", tableIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              table_id: string;
              seat_number: number;
              ticket_id: string | null;
            }>,
            error: null,
          }),
      context.supabase
        .from("checkins")
        .select("id, ticket_id, method, checked_in_at")
        .eq("event_id", data.id),
    ]);
    for (const r of [types, tickets, seats, checkins]) {
      if ("error" in r && r.error) throw new Error(r.error.message);
    }
    return {
      event: eventRes.data,
      ticketTypes: types.data ?? [],
      tickets: tickets.data ?? [],
      tables,
      seats: seats.data ?? [],
      checkins: checkins.data ?? [],
    };
  });

export const createTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        event_id: z.string().uuid(),
        name: z.string().min(1).max(60),
        price: z.number().min(0),
        quantity_total: z.number().int().min(0),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ticket_types").insert({
      event_id: data.event_id,
      name: data.name,
      price: data.price,
      quantity_total: data.quantity_total,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sellTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        event_id: z.string().uuid(),
        ticket_type_id: z.string().uuid().nullable().optional(),
        buyer_name: z.string().min(2).max(120),
        buyer_email: z
          .string()
          .email()
          .optional()
          .or(z.literal(""))
          .default(""),
        price_paid: z.number().min(0),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tickets")
      .insert({
        event_id: data.event_id,
        ticket_type_id: data.ticket_type_id ?? null,
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email || null,
        price_paid: data.price_paid,
        sold_by: context.userId,
      })
      .select("id, qr_code")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        event_id: z.string().uuid(),
        label: z.string().min(1).max(40),
        capacity: z.number().int().min(1).max(30),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: tableId, error } = await context.supabase.rpc(
      "create_event_table_with_seats" as never,
      {
        _event_id: data.event_id,
        _label: data.label,
        _capacity: data.capacity,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { id: tableId as string };
  });

export const assignSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        seat_id: z.string().uuid(),
        ticket_id: z.string().uuid().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("seats")
      .update({ ticket_id: data.ticket_id })
      .eq("id", data.seat_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkinTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        event_id: z.string().uuid(),
        qr: z.string().optional(),
        ticket_id: z.string().uuid().optional(),
        method: z.enum(["qr", "nome"]).default("qr"),
      })
      .refine((v) => v.qr || v.ticket_id, { message: "Informe QR ou ingresso" })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let ticketId = data.ticket_id;
    if (!ticketId && data.qr) {
      const { data: t, error } = await context.supabase
        .from("tickets")
        .select("id, event_id, status, buyer_name")
        .eq("qr_code", data.qr)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error("Ingresso não encontrado");
      if (t.event_id !== data.event_id)
        throw new Error("Ingresso de outro evento");
      if (t.status !== "valido") throw new Error("Ingresso inválido");
      ticketId = t.id;
    }
    if (!ticketId) throw new Error("Ingresso não informado");

    // Caminho por ticket_id: exige ingresso do evento e status válido
    if (data.ticket_id) {
      const { data: t, error } = await context.supabase
        .from("tickets")
        .select("id, status")
        .eq("id", ticketId)
        .eq("event_id", data.event_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error("Ingresso não encontrado");
      if (t.status !== "valido") throw new Error("Ingresso inválido");
    }

    const { data: existing } = await context.supabase
      .from("checkins")
      .select("id")
      .eq("ticket_id", ticketId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyCheckedIn: true };

    const { error } = await context.supabase.from("checkins").insert({
      ticket_id: ticketId,
      event_id: data.event_id,
      method: data.method,
      checked_in_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, alreadyCheckedIn: false };
  });

/** Exclui um evento (ingressos/mesas/check-ins em cascata). */
export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: event, error: eErr } = await context.supabase
      .from("events")
      .select("id, chapter_id, name")
      .eq("id", data.id)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!event) throw new Error("Evento não encontrado");

    const checks = await Promise.all(
      (["admin", "comissoes", "secretaria"] as const).map(async (perm) => {
        const { data: ok, error } = await context.supabase.rpc(
          "has_permission" as never,
          { _chapter_id: event.chapter_id, _perm: perm } as never,
        );
        if (error) throw new Error(error.message);
        return Boolean(ok);
      }),
    );
    if (!checks.some(Boolean)) {
      throw new Error("Sem permissão para excluir eventos neste capítulo");
    }

    const { data: deleted, error } = await context.supabase
      .from("events")
      .delete()
      .eq("id", data.id)
      .select("name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Evento já confirmado acima; null aqui costuma ser RLS (policy DELETE).
    if (!deleted) {
      throw new Error("Sem permissão para excluir este evento");
    }
    return { ok: true, name: deleted.name as string };
  });
