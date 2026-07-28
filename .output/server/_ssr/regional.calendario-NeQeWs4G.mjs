import { a as __toESM } from "../_runtime.mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { T as Plus } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as listCalendarItems, t as createCalendarItem } from "./calendar.functions-DtITjqb1.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { n as TYPE_META, t as CALENDAR_TYPES } from "./calendar-types-DWS_Rd7G.mjs";
import { t as Switch } from "./switch-Cn1w-cIH.mjs";
import { a as listScopeChapters, n as ROLE_PREFIX, u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
import { n as ScopeGuard } from "./regional.index-CmkLbDal.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/regional.calendario-NeQeWs4G.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RegionalCalendar() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScopeGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarContent, {}) });
}
function CalendarContent() {
	const { activeScope } = useOrgScope();
	const scope = activeScope;
	const qc = useQueryClient();
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [openNew, setOpenNew] = (0, import_react.useState)(false);
	const [types, setTypes] = (0, import_react.useState)([...CALENDAR_TYPES]);
	const { data: chapters } = useQuery({
		queryKey: ["scope-chapters", scope.key],
		queryFn: () => listScopeChapters({ data: {
			scopeType: scope.type,
			scopeId: scope.id
		} })
	});
	const chapterList = chapters ?? [];
	const chapterIds = selected ?? chapterList.map((c) => c.id);
	const { data: items, isLoading } = useQuery({
		queryKey: [
			"scope-calendar",
			scope.key,
			chapterIds.join(",")
		],
		queryFn: () => listCalendarItems({ data: {
			chapterIds,
			from: (/* @__PURE__ */ new Date()).toISOString()
		} }),
		enabled: chapterIds.length > 0
	});
	const filtered = (0, import_react.useMemo)(() => (items ?? []).filter((i) => types.includes(i.event_type)), [items, types]);
	function toggleChapter(id) {
		const base = selected ?? chapterList.map((c) => c.id);
		const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
		setSelected(next);
	}
	const create = useMutation({
		mutationFn: (payload) => createCalendarItem({ data: payload }),
		onSuccess: () => {
			toast.success("Atividade criada");
			setOpenNew(false);
			qc.invalidateQueries({ queryKey: ["scope-calendar"] });
			qc.invalidateQueries({ queryKey: ["scope-chapters"] });
		},
		onError: (e) => toast.error(e.message)
	});
	function toggleType(t) {
		setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Calendário unificado",
				subtitle: `${ROLE_PREFIX[scope.orgRole]} · ${scope.label}`,
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					disabled: chapterList.length === 0,
					onClick: () => setOpenNew(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 h-4 w-4" }), " Nova atividade"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewActivityDialog, {
				open: openNew,
				onOpenChange: setOpenNew,
				chapters: chapterList.map((c) => ({
					id: c.id,
					name: c.name
				})),
				saving: create.isPending,
				onSubmit: (payload) => create.mutate(payload)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 rounded-[12px] p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-xs font-medium text-muted-foreground",
					children: "Instituições"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: selected === null ? "default" : "outline",
						className: "h-8 rounded-full text-xs",
						onClick: () => setSelected(null),
						children: "Todas"
					}), chapterList.map((c) => {
						const on = chapterIds.includes(c.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: on ? "default" : "outline",
							className: "h-8 rounded-full text-xs",
							style: on ? { backgroundColor: c.primary_color || void 0 } : void 0,
							onClick: () => toggleChapter(c.id),
							children: c.name
						}, c.id);
					})]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-xs font-medium text-muted-foreground",
					children: "Tipos"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: CALENDAR_TYPES.map((t) => {
						const on = types.includes(t);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => toggleType(t),
							className: "min-h-[32px] rounded-full px-3 text-xs font-medium transition-opacity",
							style: {
								backgroundColor: TYPE_META[t].bg,
								color: TYPE_META[t].color,
								opacity: on ? 1 : .4
							},
							children: TYPE_META[t].label
						}, t);
					})
				})] })]
			}),
			isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-muted-foreground",
				children: "Carregando agenda…"
			}),
			!isLoading && filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-8 text-center text-sm text-muted-foreground",
				children: "Nenhuma atividade futura nas instituições selecionadas."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: filtered.map((item) => {
					const chapter = chapterList.find((c) => c.id === item.chapter_id);
					const meta = TYPE_META[item.event_type];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "rounded-[12px] p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
								style: { backgroundColor: chapter?.primary_color || meta.color }
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
										style: {
											backgroundColor: meta.bg,
											color: meta.color
										},
										children: meta.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate text-sm font-semibold",
										children: item.title
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [
										formatDateTimeBR(item.start_at),
										chapter ? ` · ${chapter.name}` : "",
										item.location ? ` · ${item.location}` : ""
									]
								})]
							})]
						})
					}, item.id);
				})
			})
		]
	});
}
function NewActivityDialog({ open, onOpenChange, chapters, saving, onSubmit }) {
	const [chapterId, setChapterId] = (0, import_react.useState)("");
	const [title, setTitle] = (0, import_react.useState)("");
	const [type, setType] = (0, import_react.useState)("evento");
	const [date, setDate] = (0, import_react.useState)("");
	const [startTime, setStartTime] = (0, import_react.useState)("13:30");
	const [endTime, setEndTime] = (0, import_react.useState)("17:00");
	const [location, setLocation] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [mandatory, setMandatory] = (0, import_react.useState)(false);
	const [publicOpen, setPublicOpen] = (0, import_react.useState)(false);
	const valid = chapterId && title.trim().length > 0 && date;
	function submit() {
		if (!valid) return;
		onSubmit({
			chapter_id: chapterId,
			title: title.trim(),
			event_type: type,
			start_at: (/* @__PURE__ */ new Date(`${date}T${startTime}:00`)).toISOString(),
			end_at: endTime ? (/* @__PURE__ */ new Date(`${date}T${endTime}:00`)).toISOString() : null,
			location: location.trim() || null,
			description: description.trim() || null,
			mandatory,
			public_open: publicOpen
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "sm:max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Nova atividade" }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Instituição" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: chapterId,
							onValueChange: setChapterId,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione a instituição" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: chapters.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: c.id,
								children: c.name
							}, c.id)) })]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "ev-title",
							children: "Título"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "ev-title",
							value: title,
							onChange: (e) => setTitle(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tipo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: type,
							onValueChange: (v) => setType(v),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: CALENDAR_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: t,
								children: TYPE_META[t].label
							}, t)) })]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "ev-date",
									children: "Data"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "ev-date",
									type: "date",
									value: date,
									onChange: (e) => setDate(e.target.value)
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "ev-start",
									children: "Início"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "ev-start",
									type: "time",
									value: startTime,
									onChange: (e) => setStartTime(e.target.value)
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "ev-end",
									children: "Término"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "ev-end",
									type: "time",
									value: endTime,
									onChange: (e) => setEndTime(e.target.value)
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "ev-loc",
							children: "Local"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "ev-loc",
							value: location,
							onChange: (e) => setLocation(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "ev-desc",
							children: "Descrição"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "ev-desc",
							value: description,
							onChange: (e) => setDescription(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: mandatory,
									onCheckedChange: setMandatory
								}), " Obrigatório"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: publicOpen,
									onCheckedChange: setPublicOpen
								}), " Aberto ao público"]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => onOpenChange(false),
					children: "Cancelar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					disabled: !valid || saving,
					onClick: submit,
					children: "Salvar"
				})] })
			]
		})
	});
}
//#endregion
export { RegionalCalendar as component };
