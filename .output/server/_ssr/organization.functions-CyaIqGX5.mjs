import { at as unionType, et as enumType, it as stringType, nt as numberType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/organization.functions-CyaIqGX5.js
var termInput = objectType({
	chapterId: stringType().uuid(),
	year: numberType().int().min(1900).max(2200),
	semester: unionType([literalType(1), literalType(2)])
});
var listCatalog_createServerFn_handler = createServerRpc({
	id: "6f71f190efa9e7fe2d88b21e0ce1e6bbfd13299ef127acb1a97186a2b8f2f110",
	name: "listCatalog",
	filename: "src/lib/organization.functions.ts"
}, (opts) => listCatalog.__executeServer(opts));
var listCatalog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(listCatalog_createServerFn_handler, async ({ context }) => {
	const [pos, com] = await Promise.all([context.supabase.from("positions").select("id, code, label, scope, sort_order").order("sort_order"), context.supabase.from("commissions").select("id, code, label, sort_order").order("sort_order")]);
	if (pos.error) throw new Error(pos.error.message);
	if (com.error) throw new Error(com.error.message);
	return {
		positions: pos.data ?? [],
		commissions: com.data ?? []
	};
});
var listChapterPositions_createServerFn_handler = createServerRpc({
	id: "9c3668d761075c3c7ab4513f00b50b7c9a29eeff0a55056a5d046019ea3c388f",
	name: "listChapterPositions",
	filename: "src/lib/organization.functions.ts"
}, (opts) => listChapterPositions.__executeServer(opts));
var listChapterPositions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.parse(raw)).handler(listChapterPositions_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("member_positions").select("id, position_id, member_id, term_year, term_semester, position:positions(id, code, label, scope, sort_order), member:members(id, full_name)").eq("chapter_id", data.chapterId).eq("term_year", data.year).eq("term_semester", data.semester);
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var assignPosition_createServerFn_handler = createServerRpc({
	id: "731dc741227c2409134238f7bd1761f1e82c6d123a3f62ccbe7c95c5603b12cf",
	name: "assignPosition",
	filename: "src/lib/organization.functions.ts"
}, (opts) => assignPosition.__executeServer(opts));
var assignPosition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.extend({
	memberId: stringType().uuid(),
	positionId: numberType().int()
}).parse(raw)).handler(assignPosition_createServerFn_handler, async ({ data, context }) => {
	if (![25].includes(data.positionId)) {
		const { error: delErr } = await context.supabase.from("member_positions").delete().eq("chapter_id", data.chapterId).eq("position_id", data.positionId).eq("term_year", data.year).eq("term_semester", data.semester);
		if (delErr) throw new Error(delErr.message);
	}
	const { error } = await context.supabase.from("member_positions").upsert({
		chapter_id: data.chapterId,
		member_id: data.memberId,
		position_id: data.positionId,
		term_year: data.year,
		term_semester: data.semester
	}, { onConflict: "chapter_id,position_id,member_id,term_year,term_semester" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var removePosition_createServerFn_handler = createServerRpc({
	id: "00967aa91f090566181e62eccfad0cf321615a91060f770e115a671d3dac32a1",
	name: "removePosition",
	filename: "src/lib/organization.functions.ts"
}, (opts) => removePosition.__executeServer(opts));
var removePosition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(removePosition_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("member_positions").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listCommissionMembers_createServerFn_handler = createServerRpc({
	id: "fc171828d1ee93f583ac9ed42d10949bfe146b1ee7d9a48ecdf87f647ece59ff",
	name: "listCommissionMembers",
	filename: "src/lib/organization.functions.ts"
}, (opts) => listCommissionMembers.__executeServer(opts));
var listCommissionMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.parse(raw)).handler(listCommissionMembers_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("commission_members").select("id, commission_id, member_id, role, term_year, term_semester, commission:commissions(id, code, label, sort_order), member:members(id, full_name)").eq("chapter_id", data.chapterId).eq("term_year", data.year).eq("term_semester", data.semester);
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var assignCommissionMember_createServerFn_handler = createServerRpc({
	id: "0f3113353d5123b66d0e7dae46a6e275c5e57f16b4154b28538fc620005610ec",
	name: "assignCommissionMember",
	filename: "src/lib/organization.functions.ts"
}, (opts) => assignCommissionMember.__executeServer(opts));
var assignCommissionMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.extend({
	memberId: stringType().uuid(),
	commissionId: numberType().int(),
	role: enumType([
		"presidente",
		"vice",
		"membro",
		"auxiliar_senior"
	])
}).parse(raw)).handler(assignCommissionMember_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("commission_members").upsert({
		chapter_id: data.chapterId,
		commission_id: data.commissionId,
		member_id: data.memberId,
		role: data.role,
		term_year: data.year,
		term_semester: data.semester
	}, { onConflict: "chapter_id,commission_id,member_id,term_year,term_semester" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var removeCommissionMember_createServerFn_handler = createServerRpc({
	id: "7c7c634bc1a7639aea4865c05572f4f4e096f51faae950059cfa467a75b3cf31",
	name: "removeCommissionMember",
	filename: "src/lib/organization.functions.ts"
}, (opts) => removeCommissionMember.__executeServer(opts));
var removeCommissionMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(removeCommissionMember_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("commission_members").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var getMemberOrgHistory_createServerFn_handler = createServerRpc({
	id: "9fcfa9e82e08562cf8284d5dd8337894876f3e1b04da4796967bccf1e83b43b0",
	name: "getMemberOrgHistory",
	filename: "src/lib/organization.functions.ts"
}, (opts) => getMemberOrgHistory.__executeServer(opts));
var getMemberOrgHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ memberId: stringType().uuid() }).parse(raw)).handler(getMemberOrgHistory_createServerFn_handler, async ({ data, context }) => {
	const [pos, com] = await Promise.all([context.supabase.from("member_positions").select("id, term_year, term_semester, position:positions(id, label, scope)").eq("member_id", data.memberId).order("term_year", { ascending: false }).order("term_semester", { ascending: false }), context.supabase.from("commission_members").select("id, role, term_year, term_semester, commission:commissions(id, label)").eq("member_id", data.memberId).order("term_year", { ascending: false }).order("term_semester", { ascending: false })]);
	if (pos.error) throw new Error(pos.error.message);
	if (com.error) throw new Error(com.error.message);
	return {
		positions: pos.data ?? [],
		commissions: com.data ?? []
	};
});
//#endregion
export { assignCommissionMember_createServerFn_handler, assignPosition_createServerFn_handler, getMemberOrgHistory_createServerFn_handler, listCatalog_createServerFn_handler, listChapterPositions_createServerFn_handler, listCommissionMembers_createServerFn_handler, removeCommissionMember_createServerFn_handler, removePosition_createServerFn_handler };
