import { et as enumType, it as stringType, nt as numberType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/minute-vars-ChG2Qv-l.js
var SIGNER_ROLES = [
	"presidente_conselho",
	"mestre_conselheiro",
	"escrivao"
];
var SIGNER_LABELS = {
	presidente_conselho: "Presidente do Conselho",
	mestre_conselheiro: "Mestre Conselheiro",
	escrivao: "Escrivão"
};
var MINUTE_STATUS_LABELS = {
	rascunho: "Rascunho",
	em_revisao: "Em Revisão para Aprovação",
	aprovada: "Aprovada"
};
/** Modelos de ata do capítulo (editáveis). */
var listTemplates = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("f0cb2446456d53c1fa3f904174b6bfa8fe12110147335b2a9025ce3f77d8597d"));
var saveTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	name: stringType().min(1),
	body: stringType().min(1)
}).parse(raw)).handler(createSsrRpc("a2695b328c195e866b8faee54bfc879d78ecd998c773169be4c121e45da287d6"));
/** Criar um novo modelo padrão do capítulo. */
var createTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	name: stringType().min(1),
	body: stringType().default("")
}).parse(raw)).handler(createSsrRpc("b2c7f224e27ea4978eaa33edb63fe6fb5f768e2b88c9ddbbddcd201d3208bd36"));
/** Excluir um modelo do capítulo. */
var deleteTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("c682409fa269d46f92441af9bb8afe99429e33b181424af4f3b2c9910a6cbff0"));
/** Todas as atas do capítulo, com o item de calendário vinculado e assinaturas. */
var listChapterMinutes = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ chapterId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("df27d0b30b903c051192a858cdc2c4b7059ef353398b1081cbbc797ac6c05d08"));
/** Dados para resolver as variáveis dinâmicas: capítulo + oficiais da vigência atual. */
var getMinuteContext = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	termYear: numberType().int(),
	termSemester: numberType().int().min(1).max(2)
}).parse(raw)).handler(createSsrRpc("d8766f249cfd3ddc833f3dfd0cb2be2546be263237b226b9c9654bf731421d7d"));
/** Ata + assinaturas. */
var getMinuteApprovals = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ minuteId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("9fb8e924cb7d302e5ca1e3cfb08774ade16d4a5334a0a0a46a5b58f64e750461"));
/** Concluir a ata: passa automaticamente para "Em Revisão para Aprovação". */
var submitMinute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ minuteId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("e8714a94ed77a85e8aead3e83b28d5cec9f0758fd8c25ca07b01c4007db9047b"));
/** Reabrir para correção: limpa as assinaturas e volta para rascunho. */
var reopenMinute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ minuteId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("c39e4bd10865c128aad8db7745afc7d0a6deb6ca7379eaf96ecfb453346fef3a"));
/** Assinar a ata como Presidente, Mestre Conselheiro ou Escrivão. */
var signMinute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	minuteId: stringType().uuid(),
	signerRole: enumType(SIGNER_ROLES)
}).parse(raw)).handler(createSsrRpc("2c8f34cfa11e6f8bdfb02bb1ef0e1d4820b732c16f43dbff6a81f1600b388679"));
var MESES = [
	"janeiro",
	"fevereiro",
	"março",
	"abril",
	"maio",
	"junho",
	"julho",
	"agosto",
	"setembro",
	"outubro",
	"novembro",
	"dezembro"
];
var UNIDADES = [
	"",
	"um",
	"dois",
	"três",
	"quatro",
	"cinco",
	"seis",
	"sete",
	"oito",
	"nove"
];
var DEZ_A_DEZENOVE = [
	"dez",
	"onze",
	"doze",
	"treze",
	"catorze",
	"quinze",
	"dezesseis",
	"dezessete",
	"dezoito",
	"dezenove"
];
var DEZENAS = [
	"",
	"",
	"vinte",
	"trinta",
	"quarenta",
	"cinquenta",
	"sessenta",
	"setenta",
	"oitenta",
	"noventa"
];
var CENTENAS = [
	"",
	"cento",
	"duzentos",
	"trezentos",
	"quatrocentos",
	"quinhentos",
	"seiscentos",
	"setecentos",
	"oitocentos",
	"novecentos"
];
function abaixoDeMil(n) {
	if (n === 0) return "";
	if (n === 100) return "cem";
	const c = Math.floor(n / 100);
	const resto = n % 100;
	const partes = [];
	if (c > 0) partes.push(CENTENAS[c]);
	if (resto >= 10 && resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
	else {
		const d = Math.floor(resto / 10);
		const u = resto % 10;
		if (d > 0) partes.push(DEZENAS[d]);
		if (u > 0) partes.push(UNIDADES[u]);
	}
	return partes.join(" e ");
}
/** Ano por extenso, ex.: 2026 → "dois mil e vinte e seis". */
function anoPorExtenso(ano) {
	const milhares = Math.floor(ano / 1e3);
	const resto = ano % 1e3;
	const prefixo = milhares === 1 ? "mil" : `${UNIDADES[milhares]} mil`;
	if (resto === 0) return prefixo;
	const sufixo = abaixoDeMil(resto);
	return `${prefixo}${resto < 100 || resto % 100 === 0 ? " e " : " "}${sufixo}`;
}
function buildVarMap(ctx) {
	const d = ctx.date ? new Date(ctx.date) : /* @__PURE__ */ new Date();
	const officers = ctx.officers ?? {};
	const capitulo = [ctx.chapterName, ctx.chapterCity ? `— ${ctx.chapterCity}` : null].filter(Boolean).join(" ");
	return {
		dia: String(d.getDate()).padStart(2, "0"),
		mês: MESES[d.getMonth()],
		mes: MESES[d.getMonth()],
		"ano por extenso": anoPorExtenso(d.getFullYear()),
		ano: String(d.getFullYear()),
		"nome da loja/capítulo": capitulo || "[nome da loja/capítulo]",
		local: ctx.location || "[local]",
		Local: ctx.location || "[Local]",
		endereco: ctx.address || "[endereco]",
		"endereço": ctx.address || "[endereço]",
		"endereço completo": ctx.address || ctx.location || "[endereço completo]",
		Membro_MC: officers.mestre_conselheiro ?? "[Membro_MC]",
		Membro_1C: officers.primeiro_conselheiro ?? "[Membro_1C]",
		Membro_2C: officers.segundo_conselheiro ?? "[Membro_2C]",
		Membro_Escrivao: officers.escrivao ?? "[Membro_Escrivao]",
		Membro_Tesoureiro: officers.tesoureiro ?? "[Membro_Tesoureiro]",
		Membro_Presidente: officers.presidente_conselho_consultivo ?? "[Membro_Presidente]",
		"nome do escrivão": officers.escrivao ?? "[nome do escrivão]"
	};
}
/** Substitui as variáveis conhecidas; as demais permanecem entre colchetes para preenchimento. */
function applyVars(text, ctx) {
	const map = buildVarMap(ctx);
	return text.replace(/\[([^\]\n]+)\]/g, (full, key) => {
		return map[key.trim()] ?? full;
	});
}
/** Lista de variáveis disponíveis para exibição no editor. */
var AVAILABLE_VARS = [
	"[dia]",
	"[mês]",
	"[ano por extenso]",
	"[nome da loja/capítulo]",
	"[local]",
	"[endereco]",
	"[endereço completo]",
	"[Membro_MC]",
	"[Membro_1C]",
	"[Membro_2C]",
	"[Membro_Escrivao]",
	"[Membro_Tesoureiro]",
	"[Membro_Presidente]"
];
//#endregion
export { applyVars as a, getMinuteApprovals as c, listTemplates as d, reopenMinute as f, submitMinute as h, SIGNER_ROLES as i, getMinuteContext as l, signMinute as m, MINUTE_STATUS_LABELS as n, createTemplate as o, saveTemplate as p, SIGNER_LABELS as r, deleteTemplate as s, AVAILABLE_VARS as t, listChapterMinutes as u };
