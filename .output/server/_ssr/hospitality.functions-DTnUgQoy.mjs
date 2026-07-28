import { it as stringType, nt as numberType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hospitality.functions-DTnUgQoy.js
var chapterInput = objectType({ chapterId: stringType().uuid() });
var listMenus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("11802bf79186474b77d348e1ba58a67d2b21f55bd82e09a6841920f68a80f9be"));
var createMenu = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	title: stringType().min(1, "Informe o título"),
	menu_date: stringType().min(1),
	items: stringType().nullable().optional(),
	estimated_cost: numberType().nonnegative().default(0),
	notes: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("36b11d103745e7b8e2f36da294abf643b28ff30d35e1e197ae3f16148595fa30"));
var deleteMenu = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("bd9f7d45168b08b8fa648f6d8fad6c4f47c9d3521be87ee7c83ac3882d77ebdf"));
var listDuties = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("6aadd998416360f82c4da8a7697c7b037e0688fb23681f7b3ca39819cf85c332"));
var createDuty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	member_id: stringType().uuid(),
	duty_date: stringType().min(1),
	role_label: stringType().min(1).default("Serviço"),
	notes: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("b35ef59ec882e0d277cd88220342798818fa510f97cb1e81a3d266865165520b"));
var deleteDuty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("2e10af8d5e6e9caa097ebf95664b0bd2cde92159fe04c95559a20539404d945c"));
var listCheckins = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("0f581994ae56fef3c744c892ea2ad4b4cac8d15ebb40b4fedc51b1c9d139271b"));
//#endregion
export { listCheckins as a, deleteMenu as i, createMenu as n, listDuties as o, deleteDuty as r, listMenus as s, createDuty as t };
