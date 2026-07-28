import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { at as CircleAlert, ft as CalendarDays, i as Users, mt as Building2 } from "../_libs/lucide-react.mjs";
import { n as TYPE_META } from "./calendar-types-DWS_Rd7G.mjs";
import { a as listScopeChapters, n as ROLE_PREFIX, u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/regional.index-0Eno7BFo.js
var import_jsx_runtime = require_jsx_runtime();
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
function RegionalPanorama() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScopeGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanoramaContent, {}) });
}
function PanoramaContent() {
	const { activeScope } = useOrgScope();
	const scope = activeScope;
	const { data, isLoading } = useQuery({
		queryKey: ["scope-chapters", scope.key],
		queryFn: () => listScopeChapters({ data: {
			scopeType: scope.type,
			scopeId: scope.id
		} })
	});
	const chapters = data ?? [];
	const totalActive = chapters.reduce((s, c) => s + c.active_members, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Panorama",
				subtitle: `${ROLE_PREFIX[scope.orgRole]} · ${scope.label}`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
						icon: Building2,
						label: "Instituições",
						value: String(chapters.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
						icon: Users,
						label: "Membros ativos",
						value: String(totalActive)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
						icon: CalendarDays,
						label: "Com atividade agendada",
						value: String(chapters.filter((c) => c.next_item).length)
					})
				]
			}),
			isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-muted-foreground",
				children: "Carregando instituições…"
			}),
			!isLoading && chapters.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-8 text-center text-sm text-muted-foreground",
				children: "Nenhuma instituição vinculada a este escopo ainda."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-2",
				children: chapters.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "rounded-[12px] p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-xs font-bold text-white",
							style: { backgroundColor: c.primary_color || "#9E1B32" },
							children: c.number.slice(-3)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate text-sm font-semibold",
										children: c.name
									}), !c.active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground",
										children: "Inativo"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs text-muted-foreground",
									children: [
										"Nº ",
										c.number,
										c.city ? ` · ${c.city}` : "",
										c.region_name ? ` · ${c.region_name}` : ""
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium",
											children: c.active_members
										}),
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted-foreground",
											children: ["membros ativos de ", c.total_members]
										})
									]
								}),
								c.next_item ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex items-center gap-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
											style: {
												backgroundColor: TYPE_META[c.next_item.event_type].bg,
												color: TYPE_META[c.next_item.event_type].color
											},
											children: TYPE_META[c.next_item.event_type].label
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate",
											children: c.next_item.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "shrink-0 text-muted-foreground",
											children: formatDateTimeBR(c.next_item.start_at)
										})
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 text-xs text-muted-foreground",
									children: "Nenhuma atividade agendada"
								})
							]
						})]
					})
				}, c.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/regional/calendario",
					className: "rounded-[8px] border border-border px-3 py-2 hover:bg-muted",
					children: "Ver calendário unificado"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/regional/membros",
					className: "rounded-[8px] border border-border px-3 py-2 hover:bg-muted",
					children: "Buscar membros do escopo"
				})]
			})
		]
	});
}
function MetricCard({ icon: Icon, label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" }), label]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-1 text-2xl font-semibold",
			children: value
		})]
	});
}
//#endregion
export { ScopeGuard, RegionalPanorama as component };
