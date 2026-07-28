import { Q as arrayType, et as enumType, it as stringType, nt as numberType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/finance.functions-CIZoOWjJ.js
var chapterInput = objectType({ chapterId: stringType().uuid() });
/**
* Lista lançamentos do mês ou de todo o período (`month: null`) e devolve
* também os totais acumulados de todos os tempos (saldo do banco).
*/
var listCashEntries = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	year: numberType().int(),
	month: numberType().int().min(1).max(12).nullable()
}).parse(raw)).handler(createSsrRpc("8bfb88ba1b850a2743e19825e13b5941683fe788a8faa032d7e7290c5de7c80a"));
var createCashEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	kind: enumType(["entrada", "saida"]),
	category: stringType().min(1).default("Outras"),
	subcategoryId: stringType().uuid().nullable().default(null),
	description: stringType().min(1, "Informe a descrição"),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1)
}).parse(raw)).handler(createSsrRpc("a6beba4d6c2a1a52afc834412ce63f76fbcf9d4eb7c56342f4a5892c1955e903"));
var updateCashEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	kind: enumType(["entrada", "saida"]),
	category: stringType().min(1),
	subcategoryId: stringType().uuid().nullable().default(null),
	description: stringType().min(1),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1)
}).parse(raw)).handler(createSsrRpc("5ca4c32d6d1880666fb531fc5aad637a42c63d5d743f442023dd94cfa77aa8d5"));
var deleteCashEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("f644cd3515e69690f029f1878b87c025f7d32cfb1a947e6265718f2bac1e4401"));
/** Importação em lote (planilha revisada pelo usuário). */
var importCashEntries = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({ rows: arrayType(objectType({
	kind: enumType(["entrada", "saida"]),
	category: stringType().min(1),
	description: stringType().min(1),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1)
})).min(1).max(1e3) }).parse(raw)).handler(createSsrRpc("58c179fafefabcf3057af163fd9e65b9b0dd8648522da9bf78ac3e741c647f5f"));
/**
* Categorias fixas do capítulo + subcategorias dinâmicas configuradas pelas
* comissões de Eventos e Hospitalaria (com os eventos do calendário).
*/
var listCashCategories = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("aecbf18056a4fc809556e5535b8fa00f2f8a9fdb9e8d651451b45aef8288ecc0"));
var upsertCashCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	id: stringType().uuid().optional(),
	name: stringType().trim().min(1, "Informe o nome").max(60),
	sort_order: numberType().int().default(100)
}).parse(raw)).handler(createSsrRpc("6efa1d8b6be6ddfb0fb70537e2391da948a912846c5b5dab3c686999ea539c32"));
var deleteCashCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("124c8ce09b3e924562cf0fcb0d47f88ca6f1a1c2ae79c3114077cd9fe28e0d8c"));
/** Somente membros ATIVOS pagam mensalidade (Senior DeMolay e Maçom são isentos). */
var listDues = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	year: numberType().int(),
	month: numberType().int().min(1).max(12)
}).parse(raw)).handler(createSsrRpc("254f9788564bc48ca4d764face9ea0b43e694b278dd840982a202f361744b7ac"));
var upsertDue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	memberId: stringType().uuid(),
	year: numberType().int(),
	month: numberType().int().min(1).max(12),
	amount: numberType().nonnegative(),
	status: enumType([
		"em_aberto",
		"pago",
		"isento"
	]),
	paidAt: stringType().optional()
}).parse(raw)).handler(createSsrRpc("22e0a396b08fced1ed493268273746c6e6dc793cb7c3dc1f22cce145897da508"));
var generateDues = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	year: numberType().int(),
	month: numberType().int().min(1).max(12),
	amount: numberType().nonnegative()
}).parse(raw)).handler(createSsrRpc("2734983cad436bdae52cee01fff92bebd32a94f8bb7920206840687169dbcbc0"));
/** Nomes de PCC, MC, Tesoureiro e Consultor da Tesouraria para o relatório. */
var getFinanceSigners = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("6bda75013d340a0dad64184511587af6fc800e1084e29bdadccb9a5d84ee8fb1"));
/**
* Lançamento manual de mensalidade (vários meses, valor negociado, ajustes).
* Mantém a descrição padrão e marca as competências como pagas.
*/
var createManualDuesEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	memberId: stringType().uuid(),
	competences: arrayType(objectType({
		year: numberType().int(),
		month: numberType().int().min(1).max(12)
	})).min(1, "Selecione ao menos uma competência").max(24),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1),
	notes: stringType().trim().max(300).optional()
}).parse(raw)).handler(createSsrRpc("9ecba0586eb916979548b9d4d85a513d3e69b20e77451d1c4e12120cbfda71c1"));
/** Membros ativos do capítulo (para o lançamento manual de mensalidade). */
var listActiveMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("3bca2d57dec310fe53c586937d395120cec476e2291d9511e03c856047659f8f"));
//#endregion
export { generateDues as a, listActiveMembers as c, listDues as d, updateCashEntry as f, deleteCashEntry as i, listCashCategories as l, upsertDue as m, createManualDuesEntry as n, getFinanceSigners as o, upsertCashCategory as p, deleteCashCategory as r, importCashEntries as s, createCashEntry as t, listCashEntries as u };
