import { $ as booleanType, Q as arrayType, et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar.functions-5LxRcNup.js
var eventTypeEnum = enumType([
	"sessao_ritualistica",
	"sessao_administrativa",
	"evento",
	"filantropia",
	"entretenimento"
]);
var listCalendarItems_createServerFn_handler = createServerRpc({
	id: "10ff72d315597453c5d6c1a172826a2e392ca3a3a9b4ef5f1b546849dceade65",
	name: "listCalendarItems",
	filename: "src/lib/calendar.functions.ts"
}, (opts) => listCalendarItems.__executeServer(opts));
var listCalendarItems = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterIds: arrayType(stringType().uuid()).min(1),
	from: stringType().datetime().optional(),
	to: stringType().datetime().optional()
}).parse(raw)).handler(listCalendarItems_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("calendar_events").select("id, chapter_id, title, event_type, mandatory, public_open, start_at, end_at, location, address, lodge_id, dress_code, description, related_event_id, created_by, created_at").in("chapter_id", data.chapterIds).order("start_at", { ascending: true });
	if (data.from) q = q.gte("start_at", data.from);
	if (data.to) q = q.lte("start_at", data.to);
	const { data: rows, error } = await q;
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var createCalendarItem_createServerFn_handler = createServerRpc({
	id: "c3c027dd66e2abb49f1f6dd053721bf6c3a967e80bb67b54a58ae4527db3a50b",
	name: "createCalendarItem",
	filename: "src/lib/calendar.functions.ts"
}, (opts) => createCalendarItem.__executeServer(opts));
var createCalendarItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid().optional(),
	title: stringType().min(1),
	event_type: eventTypeEnum,
	mandatory: booleanType().optional(),
	public_open: booleanType().optional(),
	start_at: stringType().datetime(),
	end_at: stringType().datetime().nullable().optional(),
	location: stringType().nullable().optional(),
	address: stringType().nullable().optional(),
	lodge_id: stringType().uuid().nullable().optional(),
	dress_code: stringType().nullable().optional(),
	description: stringType().nullable().optional(),
	related_event_id: stringType().uuid().nullable().optional()
}).parse(raw)).handler(createCalendarItem_createServerFn_handler, async ({ data, context }) => {
	let chapterId;
	if (data.chapter_id) chapterId = data.chapter_id;
	else {
		const { data: profile, error: profileError } = await context.supabase.from("profiles").select("active_chapter_id").eq("id", context.userId).single();
		if (profileError || !profile?.active_chapter_id) throw new Error("Nenhum capítulo ativo selecionado. Escolha um capítulo no menu.");
		chapterId = profile.active_chapter_id;
	}
	const { data: row, error } = await context.supabase.from("calendar_events").insert({
		chapter_id: chapterId,
		title: data.title,
		event_type: data.event_type,
		mandatory: data.mandatory ?? true,
		public_open: data.public_open ?? false,
		start_at: data.start_at,
		end_at: data.end_at ?? null,
		location: data.location ?? null,
		address: data.address ?? null,
		lodge_id: data.lodge_id ?? null,
		dress_code: data.dress_code ?? null,
		description: data.description ?? null,
		related_event_id: data.related_event_id ?? null,
		created_by: context.userId
	}).select().single();
	if (error) throw new Error(error.message);
	return row;
});
var updateCalendarItem_createServerFn_handler = createServerRpc({
	id: "871eaec89054103d90987eac94877618dcc41a9a8c7e991e4884f31d7df66220",
	name: "updateCalendarItem",
	filename: "src/lib/calendar.functions.ts"
}, (opts) => updateCalendarItem.__executeServer(opts));
var updateCalendarItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	title: stringType().min(1),
	event_type: eventTypeEnum,
	mandatory: booleanType().optional(),
	public_open: booleanType().optional(),
	start_at: stringType().datetime(),
	end_at: stringType().datetime().nullable().optional(),
	location: stringType().nullable().optional(),
	address: stringType().nullable().optional(),
	lodge_id: stringType().uuid().nullable().optional(),
	dress_code: stringType().nullable().optional(),
	description: stringType().nullable().optional()
}).parse(raw)).handler(updateCalendarItem_createServerFn_handler, async ({ data, context }) => {
	const { id, ...rest } = data;
	const { data: row, error } = await context.supabase.from("calendar_events").update({
		title: rest.title,
		event_type: rest.event_type,
		mandatory: rest.mandatory ?? true,
		public_open: rest.public_open ?? false,
		start_at: rest.start_at,
		end_at: rest.end_at ?? null,
		location: rest.location ?? null,
		address: rest.address ?? null,
		lodge_id: rest.lodge_id ?? null,
		dress_code: rest.dress_code ?? null,
		description: rest.description ?? null
	}).eq("id", id).select().single();
	if (error) throw new Error(error.message);
	return row;
});
var deleteCalendarItem_createServerFn_handler = createServerRpc({
	id: "9593da722f5a44fd4e6abd71d518b68c448eeebc0036abdfe90ebc93af0eef8e",
	name: "deleteCalendarItem",
	filename: "src/lib/calendar.functions.ts"
}, (opts) => deleteCalendarItem.__executeServer(opts));
var deleteCalendarItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteCalendarItem_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("calendar_events").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { createCalendarItem_createServerFn_handler, deleteCalendarItem_createServerFn_handler, listCalendarItems_createServerFn_handler, updateCalendarItem_createServerFn_handler };
