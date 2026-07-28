import { $ as booleanType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as createServerRpc } from "./createServerRpc-MBa5GZ-L.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { t as generateText } from "../_libs/ai.mjs";
import processModule from "node:process";
//#region node_modules/.nitro/vite/services/ssr/assets/ai.functions-BLfHhnmH.js
/** Revisa ortografia/gramática de um texto curto, preservando o conteúdo original. */
var improveText_createServerFn_handler = createServerRpc({
	id: "bff629e1118521d765dbf589d7a9ff9b3168ee53ffe69da3e7afbc1d0262626a",
	name: "improveText",
	filename: "src/lib/ai.functions.ts"
}, (opts) => improveText.__executeServer(opts));
var improveText = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	text: stringType().min(1, "Escreva algo antes de melhorar o texto").max(4e3),
	context: stringType().max(300).optional()
}).parse(raw)).handler(improveText_createServerFn_handler, async ({ data }) => {
	const key = processModule.env.LOVABLE_API_KEY;
	if (!key) throw new Error("IA indisponível: LOVABLE_API_KEY não configurada.");
	const { createLovableAiGatewayProvider } = await import("./ai-gateway.server-DVZIpGX8.mjs");
	const gateway = createLovableAiGatewayProvider(key);
	try {
		const { text } = await generateText({
			model: gateway("google/gemini-3.6-flash"),
			system: [
				"Você revisa textos em português do Brasil para um sistema de gestão de capítulos da Ordem DeMolay.",
				"Corrija ortografia, acentuação, pontuação e concordância; melhore a clareza sem mudar o sentido.",
				"Mantenha o mesmo idioma, o tom institucional e cordial, e não invente informações novas.",
				"Preserve nomes próprios, datas, horários, valores e emojis existentes.",
				"Responda APENAS com o texto revisado, sem aspas, comentários ou explicações."
			].join(" "),
			prompt: [
				data.context ? `Contexto: ${data.context}` : null,
				"Texto para revisar:",
				data.text
			].filter(Boolean).join("\n\n")
		});
		const improved = text.trim();
		if (!improved) throw new Error("A IA não retornou texto.");
		return { text: improved };
	} catch (e) {
		const msg = String(e?.message ?? "");
		if (msg.includes("429")) throw new Error("Muitas solicitações à IA. Tente novamente em instantes.");
		if (msg.includes("402")) throw new Error("Créditos de IA esgotados no workspace.");
		throw new Error(msg || "Não foi possível melhorar o texto.");
	}
});
var composeEventDescription_createServerFn_handler = createServerRpc({
	id: "b7ddb602f2454ed4746300a09101bfcfe5c9332fef9a2935120dd41457212861",
	name: "composeEventDescription",
	filename: "src/lib/ai.functions.ts"
}, (opts) => composeEventDescription.__executeServer(opts));
var composeEventDescription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	title: stringType().min(1, "Informe o título antes de usar a IA").max(200),
	eventType: stringType().max(40).optional(),
	dressCode: stringType().max(120).optional(),
	location: stringType().max(200).optional(),
	dateLabel: stringType().max(120).optional(),
	mandatory: booleanType().optional(),
	publicOpen: booleanType().optional(),
	current: stringType().max(4e3).optional()
}).parse(raw)).handler(composeEventDescription_createServerFn_handler, async ({ data }) => {
	const key = processModule.env.LOVABLE_API_KEY;
	if (!key) throw new Error("IA indisponível: LOVABLE_API_KEY não configurada.");
	const { createLovableAiGatewayProvider } = await import("./ai-gateway.server-DVZIpGX8.mjs");
	const gateway = createLovableAiGatewayProvider(key);
	const has = Boolean(data.current?.trim());
	const facts = [
		`Título: ${data.title}`,
		data.eventType ? `Tipo de atividade: ${data.eventType}` : null,
		data.dateLabel ? `Data e horário: ${data.dateLabel}` : null,
		data.location ? `Local: ${data.location}` : null,
		data.dressCode ? `Traje: ${data.dressCode}` : null,
		data.mandatory === true ? "Presença obrigatória para os membros." : null,
		data.publicOpen === true ? "Atividade aberta ao público (convidados e familiares)." : null
	].filter(Boolean).join("\n");
	try {
		const { text } = await generateText({
			model: gateway("google/gemini-3.6-flash"),
			system: [
				"Você escreve descrições de atividades para um capítulo da Ordem DeMolay, em português do Brasil.",
				"Tom formal, institucional e cordial, adequado à rotina de um capítulo DeMolay.",
				"Seja claro, objetivo e sem redundância: no máximo 2 parágrafos curtos (até ~90 palavras no total).",
				"Nunca invente datas, horários, locais, valores ou nomes que não tenham sido informados.",
				"Responda APENAS com a descrição final, sem títulos, aspas, marcadores ou comentários."
			].join(" "),
			prompt: has ? [
				"Dados da atividade:",
				facts,
				"",
				"Texto atual escrito pelo usuário (preserve o sentido, corrija e complemente):",
				data.current.trim()
			].join("\n") : ["Gere a descrição da atividade a partir dos dados abaixo:", facts].join("\n")
		});
		const out = text.trim();
		if (!out) throw new Error("A IA não retornou texto.");
		return { text: out };
	} catch (e) {
		const msg = String(e?.message ?? "");
		if (msg.includes("429")) throw new Error("Muitas solicitações à IA. Tente novamente em instantes.");
		if (msg.includes("402")) throw new Error("Créditos de IA esgotados no workspace.");
		throw new Error(msg || "Não foi possível gerar a descrição.");
	}
});
//#endregion
export { composeEventDescription_createServerFn_handler, improveText_createServerFn_handler };
