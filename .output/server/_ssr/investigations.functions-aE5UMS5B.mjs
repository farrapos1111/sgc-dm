import { et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/investigations.functions-aE5UMS5B.js
var chapterInput = objectType({ chapterId: stringType().uuid() });
var statusEnum = enumType([
	"aberta",
	"em_andamento",
	"aprovada",
	"reprovada",
	"arquivada"
]);
var listFiles = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("092195cefd3e40d64b7902e428629749f9bdcceacb205beab7933ea3655d54f9"));
var createFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	candidate_name: stringType().min(1, "Informe o nome do candidato"),
	candidate_birth_date: stringType().nullable().optional(),
	candidate_phone: stringType().nullable().optional(),
	candidate_email: stringType().nullable().optional(),
	guardian_name: stringType().nullable().optional(),
	referred_by: stringType().nullable().optional(),
	notes: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("fe8e1c550cc707a4709f60c4197dda0657d814e354183484f12d7582c88f7c14"));
var updateFileStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	status: statusEnum
}).parse(raw)).handler(createSsrRpc("abfab50a972f408b3ebd3cf197c8737202ae09ec4dc07c73510c15dbc742efd4"));
var deleteFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("3acec300a49f3846adf33fe9dbc0d994e713caf3c67c3d5da095ec28a8f46652"));
var listProcesses = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.parse(raw)).handler(createSsrRpc("48257e8dff35e857e37fd8c33fb7638ba74bbbbb17efded8f5b329f7c5c3269b"));
var createProcess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => chapterInput.extend({
	title: stringType().min(1, "Informe o título"),
	file_id: stringType().uuid().nullable().optional(),
	responsible_member_id: stringType().uuid().nullable().optional(),
	opened_at: stringType().min(1),
	opinion: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("ad0c0c748795e96c1ea6b8fd95d9f5a57e141acc282fd4cef9cdfdfe1f8e4ff1"));
var updateProcess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	status: statusEnum.optional(),
	opinion: stringType().nullable().optional(),
	closed_at: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("f665f4d8576ea76ee0a4df6d6344489e027c19814d09498671822fbc27beb02d"));
var deleteProcess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("2b8845ad04781f23452426f1e5a1ee99b3926200d463a832a58ff8ea35701b7a"));
//#endregion
export { listFiles as a, updateProcess as c, deleteProcess as i, createProcess as n, listProcesses as o, deleteFile as r, updateFileStatus as s, createFile as t };
