//#region node_modules/.nitro/vite/services/ssr/assets/calendar-types-DWS_Rd7G.js
var TYPE_META = {
	sessao_ritualistica: {
		label: "Sessão Ritualística",
		color: "#1D4ED8",
		bg: "#DBEAFE"
	},
	sessao_administrativa: {
		label: "Sessão Administrativa",
		color: "#0E7490",
		bg: "#CFFAFE"
	},
	evento: {
		label: "Evento",
		color: "#9E1B32",
		bg: "#FCE7EC"
	},
	filantropia: {
		label: "Filantropia",
		color: "#047857",
		bg: "#D1FAE5"
	},
	entretenimento: {
		label: "Entretenimento",
		color: "#B45309",
		bg: "#FEF3C7"
	}
};
var CALENDAR_TYPES = Object.keys(TYPE_META);
/** Tipos que representam sessões do capítulo. */
var SESSION_TYPES = ["sessao_ritualistica", "sessao_administrativa"];
function isSessionType(t) {
	return SESSION_TYPES.includes(t);
}
//#endregion
export { TYPE_META as n, isSessionType as r, CALENDAR_TYPES as t };
