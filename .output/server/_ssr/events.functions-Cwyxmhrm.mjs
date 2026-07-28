import { et as enumType, it as stringType, nt as numberType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/events.functions-Cwyxmhrm.js
var listEvents_createServerFn_handler = createServerRpc({
	id: "c6c3050e76f6a3dfc8d5d2ac54e072621bfa1f2f6d5d769b0049bda3381525f9",
	name: "listEvents",
	filename: "src/lib/events.functions.ts"
}, (opts) => listEvents.__executeServer(opts));
var listEvents = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(listEvents_createServerFn_handler, async ({ data, context }) => {
	const { data: events, error } = await context.supabase.from("events").select("id, name, description, location, starts_at, ends_at, goal_amount, status, created_at").eq("chapter_id", data.chapterId).order("starts_at", { ascending: false });
	if (error) throw new Error(error.message);
	if (!events || events.length === 0) return [];
	const ids = events.map((e) => e.id);
	const { data: tickets, error: tErr } = await context.supabase.from("tickets").select("event_id, price_paid, status").in("event_id", ids);
	if (tErr) throw new Error(tErr.message);
	const totals = /* @__PURE__ */ new Map();
	for (const t of tickets ?? []) {
		const cur = totals.get(t.event_id) ?? {
			raised: 0,
			count: 0
		};
		if (t.status !== "cancelado") {
			cur.raised += Number(t.price_paid ?? 0);
			cur.count += 1;
		}
		totals.set(t.event_id, cur);
	}
	return events.map((e) => ({
		...e,
		raised: totals.get(e.id)?.raised ?? 0,
		tickets_sold: totals.get(e.id)?.count ?? 0
	}));
});
var createEvent_createServerFn_handler = createServerRpc({
	id: "850b627097bf0b9a66dd6b0113af2e6a737684efd40c87be36b923a4dc39a342",
	name: "createEvent",
	filename: "src/lib/events.functions.ts"
}, (opts) => createEvent.__executeServer(opts));
var createEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	name: stringType().min(2).max(120),
	description: stringType().max(2e3).optional().default(""),
	location: stringType().max(200).optional().default(""),
	starts_at: stringType(),
	ends_at: stringType().optional().nullable(),
	goal_amount: numberType().min(0).default(0),
	status: enumType([
		"rascunho",
		"publicado",
		"encerrado"
	]).default("rascunho")
}).parse(raw)).handler(createEvent_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("events").insert({
		chapter_id: data.chapter_id,
		name: data.name,
		description: data.description,
		location: data.location,
		starts_at: data.starts_at,
		ends_at: data.ends_at,
		goal_amount: data.goal_amount,
		status: data.status,
		created_by: context.userId
	}).select("id").single();
	if (error) throw new Error(error.message);
	return { id: row.id };
});
var getEvent_createServerFn_handler = createServerRpc({
	id: "bd66a90601da06e94faba0cd906b6432a3546cf133a81a1639fd7e6a53802978",
	name: "getEvent",
	filename: "src/lib/events.functions.ts"
}, (opts) => getEvent.__executeServer(opts));
var getEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(getEvent_createServerFn_handler, async ({ data, context }) => {
	const eventRes = await context.supabase.from("events").select("id, chapter_id, name, description, location, starts_at, ends_at, goal_amount, status").eq("id", data.id).maybeSingle();
	if (eventRes.error) throw new Error(eventRes.error.message);
	if (!eventRes.data) throw new Error("Evento não encontrado");
	const [types, tickets, tables, seats, checkins] = await Promise.all([
		context.supabase.from("ticket_types").select("*").eq("event_id", data.id).order("sort_order"),
		context.supabase.from("tickets").select("id, ticket_type_id, buyer_name, buyer_email, qr_code, status, price_paid, sold_at").eq("event_id", data.id).order("sold_at", { ascending: false }),
		context.supabase.from("event_tables").select("*").eq("event_id", data.id).order("label"),
		context.supabase.from("seats").select("id, table_id, seat_number, ticket_id").in("table_id", (await context.supabase.from("event_tables").select("id").eq("event_id", data.id)).data?.map((r) => r.id) ?? []),
		context.supabase.from("checkins").select("id, ticket_id, method, checked_in_at").eq("event_id", data.id)
	]);
	for (const r of [
		types,
		tickets,
		tables,
		seats,
		checkins
	]) if ("error" in r && r.error) throw new Error(r.error.message);
	return {
		event: eventRes.data,
		ticketTypes: types.data ?? [],
		tickets: tickets.data ?? [],
		tables: tables.data ?? [],
		seats: seats.data ?? [],
		checkins: checkins.data ?? []
	};
});
var createTicketType_createServerFn_handler = createServerRpc({
	id: "d0fe21c28c0882c6673740172a85b775ef1bd381dfcacde3dddb4e126de4a211",
	name: "createTicketType",
	filename: "src/lib/events.functions.ts"
}, (opts) => createTicketType.__executeServer(opts));
var createTicketType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	name: stringType().min(1).max(60),
	price: numberType().min(0),
	quantity_total: numberType().int().min(0)
}).parse(raw)).handler(createTicketType_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("ticket_types").insert({
		event_id: data.event_id,
		name: data.name,
		price: data.price,
		quantity_total: data.quantity_total
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var sellTicket_createServerFn_handler = createServerRpc({
	id: "bbb619ac9d038077805420363ff70012dd92a3883ed0ab86e963b24031287a12",
	name: "sellTicket",
	filename: "src/lib/events.functions.ts"
}, (opts) => sellTicket.__executeServer(opts));
var sellTicket = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	ticket_type_id: stringType().uuid().nullable().optional(),
	buyer_name: stringType().min(2).max(120),
	buyer_email: stringType().email().optional().or(literalType("")).default(""),
	price_paid: numberType().min(0)
}).parse(raw)).handler(sellTicket_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("tickets").insert({
		event_id: data.event_id,
		ticket_type_id: data.ticket_type_id ?? null,
		buyer_name: data.buyer_name,
		buyer_email: data.buyer_email || null,
		price_paid: data.price_paid,
		sold_by: context.userId
	}).select("id, qr_code").single();
	if (error) throw new Error(error.message);
	return row;
});
var createTable_createServerFn_handler = createServerRpc({
	id: "10b03485db982962222a1615b39f9711b2c29336765f83016628a3681b3a8195",
	name: "createTable",
	filename: "src/lib/events.functions.ts"
}, (opts) => createTable.__executeServer(opts));
var createTable = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	label: stringType().min(1).max(40),
	capacity: numberType().int().min(1).max(30)
}).parse(raw)).handler(createTable_createServerFn_handler, async ({ data, context }) => {
	const { data: table, error } = await context.supabase.from("event_tables").insert({
		event_id: data.event_id,
		label: data.label,
		capacity: data.capacity
	}).select("id").single();
	if (error) throw new Error(error.message);
	const seatsPayload = Array.from({ length: data.capacity }, (_, i) => ({
		table_id: table.id,
		seat_number: i + 1
	}));
	const { error: sErr } = await context.supabase.from("seats").insert(seatsPayload);
	if (sErr) throw new Error(sErr.message);
	return { id: table.id };
});
var assignSeat_createServerFn_handler = createServerRpc({
	id: "a12e21c46dc41ac9b7764748381a346c21a753dcb68e81203dd08d74cebf9481",
	name: "assignSeat",
	filename: "src/lib/events.functions.ts"
}, (opts) => assignSeat.__executeServer(opts));
var assignSeat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	seat_id: stringType().uuid(),
	ticket_id: stringType().uuid().nullable()
}).parse(raw)).handler(assignSeat_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("seats").update({ ticket_id: data.ticket_id }).eq("id", data.seat_id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var checkinTicket_createServerFn_handler = createServerRpc({
	id: "f993dc7ff438261548e3fd35cffd05c542f8f9795859ffd52e338b717dbe0d9b",
	name: "checkinTicket",
	filename: "src/lib/events.functions.ts"
}, (opts) => checkinTicket.__executeServer(opts));
var checkinTicket = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	qr: stringType().optional(),
	ticket_id: stringType().uuid().optional(),
	method: enumType(["qr", "nome"]).default("qr")
}).refine((v) => v.qr || v.ticket_id, { message: "Informe QR ou ingresso" }).parse(raw)).handler(checkinTicket_createServerFn_handler, async ({ data, context }) => {
	let ticketId = data.ticket_id;
	if (!ticketId && data.qr) {
		const { data: t, error } = await context.supabase.from("tickets").select("id, event_id, status, buyer_name").eq("qr_code", data.qr).maybeSingle();
		if (error) throw new Error(error.message);
		if (!t) throw new Error("Ingresso não encontrado");
		if (t.event_id !== data.event_id) throw new Error("Ingresso de outro evento");
		if (t.status !== "valido") throw new Error("Ingresso inválido");
		ticketId = t.id;
	}
	if (!ticketId) throw new Error("Ingresso não informado");
	const { data: existing } = await context.supabase.from("checkins").select("id").eq("ticket_id", ticketId).maybeSingle();
	if (existing) return {
		ok: true,
		alreadyCheckedIn: true
	};
	const { error } = await context.supabase.from("checkins").insert({
		ticket_id: ticketId,
		event_id: data.event_id,
		method: data.method,
		checked_in_by: context.userId
	});
	if (error) throw new Error(error.message);
	return {
		ok: true,
		alreadyCheckedIn: false
	};
});
//#endregion
export { assignSeat_createServerFn_handler, checkinTicket_createServerFn_handler, createEvent_createServerFn_handler, createTable_createServerFn_handler, createTicketType_createServerFn_handler, getEvent_createServerFn_handler, listEvents_createServerFn_handler, sellTicket_createServerFn_handler };
