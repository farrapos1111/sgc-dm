import { $ as booleanType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chapter.functions-DdatMChF.js
var listLodges = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("df75f8758a9142fa6a11e4b8720bbf8ae2e22f6d26b618428e5b6d26ea05fe22"));
var saveLodge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid().optional(),
	chapter_id: stringType().uuid(),
	name: stringType().min(1),
	address: stringType().nullable().optional(),
	is_primary: booleanType().optional()
}).parse(raw)).handler(createSsrRpc("868e2642a7a61eb7c233f6bcf20a7b3593bb013ead2fcaea4f2e09c229ca2663"));
var deleteLodge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("7b942a5fc884816d3821e313e5b12288cd8c77718c2167e129ec6503ba82a370"));
var updateChapterProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	name: stringType().min(1),
	number: stringType().min(1),
	city: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("30446cbb6d0fae1779a8181d222c940bf788bbd52d96a0da0b9df088ff6c5ac5"));
var updateChapterAccentColor = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	primary_color: stringType().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
}).parse(raw)).handler(createSsrRpc("52e64cf7b5d7f563a301c98104356080a738f95002a50ae93a67e28a9abec21e"));
/** Salva o modelo da "chave do dia" dentro de chapters.settings. */
var updateChaveTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid(),
	template: stringType().max(5e3).nullable()
}).parse(raw)).handler(createSsrRpc("ee258ce043c68b260b6420d1da4d3445a66ac22f385dc41784ec7e9cbd08b117"));
//#endregion
export { updateChapterProfile as a, updateChapterAccentColor as i, listLodges as n, updateChaveTemplate as o, saveLodge as r, deleteLodge as t };
