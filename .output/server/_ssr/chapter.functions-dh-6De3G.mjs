import { $ as booleanType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chapter.functions-dh-6De3G.js
var listLodges_createServerFn_handler = createServerRpc({
	id: "df75f8758a9142fa6a11e4b8720bbf8ae2e22f6d26b618428e5b6d26ea05fe22",
	name: "listLodges",
	filename: "src/lib/chapter.functions.ts"
}, (opts) => listLodges.__executeServer(opts));
var listLodges = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(listLodges_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("chapter_lodges").select("id, chapter_id, name, address, is_primary, created_at").eq("chapter_id", data.chapterId).order("is_primary", { ascending: false }).order("name", { ascending: true });
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var saveLodge_createServerFn_handler = createServerRpc({
	id: "868e2642a7a61eb7c233f6bcf20a7b3593bb013ead2fcaea4f2e09c229ca2663",
	name: "saveLodge",
	filename: "src/lib/chapter.functions.ts"
}, (opts) => saveLodge.__executeServer(opts));
var saveLodge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid().optional(),
	chapter_id: stringType().uuid(),
	name: stringType().min(1),
	address: stringType().nullable().optional(),
	is_primary: booleanType().optional()
}).parse(raw)).handler(saveLodge_createServerFn_handler, async ({ data, context }) => {
	const payload = {
		chapter_id: data.chapter_id,
		name: data.name.trim(),
		address: data.address?.trim() || null,
		is_primary: data.is_primary ?? false
	};
	let row;
	if (data.id) {
		const { data: r, error } = await context.supabase.from("chapter_lodges").update(payload).eq("id", data.id).select().single();
		if (error) throw new Error(error.message);
		row = r;
	} else {
		const { data: r, error } = await context.supabase.from("chapter_lodges").insert({
			...payload,
			created_by: context.userId
		}).select().single();
		if (error) throw new Error(error.message);
		row = r;
	}
	if (payload.is_primary) {
		const { error } = await context.supabase.from("chapter_lodges").update({ is_primary: false }).eq("chapter_id", data.chapter_id).neq("id", row.id);
		if (error) throw new Error(error.message);
	}
	return row;
});
var deleteLodge_createServerFn_handler = createServerRpc({
	id: "7b942a5fc884816d3821e313e5b12288cd8c77718c2167e129ec6503ba82a370",
	name: "deleteLodge",
	filename: "src/lib/chapter.functions.ts"
}, (opts) => deleteLodge.__executeServer(opts));
var deleteLodge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteLodge_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("chapter_lodges").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var updateChapterProfile_createServerFn_handler = createServerRpc({
	id: "30446cbb6d0fae1779a8181d222c940bf788bbd52d96a0da0b9df088ff6c5ac5",
	name: "updateChapterProfile",
	filename: "src/lib/chapter.functions.ts"
}, (opts) => updateChapterProfile.__executeServer(opts));
var updateChapterProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	name: stringType().min(1),
	number: stringType().min(1),
	city: stringType().nullable().optional()
}).parse(raw)).handler(updateChapterProfile_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("chapters").update({
		name: data.name.trim(),
		number: data.number.trim(),
		city: data.city?.trim() || null
	}).eq("id", data.chapter_id).select().single();
	if (error) throw new Error(error.message);
	return row;
});
var updateChapterAccentColor_createServerFn_handler = createServerRpc({
	id: "52e64cf7b5d7f563a301c98104356080a738f95002a50ae93a67e28a9abec21e",
	name: "updateChapterAccentColor",
	filename: "src/lib/chapter.functions.ts"
}, (opts) => updateChapterAccentColor.__executeServer(opts));
var updateChapterAccentColor = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	primary_color: stringType().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
}).parse(raw)).handler(updateChapterAccentColor_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("chapters").update({ primary_color: data.primary_color.toUpperCase() }).eq("id", data.chapter_id).select().single();
	if (error) throw new Error(error.message);
	return row;
});
var updateChaveTemplate_createServerFn_handler = createServerRpc({
	id: "ee258ce043c68b260b6420d1da4d3445a66ac22f385dc41784ec7e9cbd08b117",
	name: "updateChaveTemplate",
	filename: "src/lib/chapter.functions.ts"
}, (opts) => updateChaveTemplate.__executeServer(opts));
var updateChaveTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	template: stringType().max(5e3).nullable()
}).parse(raw)).handler(updateChaveTemplate_createServerFn_handler, async ({ data, context }) => {
	const { data: current, error: readErr } = await context.supabase.from("chapters").select("settings").eq("id", data.chapter_id).single();
	if (readErr) throw new Error(readErr.message);
	const settings = { ...current?.settings ?? {} };
	const value = data.template?.trim();
	if (value) settings.chave_template = value;
	else delete settings.chave_template;
	const { data: row, error } = await context.supabase.from("chapters").update({ settings }).eq("id", data.chapter_id).select("id, settings").single();
	if (error) throw new Error(error.message);
	return row;
});
//#endregion
export { deleteLodge_createServerFn_handler, listLodges_createServerFn_handler, saveLodge_createServerFn_handler, updateChapterAccentColor_createServerFn_handler, updateChapterProfile_createServerFn_handler, updateChaveTemplate_createServerFn_handler };
