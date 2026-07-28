import { at as unionType, it as stringType, nt as numberType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/commissions.functions-DYkygwlR.js
var listMyCommissions_createServerFn_handler = createServerRpc({
	id: "9fcb1ed7d8864f683ecb7cb254b4abb285b7d5d5a7aa171e17cf9c12da5e65ed",
	name: "listMyCommissions",
	filename: "src/lib/commissions.functions.ts"
}, (opts) => listMyCommissions.__executeServer(opts));
var listMyCommissions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	year: numberType().int(),
	semester: unionType([literalType(1), literalType(2)])
}).parse(raw)).handler(listMyCommissions_createServerFn_handler, async ({ data, context }) => {
	const { data: profile } = await context.supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
	const email = context.claims?.email ?? null;
	const fullName = profile?.full_name ?? null;
	if (!email && !fullName) return [];
	const filters = [];
	if (email) filters.push(`email.eq.${email}`);
	if (fullName) filters.push(`full_name.eq.${fullName}`);
	const { data: members } = await context.supabase.from("members").select("id").eq("chapter_id", data.chapterId).or(filters.join(","));
	const ids = (members ?? []).map((m) => m.id);
	if (ids.length === 0) return [];
	const { data: rows, error } = await context.supabase.from("commission_members").select("role, commission:commissions(code, label)").eq("chapter_id", data.chapterId).eq("term_year", data.year).eq("term_semester", data.semester).in("member_id", ids);
	if (error) throw new Error(error.message);
	return (rows ?? []).map((r) => {
		const c = r.commission;
		return {
			code: c?.code ?? "",
			label: c?.label ?? "",
			role: r.role,
			isPresident: r.role === "presidente" || r.role === "vice"
		};
	});
});
//#endregion
export { listMyCommissions_createServerFn_handler };
