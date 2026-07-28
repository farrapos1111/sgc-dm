//#region node_modules/.nitro/vite/services/ssr/assets/chave-do-dia-DmSt55yO.js
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
var DIAS = [
	"domingo",
	"segunda-feira",
	"terça-feira",
	"quarta-feira",
	"quinta-feira",
	"sexta-feira",
	"sábado"
];
function pad(n) {
	return String(n).padStart(2, "0");
}
function dateBR(d) {
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function timeBR(d) {
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Modelo padrão da chave do dia (usa variáveis dinâmicas entre colchetes). */
var DEFAULT_CHAVE_TEMPLATE = `🔺🗝️ CHAVE DIA [data]🗝️🔺

—————🕯️🕯️🕯️🕯️🕯️🕯️🕯️—————

Neste [dia_semana], dia [dia] de [mes] de [ano], teremos a pauta [titulo].

[descricao]

📆 Data: [data]
📍 Local: [local]
🕴️ Traje: [traje]
📍 Pauta: [titulo]
⏰ Horário de Chegada: [hora_inicio]
⏰ Horário Previsto de Encerramento: [hora_fim]

Presença obrigatória de todos os demolays ativos.

Para quaisquer dúvidas, estamos à disposição! Fiquem todos com o Pai Celestial! 🔺⚔️`;
/** Variáveis disponíveis no editor do modelo. */
var CHAVE_VARIABLES = [
	{
		key: "titulo",
		label: "Título / pauta"
	},
	{
		key: "descricao",
		label: "Descrição"
	},
	{
		key: "data",
		label: "Data (dd/mm/aaaa)"
	},
	{
		key: "dia_semana",
		label: "Dia da semana"
	},
	{
		key: "dia",
		label: "Dia"
	},
	{
		key: "mes",
		label: "Mês por extenso"
	},
	{
		key: "ano",
		label: "Ano"
	},
	{
		key: "local",
		label: "Local"
	},
	{
		key: "endereco",
		label: "Endereço"
	},
	{
		key: "local_completo",
		label: "Local + endereço"
	},
	{
		key: "traje",
		label: "Traje"
	},
	{
		key: "hora_inicio",
		label: "Hora de início"
	},
	{
		key: "hora_fim",
		label: "Hora de término"
	},
	{
		key: "capitulo",
		label: "Nome do capítulo"
	}
];
function chaveValues(item, opts) {
	const start = new Date(item.start_at);
	const end = item.end_at ? new Date(item.end_at) : null;
	const local = (item.location ?? "").trim();
	const endereco = (item.address ?? "").trim();
	return {
		titulo: item.title,
		descricao: (item.description ?? "").trim(),
		data: dateBR(start),
		dia_semana: DIAS[start.getDay()],
		dia: String(start.getDate()),
		mes: MESES[start.getMonth()],
		ano: String(start.getFullYear()),
		local: local || "A definir",
		endereco: endereco || "A definir",
		local_completo: [local, endereco].filter(Boolean).join(" — ") || "A definir",
		traje: (item.dress_code ?? "").trim() || "A definir",
		hora_inicio: timeBR(start),
		hora_fim: end ? timeBR(end) : "A definir",
		capitulo: (opts?.chapterName ?? "").trim()
	};
}
/** Aplica as variáveis no modelo, removendo linhas que ficaram vazias por variável sem valor. */
function renderChaveTemplate(template, values) {
	const lines = template.split("\n");
	const out = [];
	for (const line of lines) {
		const usedKeys = [...line.matchAll(/\[([a-z_]+)\]/gi)].map((m) => m[1].toLowerCase());
		const rendered = line.replace(/\[([a-z_]+)\]/gi, (full, key) => {
			const v = values[key.toLowerCase()];
			return v === void 0 ? full : v;
		});
		if (usedKeys.length > 0 && line.replace(/\[[a-z_]+\]/gi, "").trim() === "" && rendered.trim() === "") continue;
		out.push(rendered);
	}
	return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
/** Monta o texto da "chave do dia" pronto para copiar. */
function buildChaveDoDia(item, opts) {
	return renderChaveTemplate((opts?.template ?? "").trim() || DEFAULT_CHAVE_TEMPLATE, chaveValues(item, { chapterName: opts?.chapterName }));
}
/** Exemplo usado na pré-visualização do editor de modelo. */
function chavePreviewItem() {
	const start = /* @__PURE__ */ new Date();
	start.setHours(13, 30, 0, 0);
	const end = new Date(start);
	end.setHours(17, 0, 0, 0);
	return {
		title: "Sessão Ordinária do Grau DeMolay",
		description: "Traga seu manual e chegue com 15 minutos de antecedência.",
		start_at: start.toISOString(),
		end_at: end.toISOString(),
		location: "Loja Exemplo",
		address: "Rua das Acácias, 100 — Centro",
		dress_code: "Traje social completo"
	};
}
//#endregion
export { chaveValues as a, chavePreviewItem as i, DEFAULT_CHAVE_TEMPLATE as n, renderChaveTemplate as o, buildChaveDoDia as r, CHAVE_VARIABLES as t };
