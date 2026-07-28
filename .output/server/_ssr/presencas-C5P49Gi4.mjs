import { a as __toESM } from "../_runtime.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { n as queryOptions, r as useSuspenseQuery } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { nt as ClipboardList } from "../_libs/lucide-react.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CCJRliUM.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as canManageAttendance } from "./permissions-CaTke9AP.mjs";
import { n as TYPE_META, t as CALENDAR_TYPES } from "./calendar-types-DWS_Rd7G.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as attendanceOverviewKey } from "./query-keys-Cpoprrf-.mjs";
import { r as listAttendanceOverview } from "./attendance.functions-B5vlRrhX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/presencas-C5P49Gi4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var overviewQO = (chapterId) => queryOptions({
	queryKey: attendanceOverviewKey(chapterId),
	queryFn: () => listAttendanceOverview({ data: { chapterId } })
});
function PresencasFrequencyTab({ items, members, records }) {
	const frequency = (0, import_react.useMemo)(() => {
		const mandatoryIds = new Set(items.filter((i) => i.mandatory).map((i) => i.id));
		const tallies = /* @__PURE__ */ new Map();
		for (const r of records) {
			if (!mandatoryIds.has(r.calendar_event_id)) continue;
			const t = tallies.get(r.member_id) ?? {
				total: 0,
				present: 0
			};
			t.total += 1;
			if (r.status === "presente") t.present += 1;
			tallies.set(r.member_id, t);
		}
		return members.filter((m) => m.status === "ativo").map((m) => {
			const t = tallies.get(m.id) ?? {
				total: 0,
				present: 0
			};
			return {
				...m,
				total: t.total,
				present: t.present,
				pct: t.total > 0 ? Math.round(t.present / t.total * 100) : null
			};
		});
	}, [
		items,
		members,
		records
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "rounded-[12px] p-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "divide-y divide-border",
			children: [frequency.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "p-5 text-sm text-muted-foreground",
				children: "Nenhum membro ativo."
			}), frequency.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between gap-3 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/membros/$id",
					params: { id: m.id },
					className: "min-w-0 truncate text-sm font-medium",
					children: m.full_name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [
							m.present,
							"/",
							m.total,
							" obrigatórios"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-semibold",
						style: { color: m.pct === null ? "var(--muted-foreground)" : m.pct >= 75 ? "#047857" : "#B91C1C" },
						children: m.pct === null ? "—" : `${m.pct}%`
					})]
				})]
			}, m.id))]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-3 text-xs text-muted-foreground",
		children: "A frequência considera apenas itens marcados como obrigatórios."
	})] });
}
function PresencasPage() {
	const { active } = useActiveChapter();
	const { data } = useSuspenseQuery(overviewQO(active?.chapter_id ?? ""));
	const [typeFilter, setTypeFilter] = (0, import_react.useState)("all");
	const [mandFilter, setMandFilter] = (0, import_react.useState)("all");
	const [tab, setTab] = (0, import_react.useState)("itens");
	const allowed = canManageAttendance(active?.role.name);
	const items = (0, import_react.useMemo)(() => data.items.filter((it) => {
		if (typeFilter !== "all" && it.event_type !== typeFilter) return false;
		if (mandFilter === "obrigatorio" && !it.mandatory) return false;
		if (mandFilter === "facultativo" && it.mandatory) return false;
		return true;
	}), [
		data.items,
		typeFilter,
		mandFilter
	]);
	const byEvent = (0, import_react.useMemo)(() => {
		const m = /* @__PURE__ */ new Map();
		for (const r of data.records) {
			const arr = m.get(r.calendar_event_id) ?? [];
			arr.push(r);
			m.set(r.calendar_event_id, arr);
		}
		return m;
	}, [data.records]);
	if (!allowed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "rounded-[12px] p-6 text-sm text-muted-foreground",
		children: "Módulo disponível apenas para administradores e Escrivão."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Presenças",
			subtitle: "Histórico de chamadas, justificativas e frequência do capítulo."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-wrap gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: typeFilter,
				onValueChange: setTypeFilter,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "h-9 w-[190px] text-xs",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Tipo" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: "all",
					children: "Todos os tipos"
				}), CALENDAR_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: t,
					children: TYPE_META[t].label
				}, t))] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: mandFilter,
				onValueChange: setMandFilter,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "h-9 w-[190px] text-xs",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Obrigatoriedade" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "all",
						children: "Obrigatórios e facultativos"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "obrigatorio",
						children: "Somente obrigatórios"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "facultativo",
						children: "Somente facultativos"
					})
				] })]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
			value: tab,
			onValueChange: setTab,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
					className: "mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "itens",
						children: "Chamadas"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "frequencia",
						children: "Frequência"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "itens",
					children: items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "rounded-[12px] p-10 text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardList, { className: "mx-auto mb-3 h-10 w-10 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium",
							children: "Nenhuma chamada registrada ainda."
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "rounded-[12px] p-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "divide-y divide-border",
							children: items.map((it) => {
								const recs = byEvent.get(it.id) ?? [];
								const p = recs.filter((r) => r.status === "presente").length;
								const a = recs.filter((r) => r.status === "ausente").length;
								const j = recs.filter((r) => r.justification).length;
								const meta = TYPE_META[it.event_type];
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/ongoing/$id",
									params: { id: it.id },
									className: "block p-4 hover:bg-muted",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm font-medium",
												children: it.title
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
												style: {
													backgroundColor: meta?.bg,
													color: meta?.color
												},
												children: meta?.label ?? it.event_type
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												variant: it.mandatory ? "default" : "secondary",
												children: it.mandatory ? "Obrigatório" : "Facultativo"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 text-xs text-muted-foreground",
										children: [
											formatDateTimeBR(it.start_at),
											" · ",
											p,
											" presentes · ",
											a,
											" ausentes · ",
											j,
											" justificativas"
										]
									})]
								}) }, it.id);
							})
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "frequencia",
					children: tab === "frequencia" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresencasFrequencyTab, {
						items: data.items,
						members: data.members,
						records: data.records
					})
				})
			]
		})
	] });
}
//#endregion
export { PresencasPage as component };
