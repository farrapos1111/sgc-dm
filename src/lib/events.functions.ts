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
        "id, chapter_id, name, description, location, starts_at, ends_at, goal_amount, status, ticket_artwork_url",
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
          "id, ticket_type_id, buyer_name, buyer_email, qr_code, status, price_paid, sold_at, seller_member_id, seller_charge_id",
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

    const ticketRows = tickets.data ?? [];
    const sellerIds = [
      ...new Set(
        ticketRows
          .map((t) => t.seller_member_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const sellerNameById = new Map<string, string>();
    const chargePaidById = new Map<string, boolean>();
    const chargeIds = [
      ...new Set(
        ticketRows
          .map((t) => t.seller_charge_id)
          .filter((id): id is string => !!id),
      ),
    ];

    const [sellersRes, chargesRes] = await Promise.all([
      sellerIds.length > 0
        ? context.supabase
            .from("members")
            .select("id, full_name")
            .in("id", sellerIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; full_name: string }>,
            error: null,
          }),
      chargeIds.length > 0
        ? context.supabase
            .from("member_charges")
            .select("id, status")
            .in("id", chargeIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; status: string }>,
            error: null,
          }),
    ]);
    if (sellersRes.error) throw new Error(sellersRes.error.message);
    if (chargesRes.error) throw new Error(chargesRes.error.message);
    for (const s of sellersRes.data ?? []) {
      sellerNameById.set(s.id, s.full_name);
    }
    for (const c of chargesRes.data ?? []) {
      chargePaidById.set(c.id, c.status === "pago");
    }

    const checkedInTicketIds = new Set(
      (checkins.data ?? []).map((c) => c.ticket_id),
    );

    return {
      event: eventRes.data,
      ticketTypes: types.data ?? [],
      tickets: ticketRows.map((t) => ({
        ...t,
        seller_name: t.seller_member_id
          ? (sellerNameById.get(t.seller_member_id) ?? null)
          : null,
        seller_charge_paid: t.seller_charge_id
          ? (chargePaidById.get(t.seller_charge_id) ?? false)
          : false,
        checked_in: checkedInTicketIds.has(t.id),
      })),
      tables,
      seats: seats.data ?? [],
      checkins: checkins.data ?? [],
    };
  });

export const updateEventArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        event_id: z.string().uuid(),
        ticket_artwork_url: z.string().max(500).nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("events")
      .update({ ticket_artwork_url: data.ticket_artwork_url })
      .eq("id", data.event_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Evento não encontrado");
    return { ok: true };
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

export const updateTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(60),
        price: z.number().min(0),
        quantity_total: z.number().int().min(0),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ticket_types")
      .update({
        name: data.name,
        price: data.price,
        quantity_total: data.quantity_total,
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Tipo de ingresso não encontrado");
    return { ok: true };
  });

export const deleteTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ticket_types")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Tipo de ingresso não encontrado");
    return { ok: true };
  });

export const sellTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        event_id: z.string().uuid(),
        seller_member_id: z.string().uuid(),
        ticket_type_id: z.string().uuid().nullable().optional(),
        buyer_name: z.string().min(2).max(120),
        buyer_email: z
          .string()
          .email()
          .optional()
          .or(z.literal(""))
          .default(""),
        price_paid: z.number().min(0),
        quantity: z.number().int().min(1).max(50).default(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "sell_event_tickets_with_charges" as never,
      {
        _event_id: data.event_id,
        _seller_member_id: data.seller_member_id,
        _buyer_name: data.buyer_name,
        _buyer_email: data.buyer_email || "",
        _ticket_type_id: data.ticket_type_id ?? null,
        _price_paid: data.price_paid,
        _quantity: data.quantity,
      } as never,
    );
    if (error) throw new Error(error.message);
    const rows = (result ?? []) as Array<{
      id: string;
      qr_code: string;
      buyer_name: string;
      seller_charge_id: string;
    }>;
    return rows;
  });

/** Altera o tipo (e opcionalmente o valor) de um ingresso já vendido. */
export const updateSoldTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        ticketId: z.string().uuid(),
        ticketTypeId: z.string().uuid().nullable(),
        pricePaid: z.number().min(0).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "update_sold_ticket_type" as never,
      {
        _ticket_id: data.ticketId,
        _ticket_type_id: data.ticketTypeId,
        _price_paid: data.pricePaid ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    const row = result as {
      ok?: boolean;
      price_paid?: number | string;
      seller_charge_id?: string | null;
    } | null;
    return {
      ok: row?.ok !== false,
      price_paid: Number(row?.price_paid) || 0,
      seller_charge_id: row?.seller_charge_id ?? null,
    };
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

export const deleteTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ table_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("event_tables")
      .delete()
      .eq("id", data.table_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) {
      throw new Error("Mesa não encontrada ou sem permissão para excluir");
    }
    return { ok: true };
  });

