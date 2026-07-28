import { $ as booleanType, Q as arrayType, et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/org.functions-TAGXxKqJ.js
var getMyOrgContext_createServerFn_handler = createServerRpc({
	id: "67ebd48f9476250d0d8fedcc842fa5720abf43fc76a0faf835d41c51bc3a1732",
	name: "getMyOrgContext",
	filename: "src/lib/org.functions.ts"
}, (opts) => getMyOrgContext.__executeServer(opts));
var getMyOrgContext = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(getMyOrgContext_createServerFn_handler, async ({ context }) => {
	const { data: leaderships, error } = await context.supabase.from("org_leaderships").select("id, org_role, state_id, region_id, term_year, term_semester").eq("user_id", context.userId).eq("active", true);
	if (error) throw new Error(error.message);
	if (!leaderships || leaderships.length === 0) return [];
	const [statesRes, regionsRes, chaptersRes] = await Promise.all([
		context.supabase.from("states").select("id, name, uf"),
		context.supabase.from("regions").select("id, name, code, state_id"),
		context.supabase.from("chapters").select("id, state_id, region_id, active")
	]);
	if (statesRes.error) throw new Error(statesRes.error.message);
	if (regionsRes.error) throw new Error(regionsRes.error.message);
	if (chaptersRes.error) throw new Error(chaptersRes.error.message);
	const states = statesRes.data ?? [];
	const regions = regionsRes.data ?? [];
	const chapters = chaptersRes.data ?? [];
	return leaderships.map((l) => {
		const state = states.find((s) => s.id === l.state_id) ?? null;
		const region = regions.find((r) => r.id === l.region_id) ?? null;
		const scopeChapters = l.region_id ? chapters.filter((c) => c.region_id === l.region_id) : chapters.filter((c) => c.state_id === l.state_id);
		return {
			id: l.id,
			org_role: l.org_role,
			state_id: l.state_id,
			region_id: l.region_id,
			state_name: state ? `${state.name} (${state.uf})` : null,
			region_name: region?.name ?? null,
			chapter_ids: scopeChapters.map((c) => c.id)
		};
	});
});
var scopeInput = objectType({
	scopeType: enumType(["region", "state"]),
	scopeId: stringType().uuid()
});
/** Panorama das instituições de uma região ou estado. */
var listScopeChapters_createServerFn_handler = createServerRpc({
	id: "f8d5d05cf285833583d38134ffe907f2da19a7edf8c7cfbfd1712122c959141c",
	name: "listScopeChapters",
	filename: "src/lib/org.functions.ts"
}, (opts) => listScopeChapters.__executeServer(opts));
var listScopeChapters = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => scopeInput.parse(raw)).handler(listScopeChapters_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("chapters").select("id, name, number, city, primary_color, logo_url, active, region_id, state_id").order("number", { ascending: true });
	q = data.scopeType === "region" ? q.eq("region_id", data.scopeId) : q.eq("state_id", data.scopeId);
	const { data: chapters, error } = await q;
	if (error) throw new Error(error.message);
	const ids = (chapters ?? []).map((c) => c.id);
	if (ids.length === 0) return [];
	const [membersRes, nextRes, regionsRes] = await Promise.all([
		context.supabase.from("members").select("id, chapter_id, status").in("chapter_id", ids),
		context.supabase.from("calendar_events").select("id, chapter_id, title, start_at, event_type").in("chapter_id", ids).gte("start_at", (/* @__PURE__ */ new Date()).toISOString()).order("start_at", { ascending: true }),
		context.supabase.from("regions").select("id, name")
	]);
	if (membersRes.error) throw new Error(membersRes.error.message);
	if (nextRes.error) throw new Error(nextRes.error.message);
	const members = membersRes.data ?? [];
	const upcoming = nextRes.data ?? [];
	const regions = regionsRes.data ?? [];
	return (chapters ?? []).map((c) => ({
		...c,
		region_name: regions.find((r) => r.id === c.region_id)?.name ?? null,
		active_members: members.filter((m) => m.chapter_id === c.id && m.status === "ativo").length,
		total_members: members.filter((m) => m.chapter_id === c.id).length,
		next_item: upcoming.find((e) => e.chapter_id === c.id) ?? null
	}));
});
var listScopeMembers_createServerFn_handler = createServerRpc({
	id: "3164535ffeb67b4a15251b4a5122bac4f8ecd89dfe172580160651fba24a09b8",
	name: "listScopeMembers",
	filename: "src/lib/org.functions.ts"
}, (opts) => listScopeMembers.__executeServer(opts));
var listScopeMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterIds: arrayType(stringType().uuid()).min(1),
	search: stringType().optional().default(""),
	status: enumType([
		"ativo",
		"inativo",
		"senior",
		"macom",
		"all"
	]).optional().default("all")
}).parse(raw)).handler(listScopeMembers_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("members").select("id, chapter_id, full_name, birth_date, status, phone, email, cpf_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay").in("chapter_id", data.chapterIds).order("full_name", { ascending: true }).limit(500);
	if (data.status !== "all") q = q.eq("status", data.status);
	if (data.search.trim().length > 0) q = q.ilike("full_name", `%${data.search.trim()}%`);
	const { data: rows, error } = await q;
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var listRegions_createServerFn_handler = createServerRpc({
	id: "04a3975847f1462a856fa255b948968f581778508d747b6f87c3270fe3603e81",
	name: "listRegions",
	filename: "src/lib/org.functions.ts"
}, (opts) => listRegions.__executeServer(opts));
var listRegions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ stateId: stringType().uuid() }).parse(raw)).handler(listRegions_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("regions").select("id, name, code, state_id").eq("state_id", data.stateId).order("name", { ascending: true });
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var saveRegion_createServerFn_handler = createServerRpc({
	id: "73427acf2b551c7fee14857f10ccc8341721e6d0698a630313b1b74023e260f4",
	name: "saveRegion",
	filename: "src/lib/org.functions.ts"
}, (opts) => saveRegion.__executeServer(opts));
var saveRegion = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid().optional(),
	state_id: stringType().uuid(),
	name: stringType().min(1),
	code: stringType().nullable().optional()
}).parse(raw)).handler(saveRegion_createServerFn_handler, async ({ data, context }) => {
	if (data.id) {
		const { error } = await context.supabase.from("regions").update({
			name: data.name,
			code: data.code ?? null
		}).eq("id", data.id);
		if (error) throw new Error(error.message);
		return { id: data.id };
	}
	const { data: row, error } = await context.supabase.from("regions").insert({
		state_id: data.state_id,
		name: data.name,
		code: data.code ?? null
	}).select("id").single();
	if (error) throw new Error(error.message);
	return { id: row.id };
});
var deleteRegion_createServerFn_handler = createServerRpc({
	id: "5ece9b7203a4998116a9ab0dced9db69614f2fc5e6f3a20e8b9d30a51344e9ea",
	name: "deleteRegion",
	filename: "src/lib/org.functions.ts"
}, (opts) => deleteRegion.__executeServer(opts));
var deleteRegion = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteRegion_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("regions").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var saveChapter_createServerFn_handler = createServerRpc({
	id: "a6e320e0637e14d4b6ae35c226861fd979952088af0bbe60bb9b1934f65da7cd",
	name: "saveChapter",
	filename: "src/lib/org.functions.ts"
}, (opts) => saveChapter.__executeServer(opts));
var saveChapter = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid().optional(),
	state_id: stringType().uuid(),
	region_id: stringType().uuid().nullable().optional(),
	name: stringType().min(1),
	number: stringType().min(1),
	city: stringType().nullable().optional(),
	active: booleanType().optional()
}).parse(raw)).handler(saveChapter_createServerFn_handler, async ({ data, context }) => {
	const payload = {
		state_id: data.state_id,
		region_id: data.region_id ?? null,
		name: data.name,
		number: data.number,
		city: data.city ?? null,
		...data.active === void 0 ? {} : { active: data.active }
	};
	if (data.id) {
		const { error } = await context.supabase.from("chapters").update(payload).eq("id", data.id);
		if (error) throw new Error(error.message);
		return { id: data.id };
	}
	const { data: row, error } = await context.supabase.from("chapters").insert(payload).select("id").single();
	if (error) throw new Error(error.message);
	return { id: row.id };
});
var setChapterActive_createServerFn_handler = createServerRpc({
	id: "9c69f21f585ffe7da834f89be9d71757682903f62395e6e8ca6f449883c76388",
	name: "setChapterActive",
	filename: "src/lib/org.functions.ts"
}, (opts) => setChapterActive.__executeServer(opts));
var setChapterActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	active: booleanType()
}).parse(raw)).handler(setChapterActive_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("chapters").update({ active: data.active }).eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { deleteRegion_createServerFn_handler, getMyOrgContext_createServerFn_handler, listRegions_createServerFn_handler, listScopeChapters_createServerFn_handler, listScopeMembers_createServerFn_handler, saveChapter_createServerFn_handler, saveRegion_createServerFn_handler, setChapterActive_createServerFn_handler };
