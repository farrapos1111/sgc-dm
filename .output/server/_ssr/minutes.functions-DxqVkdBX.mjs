import { et as enumType, it as stringType, nt as numberType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/minutes.functions-DxqVkdBX.js
var SIGNER_ROLES = [
	"presidente_conselho",
	"mestre_conselheiro",
	"escrivao"
];
var listTemplates_createServerFn_handler = createServerRpc({
	id: "f0cb2446456d53c1fa3f904174b6bfa8fe12110147335b2a9025ce3f77d8597d",
	name: "listTemplates",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => listTemplates.__executeServer(opts));
var listTemplates = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(listTemplates_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("minute_templates").select("id, code, name, body, sort_order, updated_at").eq("chapter_id", data.chapterId).order("sort_order");
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var saveTemplate_createServerFn_handler = createServerRpc({
	id: "a2695b328c195e866b8faee54bfc879d78ecd998c773169be4c121e45da287d6",
	name: "saveTemplate",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => saveTemplate.__executeServer(opts));
var saveTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	name: stringType().min(1),
	body: stringType().min(1)
}).parse(raw)).handler(saveTemplate_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("minute_templates").update({
		name: data.name,
		body: data.body
	}).eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var createTemplate_createServerFn_handler = createServerRpc({
	id: "b2c7f224e27ea4978eaa33edb63fe6fb5f768e2b88c9ddbbddcd201d3208bd36",
	name: "createTemplate",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => createTemplate.__executeServer(opts));
var createTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	name: stringType().min(1),
	body: stringType().default("")
}).parse(raw)).handler(createTemplate_createServerFn_handler, async ({ data, context }) => {
	const code = `custom_${Date.now()}`;
	const { data: last } = await context.supabase.from("minute_templates").select("sort_order").eq("chapter_id", data.chapterId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
	const { data: row, error } = await context.supabase.from("minute_templates").insert({
		chapter_id: data.chapterId,
		code,
		name: data.name,
		body: data.body || "Escreva aqui o texto base do modelo.",
		sort_order: (last?.sort_order ?? 0) + 1
	}).select("id").single();
	if (error) throw new Error(error.message);
	return {
		ok: true,
		id: row.id
	};
});
var deleteTemplate_createServerFn_handler = createServerRpc({
	id: "c682409fa269d46f92441af9bb8afe99429e33b181424af4f3b2c9910a6cbff0",
	name: "deleteTemplate",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => deleteTemplate.__executeServer(opts));
var deleteTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteTemplate_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("minute_templates").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listChapterMinutes_createServerFn_handler = createServerRpc({
	id: "df27d0b30b903c051192a858cdc2c4b7059ef353398b1081cbbc797ac6c05d08",
	name: "listChapterMinutes",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => listChapterMinutes.__executeServer(opts));
var listChapterMinutes = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(listChapterMinutes_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("session_minutes").select("id, content, status, opened_at, updated_at, calendar_event_id, calendar_event:calendar_events(id, title, event_type, mandatory, start_at, end_at, location, address)").eq("chapter_id", data.chapterId).order("opened_at", { ascending: false }).limit(200);
	if (error) throw new Error(error.message);
	const ids = (rows ?? []).map((r) => r.id);
	let approvals = [];
	if (ids.length) {
		const { data: ap, error: apErr } = await context.supabase.from("minute_approvals").select("minute_id, signer_role, signed_at").in("minute_id", ids);
		if (apErr) throw new Error(apErr.message);
		approvals = ap ?? [];
	}
	return (rows ?? []).map((r) => ({
		...r,
		approvals: approvals.filter((a) => a.minute_id === r.id)
	}));
});
var getMinuteContext_createServerFn_handler = createServerRpc({
	id: "d8766f249cfd3ddc833f3dfd0cb2be2546be263237b226b9c9654bf731421d7d",
	name: "getMinuteContext",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => getMinuteContext.__executeServer(opts));
var getMinuteContext = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	termYear: numberType().int(),
	termSemester: numberType().int().min(1).max(2)
}).parse(raw)).handler(getMinuteContext_createServerFn_handler, async ({ data, context }) => {
	const [chapter, positions] = await Promise.all([context.supabase.from("chapters").select("id, name, number, city").eq("id", data.chapterId).single(), context.supabase.from("member_positions").select("position:positions(code, label), member:members(id, full_name)").eq("chapter_id", data.chapterId).eq("term_year", data.termYear).eq("term_semester", data.termSemester)]);
	if (chapter.error) throw new Error(chapter.error.message);
	if (positions.error) throw new Error(positions.error.message);
	const officers = {};
	for (const row of positions.data ?? []) {
		const code = row.position?.code;
		const name = row.member?.full_name;
		if (!code || !name) continue;
		officers[code] = officers[code] ? `${officers[code]}, ${name}` : name;
	}
	return {
		chapter: chapter.data,
		officers
	};
});
var getMinuteApprovals_createServerFn_handler = createServerRpc({
	id: "9fb8e924cb7d302e5ca1e3cfb08774ade16d4a5334a0a0a46a5b58f64e750461",
	name: "getMinuteApprovals",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => getMinuteApprovals.__executeServer(opts));
var getMinuteApprovals = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ minuteId: stringType().uuid() }).parse(raw)).handler(getMinuteApprovals_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("minute_approvals").select("id, signer_role, user_id, signed_at").eq("minute_id", data.minuteId);
	if (error) throw new Error(error.message);
	return rows ?? [];
});
async function loadMinute(supabase, minuteId) {
	const { data, error } = await supabase.from("session_minutes").select("id, chapter_id, status").eq("id", minuteId).single();
	if (error) throw new Error(error.message);
	return data;
}
/** Concluir a ata: passa automaticamente para "Em Revisão para Aprovação". */
var submitMinute_createServerFn_handler = createServerRpc({
	id: "e8714a94ed77a85e8aead3e83b28d5cec9f0758fd8c25ca07b01c4007db9047b",
	name: "submitMinute",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => submitMinute.__executeServer(opts));
var submitMinute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ minuteId: stringType().uuid() }).parse(raw)).handler(submitMinute_createServerFn_handler, async ({ data, context }) => {
	if ((await loadMinute(context.supabase, data.minuteId)).status === "aprovada") throw new Error("Ata já aprovada.");
	const { error } = await context.supabase.from("session_minutes").update({ status: "em_revisao" }).eq("id", data.minuteId);
	if (error) throw new Error(error.message);
	return {
		ok: true,
		status: "em_revisao"
	};
});
var reopenMinute_createServerFn_handler = createServerRpc({
	id: "c39e4bd10865c128aad8db7745afc7d0a6deb6ca7379eaf96ecfb453346fef3a",
	name: "reopenMinute",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => reopenMinute.__executeServer(opts));
var reopenMinute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ minuteId: stringType().uuid() }).parse(raw)).handler(reopenMinute_createServerFn_handler, async ({ data, context }) => {
	const minute = await loadMinute(context.supabase, data.minuteId);
	const del = await context.supabase.from("minute_approvals").delete().eq("minute_id", minute.id);
	if (del.error) throw new Error(del.error.message);
	const { error } = await context.supabase.from("session_minutes").update({ status: "rascunho" }).eq("id", minute.id);
	if (error) throw new Error(error.message);
	return {
		ok: true,
		status: "rascunho"
	};
});
var signMinute_createServerFn_handler = createServerRpc({
	id: "2c8f34cfa11e6f8bdfb02bb1ef0e1d4820b732c16f43dbff6a81f1600b388679",
	name: "signMinute",
	filename: "src/lib/minutes.functions.ts"
}, (opts) => signMinute.__executeServer(opts));
var signMinute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	minuteId: stringType().uuid(),
	signerRole: enumType(SIGNER_ROLES)
}).parse(raw)).handler(signMinute_createServerFn_handler, async ({ data, context }) => {
	const minute = await loadMinute(context.supabase, data.minuteId);
	if (minute.status === "rascunho") throw new Error("Conclua a ata antes de coletar as assinaturas.");
	const { data: membership, error: mErr } = await context.supabase.from("chapter_members").select("role:roles(name)").eq("chapter_id", minute.chapter_id).eq("user_id", context.userId).eq("active", true).maybeSingle();
	if (mErr) throw new Error(mErr.message);
	const roleName = membership?.role?.name;
	if (roleName !== "admin_total" && roleName !== data.signerRole) throw new Error("Você não ocupa este cargo para assinar a ata.");
	const ins = await context.supabase.from("minute_approvals").upsert({
		chapter_id: minute.chapter_id,
		minute_id: minute.id,
		signer_role: data.signerRole,
		user_id: context.userId,
		signed_at: (/* @__PURE__ */ new Date()).toISOString()
	}, { onConflict: "minute_id,signer_role" });
	if (ins.error) throw new Error(ins.error.message);
	const { data: all, error: aErr } = await context.supabase.from("minute_approvals").select("signer_role").eq("minute_id", minute.id);
	if (aErr) throw new Error(aErr.message);
	const roles = new Set((all ?? []).map((r) => r.signer_role));
	const complete = SIGNER_ROLES.every((r) => roles.has(r));
	if (complete) {
		const upd = await context.supabase.from("session_minutes").update({ status: "aprovada" }).eq("id", minute.id);
		if (upd.error) throw new Error(upd.error.message);
	}
	return {
		ok: true,
		approved: complete
	};
});
//#endregion
export { createTemplate_createServerFn_handler, deleteTemplate_createServerFn_handler, getMinuteApprovals_createServerFn_handler, getMinuteContext_createServerFn_handler, listChapterMinutes_createServerFn_handler, listTemplates_createServerFn_handler, reopenMinute_createServerFn_handler, saveTemplate_createServerFn_handler, signMinute_createServerFn_handler, submitMinute_createServerFn_handler };
