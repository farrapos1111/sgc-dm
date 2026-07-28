import { it as stringType, nt as numberType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hospitality.functions-D8liYtbe.js
var chapterInput = objectType({ chapterId: stringType().uuid() });
var listMenus_createServerFn_handler = createServerRpc({
	id: "11802bf79186474b77d348e1ba58a67d2b21f55bd82e09a6841920f68a80f9be",
	name: "listMenus",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => listMenus.__executeServer(opts));
var listMenus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listMenus_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("hospitality_menus").select("id, title, menu_date, items, estimated_cost, notes").eq("chapter_id", data.chapterId).order("menu_date", { ascending: false });
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var createMenu_createServerFn_handler = createServerRpc({
	id: "36b11d103745e7b8e2f36da294abf643b28ff30d35e1e197ae3f16148595fa30",
	name: "createMenu",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => createMenu.__executeServer(opts));
var createMenu = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	title: stringType().min(1, "Informe o título"),
	menu_date: stringType().min(1),
	items: stringType().nullable().optional(),
	estimated_cost: numberType().nonnegative().default(0),
	notes: stringType().nullable().optional()
}).parse(raw)).handler(createMenu_createServerFn_handler, async ({ data, context }) => {
	const { chapterId, ...rest } = data;
	const { error } = await context.supabase.from("hospitality_menus").insert({
		chapter_id: chapterId,
		...rest,
		created_by: context.userId
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var deleteMenu_createServerFn_handler = createServerRpc({
	id: "bd9f7d45168b08b8fa648f6d8fad6c4f47c9d3521be87ee7c83ac3882d77ebdf",
	name: "deleteMenu",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => deleteMenu.__executeServer(opts));
var deleteMenu = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteMenu_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("hospitality_menus").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listDuties_createServerFn_handler = createServerRpc({
	id: "6aadd998416360f82c4da8a7697c7b037e0688fb23681f7b3ca39819cf85c332",
	name: "listDuties",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => listDuties.__executeServer(opts));
var listDuties = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listDuties_createServerFn_handler, async ({ data, context }) => {
	const [duties, members] = await Promise.all([context.supabase.from("hospitality_duties").select("id, duty_date, role_label, notes, member:members(id, full_name)").eq("chapter_id", data.chapterId).order("duty_date", { ascending: false }), context.supabase.from("members").select("id, full_name").eq("chapter_id", data.chapterId).in("status", ["ativo", "senior"]).order("full_name")]);
	if (duties.error) throw new Error(duties.error.message);
	if (members.error) throw new Error(members.error.message);
	return {
		duties: duties.data ?? [],
		members: members.data ?? []
	};
});
var createDuty_createServerFn_handler = createServerRpc({
	id: "b35ef59ec882e0d277cd88220342798818fa510f97cb1e81a3d266865165520b",
	name: "createDuty",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => createDuty.__executeServer(opts));
var createDuty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	member_id: stringType().uuid(),
	duty_date: stringType().min(1),
	role_label: stringType().min(1).default("Serviço"),
	notes: stringType().nullable().optional()
}).parse(raw)).handler(createDuty_createServerFn_handler, async ({ data, context }) => {
	const { chapterId, ...rest } = data;
	const { error } = await context.supabase.from("hospitality_duties").insert({
		chapter_id: chapterId,
		...rest,
		created_by: context.userId
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var deleteDuty_createServerFn_handler = createServerRpc({
	id: "2e10af8d5e6e9caa097ebf95664b0bd2cde92159fe04c95559a20539404d945c",
	name: "deleteDuty",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => deleteDuty.__executeServer(opts));
var deleteDuty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteDuty_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("hospitality_duties").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listCheckins_createServerFn_handler = createServerRpc({
	id: "0f581994ae56fef3c744c892ea2ad4b4cac8d15ebb40b4fedc51b1c9d139271b",
	name: "listCheckins",
	filename: "src/lib/hospitality.functions.ts"
}, (opts) => listCheckins.__executeServer(opts));
var listCheckins = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listCheckins_createServerFn_handler, async ({ data, context }) => {
	const { data: events, error: eErr } = await context.supabase.from("events").select("id, name, starts_at").eq("chapter_id", data.chapterId).order("starts_at", { ascending: false });
	if (eErr) throw new Error(eErr.message);
	const ids = (events ?? []).map((e) => e.id);
	if (ids.length === 0) return {
		events: [],
		checkins: []
	};
	const { data: checkins, error } = await context.supabase.from("checkins").select("id, event_id, checked_in_at, method, ticket:tickets(id, buyer_name)").in("event_id", ids).order("checked_in_at", { ascending: false }).limit(500);
	if (error) throw new Error(error.message);
	return {
		events: events ?? [],
		checkins: checkins ?? []
	};
});
//#endregion
export { createDuty_createServerFn_handler, createMenu_createServerFn_handler, deleteDuty_createServerFn_handler, deleteMenu_createServerFn_handler, listCheckins_createServerFn_handler, listDuties_createServerFn_handler, listMenus_createServerFn_handler };