function parseTicketQrPayload(raw: string): {
  qrCode: string;
  buyerName: string | null;
} {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as { n?: unknown; nome?: unknown };
    if (typeof parsed.n === "string" && parsed.n.trim()) {
      return {
        qrCode: parsed.n.trim(),
        buyerName:
          typeof parsed.nome === "string" && parsed.nome.trim()
            ? parsed.nome.trim()
            : null,
      };
    }
  } catch {
    // Payload legado: só o número do ingresso
  }
  return { qrCode: trimmed, buyerName: null };
}

/** Pré-visualiza ingresso pelo QR (sem registrar check-in). */
export const previewTicketByQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        qr: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { qrCode, buyerName } = parseTicketQrPayload(data.qr);
    const { data: t, error } = await context.supabase
      .from("tickets")
      .select(
        "id, event_id, status, buyer_name, buyer_email, qr_code, price_paid, ticket_type:ticket_types(name), event:events(id, name, starts_at, location, chapter_id)",
      )
      .eq("qr_code", qrCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Ingresso não encontrado");

    const event = t.event as unknown as {
      id: string;
      name: string;
      starts_at: string;
      location: string | null;
      chapter_id: string;
    } | null;
    if (!event) throw new Error("Evento do ingresso não encontrado");
    if (event.chapter_id !== data.chapterId) {
      throw new Error("Ingresso de outro capítulo");
    }
    if (t.status !== "valido") throw new Error("Ingresso inválido ou cancelado");
    if (
      buyerName &&
      t.buyer_name.trim().toLowerCase() !== buyerName.toLowerCase()
    ) {
      throw new Error("Nome do comprador não confere com o ingresso");
    }

    const { data: existing, error: existingErr } = await context.supabase
      .from("checkins")
      .select("id, checked_in_at")
      .eq("ticket_id", t.id)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);

    const ticketType = t.ticket_type as unknown as { name: string } | null;

    return {
      ticket: {
        id: t.id,
        qr_code: t.qr_code,
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        price_paid: t.price_paid,
        ticket_type_name: ticketType?.name ?? "Avulso",
        status: t.status,
      },
      event: {
        id: event.id,
        name: event.name,
        starts_at: event.starts_at,
        location: event.location,
      },
      alreadyCheckedIn: !!existing,
      checkedInAt: existing?.checked_in_at ?? null,
    };
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
    let ticketMeta: { qr_code: string; buyer_name: string } | null = null;

    if (!ticketId && data.qr) {
      const { qrCode, buyerName } = parseTicketQrPayload(data.qr);
      const { data: t, error } = await context.supabase
        .from("tickets")
        .select("id, event_id, status, buyer_name, qr_code")
        .eq("qr_code", qrCode)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error("Ingresso não encontrado");
      if (t.event_id !== data.event_id)
        throw new Error("Ingresso de outro evento");
      if (t.status !== "valido") throw new Error("Ingresso inválido");
      if (
        buyerName &&
        t.buyer_name.trim().toLowerCase() !== buyerName.toLowerCase()
      ) {
        throw new Error("Nome do comprador não confere com o ingresso");
      }
      ticketId = t.id;
      ticketMeta = { qr_code: t.qr_code, buyer_name: t.buyer_name };
    }
    if (!ticketId) throw new Error("Ingresso não informado");

    // Caminho por ticket_id: exige ingresso do evento e status válido
    if (data.ticket_id) {
      const { data: t, error } = await context.supabase
        .from("tickets")
        .select("id, status, buyer_name, qr_code")
        .eq("id", ticketId)
        .eq("event_id", data.event_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error("Ingresso não encontrado");
      if (t.status !== "valido") throw new Error("Ingresso inválido");
      ticketMeta = { qr_code: t.qr_code, buyer_name: t.buyer_name };
    }

    const { data: existing, error: existingErr } = await context.supabase
      .from("checkins")
      .select("id")
      .eq("ticket_id", ticketId)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) {
      return {
        ok: true,
        alreadyCheckedIn: true,
        ticket_id: ticketId,
        event_id: data.event_id,
        qr_code: ticketMeta?.qr_code ?? null,
        buyer_name: ticketMeta?.buyer_name ?? null,
      };
    }

    const { error } = await context.supabase.from("checkins").insert({
      ticket_id: ticketId,
      event_id: data.event_id,
      method: data.method,
      checked_in_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return {
      ok: true,
      alreadyCheckedIn: false,
      ticket_id: ticketId,
      event_id: data.event_id,
      qr_code: ticketMeta?.qr_code ?? null,
      buyer_name: ticketMeta?.buyer_name ?? null,
    };
  });

