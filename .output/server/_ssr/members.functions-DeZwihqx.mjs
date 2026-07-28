import { Q as arrayType, et as enumType, it as stringType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/members.functions-DeZwihqx.js
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
var listMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => listInput.parse(raw)).handler(createSsrRpc("b7f69ca8c31846e3e8e27a7ded678ada2faeaaaa74d025348bd7d70d7e81d0f1"));
var getMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("6c1bae8ab3640f63e7580dafe040082e3d6f5875e2c59b42338eba731897b6d9"));
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
var createMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => createInput.parse(raw)).handler(createSsrRpc("6e2af91a53b09bc4b8bcecad4e4fc5d630b6ce9fe4be10442167a3985b522423"));
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
var updateMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => updateInput.parse(raw)).handler(createSsrRpc("3c37523f14875a6729bb44a4d0de165e09e67a161534e2904273ceeb8c1aa43c"));
var revealMemberPii = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	memberId: stringType().uuid(),
	field: enumType(["cpf", "rg"])
}).parse(raw)).handler(createSsrRpc("9818b305f29d89ff1b941873f30ddec49f8cd98e6c08d4b2a31f773b0900eec3"));
//#endregion
export { updateMember as a, revealMemberPii as i, getMember as n, listMembers as r, createMember as t };
