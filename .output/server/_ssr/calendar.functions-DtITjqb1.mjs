import { $ as booleanType, Q as arrayType, et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar.functions-DtITjqb1.js
var eventTypeEnum = enumType([
	"sessao_ritualistica",
	"sessao_administrativa",
	"evento",
	"filantropia",
	"entretenimento"
]);
var listCalendarItems = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterIds: arrayType(stringType().uuid()).min(1),
	from: stringType().datetime().optional(),
	to: stringType().datetime().optional()
}).parse(raw)).handler(createSsrRpc("10ff72d315597453c5d6c1a172826a2e392ca3a3a9b4ef5f1b546849dceade65"));
var createCalendarItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapter_id: stringType().uuid().optional(),
	title: stringType().min(1),
	event_type: eventTypeEnum,
	mandatory: booleanType().optional(),
	public_open: booleanType().optional(),
	start_at: stringType().datetime(),
	end_at: stringType().datetime().nullable().optional(),
	location: stringType().nullable().optional(),
	address: stringType().nullable().optional(),
	lodge_id: stringType().uuid().nullable().optional(),
	dress_code: stringType().nullable().optional(),
	description: stringType().nullable().optional(),
	related_event_id: stringType().uuid().nullable().optional()
}).parse(raw)).handler(createSsrRpc("c3c027dd66e2abb49f1f6dd053721bf6c3a967e80bb67b54a58ae4527db3a50b"));
var updateCalendarItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	title: stringType().min(1),
	event_type: eventTypeEnum,
	mandatory: booleanType().optional(),
	public_open: booleanType().optional(),
	start_at: stringType().datetime(),
	end_at: stringType().datetime().nullable().optional(),
	location: stringType().nullable().optional(),
	address: stringType().nullable().optional(),
	lodge_id: stringType().uuid().nullable().optional(),
	dress_code: stringType().nullable().optional(),
	description: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("871eaec89054103d90987eac94877618dcc41a9a8c7e991e4884f31d7df66220"));
var deleteCalendarItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("9593da722f5a44fd4e6abd71d518b68c448eeebc0036abdfe90ebc93af0eef8e"));
//#endregion
export { updateCalendarItem as i, deleteCalendarItem as n, listCalendarItems as r, createCalendarItem as t };
