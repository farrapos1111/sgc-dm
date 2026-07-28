import { et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/attendance.functions-B5vlRrhX.js
/** Itens do calendário que já começaram e ainda não terminaram (ou começaram há < 6h). */
var listOngoingItems = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("bf2b62a36dee13592dcdd7968b25f52fe7968e1dd91c36d2ef3dc14ccd70ac60"));
/** Dados completos da tela de Ongoing: item, membros ativos, presenças e ata. */
var getOngoing = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ calendarEventId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("392d42583a7e67f9c28150f3adc3bca2d2b50af49753885a0afdbd9bb5a6283c"));
var setAttendance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	calendarEventId: stringType().uuid(),
	memberId: stringType().uuid(),
	status: enumType(["presente", "ausente"]),
	justification: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("c283ee6ad52faad14a2c6af8c89182224a17607654f4ddfd4c8d1596c01824a6"));
var saveMinutes = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	calendarEventId: stringType().uuid(),
	content: stringType()
}).parse(raw)).handler(createSsrRpc("d3e0fcffd699643c86388a4d9c0392d04c669086c425404945facf9b4172c915"));
/** Visão geral do módulo de Presenças: itens passados/atuais + registros. */
var listAttendanceOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("a8806bf38036e2f094a032a6a454f2049acbe5bda4f36a6cdc1d93785f6b2a9f"));
/** Histórico de presença de um membro. */
var getMemberAttendance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ memberId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("6240f37311b024f33041c04d7e596369fd4311f9c90c096d3fbdf3c5e6bfe379"));
//#endregion
export { saveMinutes as a, listOngoingItems as i, getOngoing as n, setAttendance as o, listAttendanceOverview as r, getMemberAttendance as t };
