import { et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/attendance.functions-EgrGjOTu.js
var EVENT_SELECT = "id, chapter_id, title, event_type, mandatory, start_at, end_at, location, address, description, related_event_id";
/** Itens do calendário que já começaram e ainda não terminaram (ou começaram há < 6h). */
var listOngoingItems_createServerFn_handler = createServerRpc({
	id: "bf2b62a36dee13592dcdd7968b25f52fe7968e1dd91c36d2ef3dc14ccd70ac60",
	name: "listOngoingItems",
	filename: "src/lib/attendance.functions.ts"
}, (opts) => listOngoingItems.__executeServer(opts));
var listOngoingItems = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(listOngoingItems_createServerFn_handler, async ({ data, context }) => {
	const now = /* @__PURE__ */ new Date();
	const floor = (/* @__PURE__ */ new Date(now.getTime() - 720 * 60 * 1e3)).toISOString();
	const { data: rows, error } = await context.supabase.from("calendar_events").select(EVENT_SELECT).eq("chapter_id", data.chapterId).gte("start_at", floor).lte("start_at", now.toISOString()).order("start_at", { ascending: false });
	if (error) throw new Error(error.message);
	return (rows ?? []).filter((r) => !r.end_at || new Date(r.end_at) >= now);
});
var getOngoing_createServerFn_handler = createServerRpc({
	id: "392d42583a7e67f9c28150f3adc3bca2d2b50af49753885a0afdbd9bb5a6283c",
	name: "getOngoing",
	filename: "src/lib/attendance.functions.ts"
}, (opts) => getOngoing.__executeServer(opts));
var getOngoing = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ calendarEventId: stringType().uuid() }).parse(raw)).handler(getOngoing_createServerFn_handler, async ({ data, context }) => {
	const { data: item, error: e1 } = await context.supabase.from("calendar_events").select(EVENT_SELECT).eq("id", data.calendarEventId).single();
	if (e1) throw new Error(e1.message);
	const [members, records, minutes] = await Promise.all([
		context.supabase.from("members").select("id, full_name, status").eq("chapter_id", item.chapter_id).eq("status", "ativo").order("full_name"),
		context.supabase.from("attendance_records").select("id, member_id, status, justification, updated_at").eq("calendar_event_id", data.calendarEventId),
		context.supabase.from("session_minutes").select("id, content, opened_at, updated_at, status, title").eq("calendar_event_id", data.calendarEventId).maybeSingle()
	]);
	if (members.error) throw new Error(members.error.message);
	if (records.error) throw new Error(records.error.message);
	if (minutes.error) throw new Error(minutes.error.message);
	return {
		item,
		members: members.data ?? [],
		records: records.data ?? [],
		minutes: minutes.data ?? null
	};
});
var setAttendance_createServerFn_handler = createServerRpc({
	id: "c283ee6ad52faad14a2c6af8c89182224a17607654f4ddfd4c8d1596c01824a6",
	name: "setAttendance",
	filename: "src/lib/attendance.functions.ts"
}, (opts) => setAttendance.__executeServer(opts));
var setAttendance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	calendarEventId: stringType().uuid(),
	memberId: stringType().uuid(),
	status: enumType(["presente", "ausente"]),
	justification: stringType().nullable().optional()
}).parse(raw)).handler(setAttendance_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("attendance_records").upsert({
		chapter_id: data.chapterId,
		calendar_event_id: data.calendarEventId,
		member_id: data.memberId,
		status: data.status,
		justification: data.justification ?? null,
		recorded_by: context.userId
	}, { onConflict: "calendar_event_id,member_id" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var saveMinutes_createServerFn_handler = createServerRpc({
	id: "d3e0fcffd699643c86388a4d9c0392d04c669086c425404945facf9b4172c915",
	name: "saveMinutes",
	filename: "src/lib/attendance.functions.ts"
}, (opts) => saveMinutes.__executeServer(opts));
var saveMinutes = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	calendarEventId: stringType().uuid(),
	content: stringType()
}).parse(raw)).handler(saveMinutes_createServerFn_handler, async ({ data, context }) => {
	const { data: existing, error: exErr } = await context.supabase.from("session_minutes").select("id, status").eq("calendar_event_id", data.calendarEventId).maybeSingle();
	if (exErr) throw new Error(exErr.message);
	if (existing && existing.status !== "rascunho") throw new Error("Ata bloqueada para edição. Reabra a ata para correção antes de alterar o texto.");
	const { data: saved, error } = await context.supabase.from("session_minutes").upsert({
		chapter_id: data.chapterId,
		calendar_event_id: data.calendarEventId,
		content: data.content,
		opened_by: context.userId
	}, { onConflict: "calendar_event_id" }).select("id, status").single();
	if (error) throw new Error(error.message);
	return {
		ok: true,
		minute: saved
	};
});
var listAttendanceOverview_createServerFn_handler = createServerRpc({
	id: "a8806bf38036e2f094a032a6a454f2049acbe5bda4f36a6cdc1d93785f6b2a9f",
	name: "listAttendanceOverview",
	filename: "src/lib/attendance.functions.ts"
}, (opts) => listAttendanceOverview.__executeServer(opts));
var listAttendanceOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(listAttendanceOverview_createServerFn_handler, async ({ data, context }) => {
	const [items, members] = await Promise.all([context.supabase.from("calendar_events").select(EVENT_SELECT).eq("chapter_id", data.chapterId).lte("start_at", (/* @__PURE__ */ new Date()).toISOString()).order("start_at", { ascending: false }).limit(200), context.supabase.from("members").select("id, full_name, status").eq("chapter_id", data.chapterId).order("full_name")]);
	if (items.error) throw new Error(items.error.message);
	if (members.error) throw new Error(members.error.message);
	const eventRows = items.data ?? [];
	const eventIds = eventRows.map((row) => row.id);
	let records;
	if (eventIds.length === 0) records = {
		data: [],
		error: null
	};
	else records = await context.supabase.from("attendance_records").select("id, calendar_event_id, member_id, status, justification").eq("chapter_id", data.chapterId).in("calendar_event_id", eventIds);
	if (records.error) throw new Error(records.error.message);
	return {
		items: eventRows,
		members: members.data ?? [],
		records: records.data ?? []
	};
});
var getMemberAttendance_createServerFn_handler = createServerRpc({
	id: "6240f37311b024f33041c04d7e596369fd4311f9c90c096d3fbdf3c5e6bfe379",
	name: "getMemberAttendance",
	filename: "src/lib/attendance.functions.ts"
}, (opts) => getMemberAttendance.__executeServer(opts));
var getMemberAttendance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ memberId: stringType().uuid() }).parse(raw)).handler(getMemberAttendance_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("attendance_records").select("id, status, justification, calendar_event:calendar_events(id, title, event_type, mandatory, start_at)").eq("member_id", data.memberId);
	if (error) throw new Error(error.message);
	return (rows ?? []).sort((a, b) => (b.calendar_event?.start_at ?? "").localeCompare(a.calendar_event?.start_at ?? ""));
});
//#endregion
export { getMemberAttendance_createServerFn_handler, getOngoing_createServerFn_handler, listAttendanceOverview_createServerFn_handler, listOngoingItems_createServerFn_handler, saveMinutes_createServerFn_handler, setAttendance_createServerFn_handler };
