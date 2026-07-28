import { Q as arrayType, et as enumType, it as stringType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/members.functions-B5cRfEu4.js
var statusEnum = enumType([
	"ativo",
	"inativo",
	"senior",
	"macom"
]);
var listInput = objectType({
	chapterId: stringType().uuid(),
	search: stringType().optional().default(""),
	status: enumType([
		"ativo",
		"inativo",
		"senior",
		"macom",
		"all"
	]).optional().default("all")
});
var listMembers_createServerFn_handler = createServerRpc({
	id: "b7f69ca8c31846e3e8e27a7ded678ada2faeaaaa74d025348bd7d70d7e81d0f1",
	name: "listMembers",
	filename: "src/lib/members.functions.ts"
}, (opts) => listMembers.__executeServer(opts));
var listMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => listInput.parse(raw)).handler(listMembers_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("members").select("id, full_name, birth_date, status, phone, email, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, created_at").eq("chapter_id", data.chapterId).order("full_name", { ascending: true });
	if (data.status !== "all") q = q.eq("status", data.status);
	if (data.search && data.search.trim().length > 0) q = q.ilike("full_name", `%${data.search}%`);
	const { data: rows, error } = await q;
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var getMember_createServerFn_handler = createServerRpc({
	id: "6c1bae8ab3640f63e7580dafe040082e3d6f5875e2c59b42338eba731897b6d9",
	name: "getMember",
	filename: "src/lib/members.functions.ts"
}, (opts) => getMember.__executeServer(opts));
var getMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(getMember_createServerFn_handler, async ({ data, context }) => {
	const { data: member, error } = await context.supabase.from("members").select("id, chapter_id, full_name, birth_date, status, phone, email, address, cpf_last2, rg_last2, exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay, created_at, updated_at").eq("id", data.id).maybeSingle();
	if (error) throw new Error(error.message);
	if (!member) throw new Error("Membro não encontrado");
	const [guardiansRes, consentsRes, auditRes] = await Promise.all([
		context.supabase.from("guardians").select("id, full_name, relationship, phone, email, cpf_last2, is_primary").eq("member_id", data.id).order("is_primary", { ascending: false }),
		context.supabase.from("lgpd_consents").select("id, consent_text_version, signed_at, guardian_id").eq("member_id", data.id).order("signed_at", { ascending: false }),
		context.supabase.from("audit_logs").select("id, action, new_value, user_id, created_at").eq("table_name", "members").eq("record_id", data.id).order("created_at", { ascending: false }).limit(50)
	]);
	if (guardiansRes.error) throw new Error(guardiansRes.error.message);
	if (consentsRes.error) throw new Error(consentsRes.error.message);
	return {
		member,
		guardians: guardiansRes.data ?? [],
		consents: consentsRes.data ?? [],
		audit: auditRes.data ?? []
	};
});
var guardianSchema = objectType({
	full_name: stringType().min(1),
	relationship: stringType().optional().default(""),
	cpf: stringType().optional().default(""),
	phone: stringType().optional().default(""),
	email: stringType().optional().default("")
});
var addressSchema = objectType({
	street: stringType().optional().default(""),
	city: stringType().optional().default(""),
	state: stringType().optional().default(""),
	zip: stringType().optional().default("")
}).default({
	street: "",
	city: "",
	state: "",
	zip: ""
});
var createInput = objectType({
	chapter_id: stringType().uuid(),
	full_name: stringType().trim().min(2).max(120),
	birth_date: stringType().optional().nullable(),
	exam_grau_iniciatico: stringType().optional().nullable(),
	exam_grau_demolay: stringType().optional().nullable(),
	iniciacao_ordem: stringType().optional().nullable(),
	iniciacao_grau_demolay: stringType().optional().nullable(),
	cpf: stringType().optional().default(""),
	rg: stringType().optional().default(""),
	phone: stringType().optional().default(""),
	email: stringType().email().optional().or(literalType("")).default(""),
	address: addressSchema,
	status: statusEnum.default("ativo"),
	guardians: arrayType(guardianSchema).max(2).optional().default([]),
	consent_text_version: stringType().default("v1-2026-07")
});
var createMember_createServerFn_handler = createServerRpc({
	id: "6e2af91a53b09bc4b8bcecad4e4fc5d630b6ce9fe4be10442167a3985b522423",
	name: "createMember",
	filename: "src/lib/members.functions.ts"
}, (opts) => createMember.__executeServer(opts));
var createMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => createInput.parse(raw)).handler(createMember_createServerFn_handler, async ({ data, context }) => {
	const [first, second] = data.guardians ?? [];
	const args = {
		_chapter_id: data.chapter_id,
		_full_name: data.full_name,
		_birth_date: data.birth_date || null,
		_exam_grau_iniciatico: data.exam_grau_iniciatico || null,
		_exam_grau_demolay: data.exam_grau_demolay || null,
		_iniciacao_ordem: data.iniciacao_ordem || null,
		_iniciacao_grau_demolay: data.iniciacao_grau_demolay || null,
		_cpf: data.cpf || "",
		_rg: data.rg || "",
		_phone: data.phone || "",
		_email: data.email || "",
		_address: data.address ?? {},
		_status: data.status,
		_guardian: first ?? null,
		_consent_text_version: data.consent_text_version
	};
	const { data: id, error } = await context.supabase.rpc("create_member_with_pii", args);
	if (error) throw new Error(error.message);
	if (second && second.full_name.trim().length > 0) {
		const { error: gErr } = await context.supabase.rpc("add_member_guardian", {
			_member_id: id,
			_guardian: second
		});
		if (gErr) throw new Error(gErr.message);
	}
	return { id };
});
var updateInput = objectType({
	id: stringType().uuid(),
	full_name: stringType().trim().min(2).max(120),
	birth_date: stringType().optional().nullable(),
	exam_grau_iniciatico: stringType().optional().nullable(),
	exam_grau_demolay: stringType().optional().nullable(),
	iniciacao_ordem: stringType().optional().nullable(),
	iniciacao_grau_demolay: stringType().optional().nullable(),
	cpf: stringType().optional().default(""),
	rg: stringType().optional().default(""),
	phone: stringType().optional().default(""),
	email: stringType().email().optional().or(literalType("")).default(""),
	address: addressSchema,
	status: statusEnum,
	guardians: arrayType(guardianSchema).max(2).optional().default([])
});
var updateMember_createServerFn_handler = createServerRpc({
	id: "3c37523f14875a6729bb44a4d0de165e09e67a161534e2904273ceeb8c1aa43c",
	name: "updateMember",
	filename: "src/lib/members.functions.ts"
}, (opts) => updateMember.__executeServer(opts));
var updateMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => updateInput.parse(raw)).handler(updateMember_createServerFn_handler, async ({ data, context }) => {
	const args = {
		_member_id: data.id,
		_full_name: data.full_name,
		_birth_date: data.birth_date || null,
		_cpf: data.cpf || "",
		_rg: data.rg || "",
		_phone: data.phone || "",
		_email: data.email || "",
		_address: data.address ?? {},
		_status: data.status,
		_exam_grau_iniciatico: data.exam_grau_iniciatico || null,
		_exam_grau_demolay: data.exam_grau_demolay || null,
		_iniciacao_ordem: data.iniciacao_ordem || null,
		_iniciacao_grau_demolay: data.iniciacao_grau_demolay || null,
		_guardians: data.guardians ?? []
	};
	const { error } = await context.supabase.rpc("update_member_with_pii", args);
	if (error) throw new Error(error.message);
	return { id: data.id };
});
var revealMemberPii_createServerFn_handler = createServerRpc({
	id: "9818b305f29d89ff1b941873f30ddec49f8cd98e6c08d4b2a31f773b0900eec3",
	name: "revealMemberPii",
	filename: "src/lib/members.functions.ts"
}, (opts) => revealMemberPii.__executeServer(opts));
var revealMemberPii = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	memberId: stringType().uuid(),
	field: enumType(["cpf", "rg"])
}).parse(raw)).handler(revealMemberPii_createServerFn_handler, async ({ data, context }) => {
	const { data: plain, error } = await context.supabase.rpc("reveal_member_pii", {
		_member_id: data.memberId,
		_field: data.field
	});
	if (error) throw new Error(error.message);
	return { value: plain ?? "" };
});
//#endregion
export { createMember_createServerFn_handler, getMember_createServerFn_handler, listMembers_createServerFn_handler, revealMemberPii_createServerFn_handler, updateMember_createServerFn_handler };
