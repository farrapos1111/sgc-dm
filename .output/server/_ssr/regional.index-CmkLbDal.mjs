import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { at as CircleAlert } from "../_libs/lucide-react.mjs";
import { u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/regional.index-CmkLbDal.js
var import_jsx_runtime = require_jsx_runtime();
var $$splitComponentImporter = () => import("./regional.index-0Eno7BFo.mjs");
var Route = createFileRoute("/_authenticated/_shell/regional/")({
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	head: () => ({ meta: [
		{ title: "Panorama regional | SG-CDM" },
		{
			name: "description",
			content: "Panorama das instituições da região ou do estado: membros ativos e próximas atividades."
		},
		{
			property: "og:title",
			content: "Panorama regional | SG-CDM"
		},
		{
			property: "og:description",
			content: "Acompanhe as instituições do seu escopo em um só lugar."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] })
});
function ScopeGuard({ children }) {
	const { activeScope, loading } = useOrgScope();
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "text-sm text-muted-foreground",
		children: "Carregando…"
	});
	if (!activeScope) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex items-center gap-3 rounded-[12px] p-5 text-sm text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-4 w-4" }), "Selecione um escopo regional ou estadual no seletor acima."]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
//#endregion
export { ScopeGuard as n, Route as t };
