import { at as unionType, et as enumType, it as stringType, nt as numberType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/organization.functions-VBOyTKjU.js
var termInput = objectType({
	chapterId: stringType().uuid(),
	year: numberType().int().min(1900).max(2200),
	semester: unionType([literalType(1), literalType(2)])
});
var listCatalog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("6f71f190efa9e7fe2d88b21e0ce1e6bbfd13299ef127acb1a97186a2b8f2f110"));
var listChapterPositions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.parse(raw)).handler(createSsrRpc("9c3668d761075c3c7ab4513f00b50b7c9a29eeff0a55056a5d046019ea3c388f"));
var assignPosition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.extend({
	memberId: stringType().uuid(),
	positionId: numberType().int()
}).parse(raw)).handler(createSsrRpc("731dc741227c2409134238f7bd1761f1e82c6d123a3f62ccbe7c95c5603b12cf"));
var removePosition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("00967aa91f090566181e62eccfad0cf321615a91060f770e115a671d3dac32a1"));
var listCommissionMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.parse(raw)).handler(createSsrRpc("fc171828d1ee93f583ac9ed42d10949bfe146b1ee7d9a48ecdf87f647ece59ff"));
var assignCommissionMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => termInput.extend({
	memberId: stringType().uuid(),
	commissionId: numberType().int(),
	role: enumType([
		"presidente",
		"vice",
		"membro",
		"auxiliar_senior"
	])
}).parse(raw)).handler(createSsrRpc("0f3113353d5123b66d0e7dae46a6e275c5e57f16b4154b28538fc620005610ec"));
var removeCommissionMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("7c7c634bc1a7639aea4865c05572f4f4e096f51faae950059cfa467a75b3cf31"));
/** Histórico completo de cargos e comissões de um membro. */
var getMemberOrgHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ memberId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("9fcfa9e82e08562cf8284d5dd8337894876f3e1b04da4796967bccf1e83b43b0"));
//#endregion
export { listChapterPositions as a, removePosition as c, listCatalog as i, assignPosition as n, listCommissionMembers as o, getMemberOrgHistory as r, removeCommissionMember as s, assignCommissionMember as t };
