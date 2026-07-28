import { et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/investigations.functions-DCGX5B2j.js
var chapterInput = objectType({ chapterId: stringType().uuid() });
var statusEnum = enumType([
	"aberta",
	"em_andamento",
	"aprovada",
	"reprovada",
	"arquivada"
]);
var listFiles_createServerFn_handler = createServerRpc({
	id: "092195cefd3e40d64b7902e428629749f9bdcceacb205beab7933ea3655d54f9",
	name: "listFiles",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => listFiles.__executeServer(opts));
var listFiles = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listFiles_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("investigation_files").select("id, candidate_name, candidate_birth_date, candidate_phone, candidate_email, guardian_name, referred_by, notes, status, created_at").eq("chapter_id", data.chapterId).order("created_at", { ascending: false });
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var createFile_createServerFn_handler = createServerRpc({
	id: "fe8e1c550cc707a4709f60c4197dda0657d814e354183484f12d7582c88f7c14",
	name: "createFile",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => createFile.__executeServer(opts));
var createFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	candidate_name: stringType().min(1, "Informe o nome do candidato"),
	candidate_birth_date: stringType().nullable().optional(),
	candidate_phone: stringType().nullable().optional(),
	candidate_email: stringType().nullable().optional(),
	guardian_name: stringType().nullable().optional(),
	referred_by: stringType().nullable().optional(),
	notes: stringType().nullable().optional()
}).parse(raw)).handler(createFile_createServerFn_handler, async ({ data, context }) => {
	const { chapterId, ...rest } = data;
	const { error } = await context.supabase.from("investigation_files").insert({
		chapter_id: chapterId,
		...rest,
		candidate_birth_date: rest.candidate_birth_date || null,
		created_by: context.userId
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var updateFileStatus_createServerFn_handler = createServerRpc({
	id: "abfab50a972f408b3ebd3cf197c8737202ae09ec4dc07c73510c15dbc742efd4",
	name: "updateFileStatus",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => updateFileStatus.__executeServer(opts));
var updateFileStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	status: statusEnum
}).parse(raw)).handler(updateFileStatus_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("investigation_files").update({ status: data.status }).eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var deleteFile_createServerFn_handler = createServerRpc({
	id: "3acec300a49f3846adf33fe9dbc0d994e713caf3c67c3d5da095ec28a8f46652",
	name: "deleteFile",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => deleteFile.__executeServer(opts));
var deleteFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteFile_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("investigation_files").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listProcesses_createServerFn_handler = createServerRpc({
	id: "48257e8dff35e857e37fd8c33fb7638ba74bbbbb17efded8f5b329f7c5c3269b",
	name: "listProcesses",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => listProcesses.__executeServer(opts));
var listProcesses = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(listProcesses_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await context.supabase.from("investigation_processes").select("id, title, status, opened_at, closed_at, opinion, file_id, file:investigation_files(id, candidate_name), responsible:members(id, full_name)").eq("chapter_id", data.chapterId).order("opened_at", { ascending: false });
	if (error) throw new Error(error.message);
	return rows ?? [];
});
var createProcess_createServerFn_handler = createServerRpc({
	id: "ad0c0c748795e96c1ea6b8fd95d9f5a57e141acc282fd4cef9cdfdfe1f8e4ff1",
	name: "createProcess",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => createProcess.__executeServer(opts));
var createProcess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	title: stringType().min(1, "Informe o título"),
	file_id: stringType().uuid().nullable().optional(),
	responsible_member_id: stringType().uuid().nullable().optional(),
	opened_at: stringType().min(1),
	opinion: stringType().nullable().optional()
}).parse(raw)).handler(createProcess_createServerFn_handler, async ({ data, context }) => {
	const { chapterId, ...rest } = data;
	const { error } = await context.supabase.from("investigation_processes").insert({
		chapter_id: chapterId,
		...rest,
		file_id: rest.file_id || null,
		responsible_member_id: rest.responsible_member_id || null,
		created_by: context.userId
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var updateProcess_createServerFn_handler = createServerRpc({
	id: "f665f4d8576ea76ee0a4df6d6344489e027c19814d09498671822fbc27beb02d",
	name: "updateProcess",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => updateProcess.__executeServer(opts));
var updateProcess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	status: statusEnum.optional(),
	opinion: stringType().nullable().optional(),
	closed_at: stringType().nullable().optional()
}).parse(raw)).handler(updateProcess_createServerFn_handler, async ({ data, context }) => {
	const { id, ...patch } = data;
	const { error } = await context.supabase.from("investigation_processes").update(patch).eq("id", id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var deleteProcess_createServerFn_handler = createServerRpc({
	id: "2b8845ad04781f23452426f1e5a1ee99b3926200d463a832a58ff8ea35701b7a",
	name: "deleteProcess",
	filename: "src/lib/investigations.functions.ts"
}, (opts) => deleteProcess.__executeServer(opts));
var deleteProcess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(deleteProcess_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("investigation_processes").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { createFile_createServerFn_handler, createProcess_createServerFn_handler, deleteFile_createServerFn_handler, deleteProcess_createServerFn_handler, listFiles_createServerFn_handler, listProcesses_createServerFn_handler, updateFileStatus_createServerFn_handler, updateProcess_createServerFn_handler };
