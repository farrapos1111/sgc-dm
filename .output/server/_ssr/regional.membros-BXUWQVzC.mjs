import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { _ as Search } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { a as listScopeChapters, n as ROLE_PREFIX, o as listScopeMembers, u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
import { n as ScopeGuard } from "./regional.index-CmkLbDal.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/regional.membros-BXUWQVzC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATUS_LABEL = {
	ativo: "Ativo",
	inativo: "Inativo",
	senior: "Senior",
	macom: "Maçom"
};
function RegionalMembers() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScopeGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MembersContent, {}) });
}
function MembersContent() {
	const { activeScope } = useOrgScope();
	const scope = activeScope;
	const [search, setSearch] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("all");
	const [chapterId, setChapterId] = (0, import_react.useState)(null);
	const { data: chapters } = useQuery({
		queryKey: ["scope-chapters", scope.key],
		queryFn: () => listScopeChapters({ data: {
			scopeType: scope.type,
			scopeId: scope.id
		} })
	});
	const chapterList = chapters ?? [];
	const ids = chapterId ? [chapterId] : chapterList.map((c) => c.id);
	const { data: members, isLoading } = useQuery({
		queryKey: [
			"scope-members",
			scope.key,
			ids.join(","),
			search,
			status
		],
		queryFn: () => listScopeMembers({ data: {
			chapterIds: ids,
			search,
			status
		} }),
		enabled: ids.length > 0
	});
	const rows = members ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Membros do escopo",
				subtitle: `${ROLE_PREFIX[scope.orgRole]} · ${scope.label} · somente leitura`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 rounded-[12px] p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: search,
							onChange: (e) => setSearch(e.target.value),
							placeholder: "Buscar por nome…",
							className: "pl-9"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							"all",
							"ativo",
							"senior",
							"macom",
							"inativo"
						].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: status === s ? "default" : "outline",
							className: "h-8 rounded-full text-xs",
							onClick: () => setStatus(s),
							children: s === "all" ? "Todos" : STATUS_LABEL[s]
						}, s))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: chapterId === null ? "default" : "outline",
							className: "h-8 rounded-full text-xs",
							onClick: () => setChapterId(null),
							children: "Todas as instituições"
						}), chapterList.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: chapterId === c.id ? "default" : "outline",
							className: "h-8 rounded-full text-xs",
							onClick: () => setChapterId(c.id),
							children: c.name
						}, c.id))]
					})
				]
			}),
			isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-muted-foreground",
				children: "Carregando membros…"
			}),
			!isLoading && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-8 text-center text-sm text-muted-foreground",
				children: "Nenhum membro encontrado com estes filtros."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: rows.map((m) => {
					const chapter = chapterList.find((c) => c.id === m.chapter_id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "flex items-center gap-3 rounded-[12px] p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white",
								style: { backgroundColor: chapter?.primary_color || "#9E1B32" },
								children: m.full_name.slice(0, 2).toUpperCase()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate text-sm font-medium",
									children: m.full_name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "truncate text-xs text-muted-foreground",
									children: [chapter?.name ?? "—", m.phone ? ` · ${m.phone}` : ""]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
								children: STATUS_LABEL[m.status] ?? m.status
							})
						]
					}, m.id);
				})
			}),
			rows.length >= 500 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Exibindo os primeiros 500 resultados — refine a busca."
			})
		]
	});
}
//#endregion
export { RegionalMembers as component };
