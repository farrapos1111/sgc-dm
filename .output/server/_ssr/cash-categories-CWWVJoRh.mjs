//#region node_modules/.nitro/vite/services/ssr/assets/cash-categories-CWWVJoRh.js
/** Categorias fixas do fluxo de caixa e escopos com subcategorias dinâmicas. */
var FIXED_CATEGORIES = [
	"Eventos",
	"Hospitalaria",
	"Mensalidades",
	"SCDB / GCE",
	"Entretenimento",
	"Outras"
];
var DYNAMIC_CATEGORIES = {
	Eventos: "eventos",
	Hospitalaria: "hospitalaria"
};
function scopeOfCategory(category) {
	return DYNAMIC_CATEGORIES[category] ?? null;
}
var MONTH_NAMES = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro"
];
function competenceLabel(year, month) {
	return `${MONTH_NAMES[month - 1]}/${year}`;
}
/** Descrição padronizada de mensalidade, inclusive em lançamentos manuais. */
function duesDescription(memberName, competences) {
	return `Mensalidade - ${memberName} - ${competences.map((c) => competenceLabel(c.year, c.month)).join(", ")}`;
}
//#endregion
export { scopeOfCategory as i, competenceLabel as n, duesDescription as r, FIXED_CATEGORIES as t };
