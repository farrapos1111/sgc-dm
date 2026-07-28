import { et as enumType, it as stringType, nt as numberType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/events.functions-CSdsJ1ax.js
var listEvents = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("c6c3050e76f6a3dfc8d5d2ac54e072621bfa1f2f6d5d769b0049bda3381525f9"));
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
}).parse(raw)).handler(createSsrRpc("850b627097bf0b9a66dd6b0113af2e6a737684efd40c87be36b923a4dc39a342"));
var getEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("bd66a90601da06e94faba0cd906b6432a3546cf133a81a1639fd7e6a53802978"));
var createTicketType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	name: stringType().min(1).max(60),
	price: numberType().min(0),
	quantity_total: numberType().int().min(0)
}).parse(raw)).handler(createSsrRpc("d0fe21c28c0882c6673740172a85b775ef1bd381dfcacde3dddb4e126de4a211"));
var sellTicket = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	ticket_type_id: stringType().uuid().nullable().optional(),
	buyer_name: stringType().min(2).max(120),
	buyer_email: stringType().email().optional().or(literalType("")).default(""),
	price_paid: numberType().min(0)
}).parse(raw)).handler(createSsrRpc("bbb619ac9d038077805420363ff70012dd92a3883ed0ab86e963b24031287a12"));
var createTable = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	label: stringType().min(1).max(40),
	capacity: numberType().int().min(1).max(30)
}).parse(raw)).handler(createSsrRpc("10b03485db982962222a1615b39f9711b2c29336765f83016628a3681b3a8195"));
var assignSeat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	seat_id: stringType().uuid(),
	ticket_id: stringType().uuid().nullable()
}).parse(raw)).handler(createSsrRpc("a12e21c46dc41ac9b7764748381a346c21a753dcb68e81203dd08d74cebf9481"));
var checkinTicket = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	event_id: stringType().uuid(),
	qr: stringType().optional(),
	ticket_id: stringType().uuid().optional(),
	method: enumType(["qr", "nome"]).default("qr")
}).refine((v) => v.qr || v.ticket_id, { message: "Informe QR ou ingresso" }).parse(raw)).handler(createSsrRpc("f993dc7ff438261548e3fd35cffd05c542f8f9795859ffd52e338b717dbe0d9b"));
//#endregion
export { createTicketType as a, sellTicket as c, createTable as i, checkinTicket as n, getEvent as o, createEvent as r, listEvents as s, assignSeat as t };
