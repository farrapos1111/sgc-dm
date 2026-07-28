import { Q as arrayType, et as enumType, it as stringType, nt as numberType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { n as competenceLabel, r as duesDescription } from "./cash-categories-CWWVJoRh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/finance.functions-DgHeCmfE.js
var chapterInput = objectType({ chapterId: stringType().uuid() });
var listCashEntries_createServerFn_handler = createServerRpc({
	id: "8bfb88ba1b850a2743e19825e13b5941683fe788a8faa032d7e7290c5de7c80a",
	name: "listCashEntries",
	filename: "src/lib/finance.functions.ts"
}, (opts) => listCashEntries.__executeServer(opts));
var listCashEntries = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	year: numberType().int(),
	month: numberType().int().min(1).max(12).nullable()
}).parse(raw)).handler(listCashEntries_createServerFn_handler, async ({ data, context }) => {
	let query = context.supabase.from("cash_entries").select("id, kind, category, subcategory, description, amount, entry_date, created_at").eq("chapter_id", data.chapterId);
	if (data.month) {
		const from = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
		const end = new Date(data.year, data.month, 1).toISOString().slice(0, 10);
		query = query.gte("entry_date", from).lt("entry_date", end);
	}
	const [rows, all] = await Promise.all([query.order("entry_date", { ascending: false }).limit(2e3), context.supabase.from("cash_entries").select("kind, amount").eq("chapter_id", data.chapterId).limit(1e4)]);
	if (rows.error) throw new Error(rows.error.message);
	if (all.error) throw new Error(all.error.message);
	let bankIn = 0;
	let bankOut = 0;
	for (const r of all.data ?? []) if (r.kind === "entrada") bankIn += Number(r.amount);
	else bankOut += Number(r.amount);
	return {
		entries: rows.data ?? [],
		bank: {
			income: bankIn,
			expense: bankOut,
			balance: bankIn - bankOut
		}
	};
});
var createCashEntry_createServerFn_handler = createServerRpc({
	id: "a6beba4d6c2a1a52afc834412ce63f76fbcf9d4eb7c56342f4a5892c1955e903",
	name: "createCashEntry",
	filename: "src/lib/finance.functions.ts"
}, (opts) => createCashEntry.__executeServer(opts));
var createCashEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	kind: enumType(["entrada", "saida"]),
	category: stringType().min(1).default("Outras"),
	subcategoryId: stringType().uuid().nullable().default(null),
	description: stringType().min(1, "Informe a descrição"),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1)
}).parse(raw)).handler(createCashEntry_createServerFn_handler, async ({ data, context }) => {
	const { resolveSubcategory } = await import("./cash-validation.server-DKHx9Z-y.mjs");
	const resolved = await resolveSubcategory(context.supabase, data.chapterId, data.category, data.subcategoryId);
	const { error } = await context.supabase.from("cash_entries").insert({
		chapter_id: data.chapterId,
		kind: data.kind,
		category: data.category,
		subcategory: resolved.subcategory,
		calendar_event_id: resolved.calendar_event_id,
		description: data.description,
		amount: data.amount,
		entry_date: data.entry_date,
		created_by: context.userId
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var updateCashEntry_createServerFn_handler = createServerRpc({
	id: "5ca4c32d6d1880666fb531fc5aad637a42c63d5d743f442023dd94cfa77aa8d5",
	name: "updateCashEntry",
	filename: "src/lib/finance.functions.ts"
}, (opts) => updateCashEntry.__executeServer(opts));
var updateCashEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	kind: enumType(["entrada", "saida"]),
	category: stringType().min(1),
	subcategoryId: stringType().uuid().nullable().default(null),
	description: stringType().min(1),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1)
}).parse(raw)).handler(updateCashEntry_createServerFn_handler, async ({ data, context }) => {
	const { resolveSubcategory } = await import("./cash-validation.server-DKHx9Z-y.mjs");
	const { data: current, error: curErr } = await context.supabase.from("cash_entries").select("chapter_id").eq("id", data.id).single();
	if (curErr) throw new Error(curErr.message);
	const resolved = await resolveSubcategory(context.supabase, current.chapter_id, data.category, data.subcategoryId);
	const { id, subcategoryId, ...patch } = data;
	const { error } = await context.supabase.from("cash_entries").update({
		...patch,
		subcategory: resolved.subcategory,
		calendar_event_id: resolved.calendar_event_id
	}).eq("id", id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var deleteCashEntry_createServerFn_handler = createServerRpc({
	id: "f644cd3515e69690f029f1878b87c025f7d32cfb1a947e6265718f2bac1e4401",
	name: "deleteCashEntry",
	filename: "src/lib/finance.functions.ts"
}, (opts) => deleteCashEntry.__executeServer(opts));
var deleteCashEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteCashEntry_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("cash_entries").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var importCashEntries_createServerFn_handler = createServerRpc({
	id: "58c179fafefabcf3057af163fd9e65b9b0dd8648522da9bf78ac3e741c647f5f",
	name: "importCashEntries",
	filename: "src/lib/finance.functions.ts"
}, (opts) => importCashEntries.__executeServer(opts));
var importCashEntries = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({ rows: arrayType(objectType({
	kind: enumType(["entrada", "saida"]),
	category: stringType().min(1),
	description: stringType().min(1),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1)
})).min(1).max(1e3) }).parse(raw)).handler(importCashEntries_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("cash_entries").insert(data.rows.map((r) => ({
		chapter_id: data.chapterId,
		kind: r.kind,
		category: r.category,
		description: r.description,
		amount: r.amount,
		entry_date: r.entry_date,
		created_by: context.userId
	})));
	if (error) throw new Error(error.message);
	return { imported: data.rows.length };
});
var listCashCategories_createServerFn_handler = createServerRpc({
	id: "aecbf18056a4fc809556e5535b8fa00f2f8a9fdb9e8d651451b45aef8288ecc0",
	name: "listCashCategories",
	filename: "src/lib/finance.functions.ts"
}, (opts) => listCashCategories.__executeServer(opts));
var listCashCategories = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listCashCategories_createServerFn_handler, async ({ data, context }) => {
	const [cats, calendar, subs] = await Promise.all([
		context.supabase.from("cash_categories").select("id, name, sort_order, is_system").eq("chapter_id", data.chapterId).order("sort_order").order("name"),
		context.supabase.from("calendar_events").select("id, title, start_at").eq("chapter_id", data.chapterId).in("event_type", [
			"evento",
			"filantropia",
			"entretenimento"
		]).order("start_at", { ascending: false }).limit(100),
		context.supabase.from("cash_subcategories").select("id, scope, calendar_event_id, name, active").eq("chapter_id", data.chapterId).eq("active", true).order("name")
	]);
	if (cats.error) throw new Error(cats.error.message);
	if (subs.error) throw new Error(subs.error.message);
	return {
		categories: cats.data ?? [],
		events: calendar.data ?? [],
		subcategories: subs.data ?? []
	};
});
var upsertCashCategory_createServerFn_handler = createServerRpc({
	id: "6efa1d8b6be6ddfb0fb70537e2391da948a912846c5b5dab3c686999ea539c32",
	name: "upsertCashCategory",
	filename: "src/lib/finance.functions.ts"
}, (opts) => upsertCashCategory.__executeServer(opts));
var upsertCashCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	id: stringType().uuid().optional(),
	name: stringType().trim().min(1, "Informe o nome").max(60),
	sort_order: numberType().int().default(100)
}).parse(raw)).handler(upsertCashCategory_createServerFn_handler, async ({ data, context }) => {
	if (data.id) {
		const { error } = await context.supabase.from("cash_categories").update({
			name: data.name,
			sort_order: data.sort_order
		}).eq("id", data.id);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await context.supabase.from("cash_categories").insert({
			chapter_id: data.chapterId,
			name: data.name,
			sort_order: data.sort_order,
			created_by: context.userId
		});
		if (error) throw new Error(error.message);
	}
	return { ok: true };
});
var deleteCashCategory_createServerFn_handler = createServerRpc({
	id: "124c8ce09b3e924562cf0fcb0d47f88ca6f1a1c2ae79c3114077cd9fe28e0d8c",
	name: "deleteCashCategory",
	filename: "src/lib/finance.functions.ts"
}, (opts) => deleteCashCategory.__executeServer(opts));
var deleteCashCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteCashCategory_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("cash_categories").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listDues_createServerFn_handler = createServerRpc({
	id: "254f9788564bc48ca4d764face9ea0b43e694b278dd840982a202f361744b7ac",
	name: "listDues",
	filename: "src/lib/finance.functions.ts"
}, (opts) => listDues.__executeServer(opts));
var listDues = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	year: numberType().int(),
	month: numberType().int().min(1).max(12)
}).parse(raw)).handler(listDues_createServerFn_handler, async ({ data, context }) => {
	const [members, dues] = await Promise.all([context.supabase.from("members").select("id, full_name, status").eq("chapter_id", data.chapterId).in("status", ["ativo"]).order("full_name"), context.supabase.from("member_dues").select("id, member_id, amount, status, paid_at, competence_year, competence_month").eq("chapter_id", data.chapterId).eq("competence_year", data.year).eq("competence_month", data.month)]);
	if (members.error) throw new Error(members.error.message);
	if (dues.error) throw new Error(dues.error.message);
	return {
		members: members.data ?? [],
		dues: dues.data ?? []
	};
});
var upsertDue_createServerFn_handler = createServerRpc({
	id: "22e0a396b08fced1ed493268273746c6e6dc793cb7c3dc1f22cce145897da508",
	name: "upsertDue",
	filename: "src/lib/finance.functions.ts"
}, (opts) => upsertDue.__executeServer(opts));
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
}).parse(raw)).handler(upsertDue_createServerFn_handler, async ({ data, context }) => {
	const paidAt = data.paidAt || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	const { data: existing } = await context.supabase.from("member_dues").select("id, status, cash_entry_id").eq("chapter_id", data.chapterId).eq("member_id", data.memberId).eq("competence_year", data.year).eq("competence_month", data.month).maybeSingle();
	const { data: member, error: memberErr } = await context.supabase.from("members").select("full_name").eq("id", data.memberId).single();
	if (memberErr) throw new Error(memberErr.message);
	let cashEntryId = existing?.cash_entry_id ?? null;
	if (data.status !== "pago" && cashEntryId) {
		await context.supabase.from("cash_entries").delete().eq("id", cashEntryId);
		cashEntryId = null;
	}
	if (data.status === "pago" && !cashEntryId && data.amount > 0) {
		const { data: entry, error: entryErr } = await context.supabase.from("cash_entries").insert({
			chapter_id: data.chapterId,
			kind: "entrada",
			category: "Mensalidades",
			description: `Mensalidade - ${member.full_name} - ${competenceLabel(data.year, data.month)}`,
			amount: data.amount,
			entry_date: paidAt,
			created_by: context.userId
		}).select("id").single();
		if (entryErr) throw new Error(entryErr.message);
		cashEntryId = entry.id;
	}
	const payload = {
		chapter_id: data.chapterId,
		member_id: data.memberId,
		competence_year: data.year,
		competence_month: data.month,
		amount: data.amount,
		status: data.status,
		paid_at: data.status === "pago" ? paidAt : null,
		cash_entry_id: cashEntryId,
		created_by: context.userId
	};
	const { error } = await context.supabase.from("member_dues").upsert(payload, { onConflict: "chapter_id,member_id,competence_year,competence_month" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var generateDues_createServerFn_handler = createServerRpc({
	id: "2734983cad436bdae52cee01fff92bebd32a94f8bb7920206840687169dbcbc0",
	name: "generateDues",
	filename: "src/lib/finance.functions.ts"
}, (opts) => generateDues.__executeServer(opts));
var generateDues = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	year: numberType().int(),
	month: numberType().int().min(1).max(12),
	amount: numberType().nonnegative()
}).parse(raw)).handler(generateDues_createServerFn_handler, async ({ data, context }) => {
	const { data: members, error: mErr } = await context.supabase.from("members").select("id").eq("chapter_id", data.chapterId).in("status", ["ativo"]);
	if (mErr) throw new Error(mErr.message);
	const rows = (members ?? []).map((m) => ({
		chapter_id: data.chapterId,
		member_id: m.id,
		competence_year: data.year,
		competence_month: data.month,
		amount: data.amount,
		status: "em_aberto",
		created_by: context.userId
	}));
	if (rows.length === 0) return { created: 0 };
	const { error } = await context.supabase.from("member_dues").upsert(rows, {
		onConflict: "chapter_id,member_id,competence_year,competence_month",
		ignoreDuplicates: true
	});
	if (error) throw new Error(error.message);
	return { created: rows.length };
});
var getFinanceSigners_createServerFn_handler = createServerRpc({
	id: "6bda75013d340a0dad64184511587af6fc800e1084e29bdadccb9a5d84ee8fb1",
	name: "getFinanceSigners",
	filename: "src/lib/finance.functions.ts"
}, (opts) => getFinanceSigners.__executeServer(opts));
var getFinanceSigners = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(getFinanceSigners_createServerFn_handler, async ({ data, context }) => {
	const now = /* @__PURE__ */ new Date();
	const year = now.getFullYear();
	const semester = now.getMonth() < 6 ? 1 : 2;
	const { data: rows, error } = await context.supabase.from("member_positions").select("member_id, term_year, term_semester, positions(code, label), members(full_name)").eq("chapter_id", data.chapterId).eq("term_year", year).eq("term_semester", semester);
	if (error) throw new Error(error.message);
	const find = (codes) => (rows ?? []).find((r) => codes.includes(r.positions?.code))?.members?.full_name ?? "";
	return [
		{
			role: "Presidente do Conselho Consultivo",
			name: find(["presidente_conselho", "pcc"])
		},
		{
			role: "Mestre Conselheiro",
			name: find(["mestre_conselheiro", "mc"])
		},
		{
			role: "Tesoureiro",
			name: find(["tesoureiro", "tes"])
		},
		{
			role: "Consultor da Tesouraria",
			name: find(["consultor_tesouraria", "consultor"])
		}
	];
});
var createManualDuesEntry_createServerFn_handler = createServerRpc({
	id: "9ecba0586eb916979548b9d4d85a513d3e69b20e77451d1c4e12120cbfda71c1",
	name: "createManualDuesEntry",
	filename: "src/lib/finance.functions.ts"
}, (opts) => createManualDuesEntry.__executeServer(opts));
var createManualDuesEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	memberId: stringType().uuid(),
	competences: arrayType(objectType({
		year: numberType().int(),
		month: numberType().int().min(1).max(12)
	})).min(1, "Selecione ao menos uma competência").max(24),
	amount: numberType().nonnegative(),
	entry_date: stringType().min(1),
	notes: stringType().trim().max(300).optional()
}).parse(raw)).handler(createManualDuesEntry_createServerFn_handler, async ({ data, context }) => {
	const { data: member, error: memberErr } = await context.supabase.from("members").select("full_name").eq("id", data.memberId).single();
	if (memberErr) throw new Error(memberErr.message);
	const description = duesDescription(member.full_name, data.competences);
	const { data: entry, error: entryErr } = await context.supabase.from("cash_entries").insert({
		chapter_id: data.chapterId,
		kind: "entrada",
		category: "Mensalidades",
		description,
		amount: data.amount,
		entry_date: data.entry_date,
		created_by: context.userId
	}).select("id").single();
	if (entryErr) throw new Error(entryErr.message);
	const share = data.competences.length > 0 ? data.amount / data.competences.length : 0;
	const { error: duesErr } = await context.supabase.from("member_dues").upsert(data.competences.map((c) => ({
		chapter_id: data.chapterId,
		member_id: data.memberId,
		competence_year: c.year,
		competence_month: c.month,
		amount: Number(share.toFixed(2)),
		status: "pago",
		paid_at: data.entry_date,
		cash_entry_id: entry.id,
		notes: data.notes ?? null,
		created_by: context.userId
	})), { onConflict: "chapter_id,member_id,competence_year,competence_month" });
	if (duesErr) throw new Error(duesErr.message);
	return {
		ok: true,
		description
	};
});
var listActiveMembers_createServerFn_handler = createServerRpc({
	id: "3bca2d57dec310fe53c586937d395120cec476e2291d9511e03c856047659f8f",
	name: "listActiveMembers",
	filename: "src/lib/finance.functions.ts"
}, (opts) => listActiveMembers.__executeServer(opts));
var listActiveMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listActiveMembers_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("members").select("id, full_name").eq("chapter_id", data.chapterId).in("status", ["ativo"]).order("full_name");
	if (error) throw new Error(error.message);
	return rows ?? [];
});
//#endregion
export { createCashEntry_createServerFn_handler, createManualDuesEntry_createServerFn_handler, deleteCashCategory_createServerFn_handler, deleteCashEntry_createServerFn_handler, generateDues_createServerFn_handler, getFinanceSigners_createServerFn_handler, importCashEntries_createServerFn_handler, listActiveMembers_createServerFn_handler, listCashCategories_createServerFn_handler, listCashEntries_createServerFn_handler, listDues_createServerFn_handler, updateCashEntry_createServerFn_handler, upsertCashCategory_createServerFn_handler, upsertDue_createServerFn_handler };