/** Ingressos do capítulo para a tela global de check-ins. */
export const listChapterTicketsForCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ chapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: events, error: eErr } = await context.supabase
      .from("events")
      .select("id, name, starts_at, location")
      .eq("chapter_id", data.chapterId)
      .order("starts_at", { ascending: false });
    if (eErr) throw new Error(eErr.message);
    const eventRows = events ?? [];
    if (eventRows.length === 0) return { tickets: [], truncated: false };

    const eventIds = eventRows.map((e) => e.id);
    const eventById = new Map(eventRows.map((e) => [e.id, e]));

    const { data: tickets, error: tErr } = await context.supabase
      .from("tickets")
      .select(
        "id, event_id, buyer_name, buyer_email, qr_code, status, price_paid, sold_at, seller_member_id, ticket_type:ticket_types(name)",
      )
      .in("event_id", eventIds)
      .neq("status", "cancelado")
      .order("sold_at", { ascending: false })
      .limit(2001);
    if (tErr) throw new Error(tErr.message);
    const fetched = tickets ?? [];
    const truncated = fetched.length > 2000;
    const ticketRows = truncated ? fetched.slice(0, 2000) : fetched;
    if (ticketRows.length === 0) return { tickets: [], truncated: false };

    const sellerIds = [
      ...new Set(
        ticketRows
          .map((t) => t.seller_member_id)
          .filter((id): id is string => !!id),
      ),
    ];

    const ticketIds = ticketRows.map((t) => t.id);
    // PostgREST limita URLs; consulta check-ins em lotes por ticket_id.
    const checkinChunks: Array<{ ticket_id: string; checked_in_at: string }> = [];
    const chunkSize = 200;
    for (let i = 0; i < ticketIds.length; i += chunkSize) {
      const chunk = ticketIds.slice(i, i + chunkSize);
      const { data: checkins, error: cErr } = await context.supabase
        .from("checkins")
        .select("ticket_id, checked_in_at")
        .in("ticket_id", chunk);
      if (cErr) throw new Error(cErr.message);
      for (const row of checkins ?? []) checkinChunks.push(row);
    }

    const sellersRes = sellerIds.length
      ? await context.supabase
          .from("members")
          .select("id, full_name")
          .in("id", sellerIds)
      : { data: [] as Array<{ id: string; full_name: string }>, error: null };
    if (sellersRes.error) throw new Error(sellersRes.error.message);

    const checkinByTicket = new Map(
      checkinChunks.map((c) => [c.ticket_id, c.checked_in_at]),
    );
    const sellerById = new Map(
      (sellersRes.data ?? []).map((s) => [s.id, s.full_name]),
    );

    return {
      truncated,
      tickets: ticketRows.map((t) => {
        const event = eventById.get(t.event_id)!;
        const ticketType = t.ticket_type as unknown as { name: string } | null;
        const checkedInAt = checkinByTicket.get(t.id) ?? null;
        return {
          id: t.id,
          event_id: t.event_id,
          event_name: event.name,
          event_starts_at: event.starts_at,
          event_location: event.location,
          buyer_name: t.buyer_name,
          buyer_email: t.buyer_email,
          qr_code: t.qr_code,
          price_paid: Number(t.price_paid) || 0,
          ticket_type_name: ticketType?.name ?? "Avulso",
          seller_name: t.seller_member_id
            ? (sellerById.get(t.seller_member_id) ?? null)
            : null,
          sold_at: t.sold_at,
          already_checked_in: !!checkedInAt,
          checked_in_at: checkedInAt,
        };
      }),
    };
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

    const { data: allowed, error: permErr } = await context.supabase.rpc(
      "can_manage_event_destructive" as never,
      { _chapter_id: event.chapter_id } as never,
    );
    if (permErr) throw new Error(permErr.message);
    if (!allowed) {
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
