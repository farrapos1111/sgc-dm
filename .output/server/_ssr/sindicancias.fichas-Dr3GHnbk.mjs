import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sindicancias.fichas-Dr3GHnbk.js
var $$splitComponentImporter = () => import("./sindicancias.fichas-CLNZ1WyQ.mjs");
var Route = createFileRoute("/_authenticated/_shell/sindicancias/fichas")({
	head: () => ({ meta: [{ title: "Fichas de Sindicância — SG-CDM" }, {
		name: "description",
		content: "Fichas de candidatos em sindicância."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var STATUS_LABELS = {
	aberta: "Aberta",
	em_andamento: "Em andamento",
	aprovada: "Aprovada",
	reprovada: "Reprovada",
	arquivada: "Arquivada"
};
//#endregion
export { STATUS_LABELS as n, Route as t };
