import { a as __toESM } from "../_runtime.mjs";
import { $ as booleanType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as Trigger2, i as Root2, n as Header, r as Item, t as Content2, v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { $ as Download, E as Pencil, F as List, L as Link$1, P as LoaderCircle, R as LayoutGrid, X as ExternalLink, ct as ChevronLeft, et as Copy, f as Sparkles, ft as CalendarDays, j as MapPin, l as Trash2, lt as ChevronDown, rt as CirclePlus, st as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as updateCalendarItem, n as deleteCalendarItem, r as listCalendarItems, t as createCalendarItem } from "./calendar.functions-DtITjqb1.mjs";
import { n as listLodges } from "./chapter.functions-DdatMChF.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, s as DialogTrigger, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { r as buildChaveDoDia } from "./chave-do-dia-DmSt55yO.mjs";
import { n as TYPE_META, r as isSessionType, t as CALENDAR_TYPES } from "./calendar-types-DWS_Rd7G.mjs";
import { t as Switch } from "./switch-Cn1w-cIH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendario-DMNdC_SU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	text: stringType().min(1, "Escreva algo antes de melhorar o texto").max(4e3),
	context: stringType().max(300).optional()
}).parse(raw)).handler(createSsrRpc("bff629e1118521d765dbf589d7a9ff9b3168ee53ffe69da3e7afbc1d0262626a"));
/** Gera ou complementa a descrição de um item de calendário DeMolay. */
var composeEventDescription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	title: stringType().min(1, "Informe o título antes de usar a IA").max(200),
	eventType: stringType().max(40).optional(),
	dressCode: stringType().max(120).optional(),
	location: stringType().max(200).optional(),
	dateLabel: stringType().max(120).optional(),
	mandatory: booleanType().optional(),
	publicOpen: booleanType().optional(),
	current: stringType().max(4e3).optional()
}).parse(raw)).handler(createSsrRpc("b7ddb602f2454ed4746300a09101bfcfe5c9332fef9a2935120dd41457212861"));
function pad(n) {
	return String(n).padStart(2, "0");
}
/** UTC no formato compacto exigido pelo iCalendar/Google. */
function toUtcStamp(iso) {
	const d = new Date(iso);
	return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function endOrDefault(item) {
	if (item.end_at) return item.end_at;
	const d = new Date(item.start_at);
	d.setHours(d.getHours() + 3);
	return d.toISOString();
}
function fullLocation(item) {
	return [item.location, item.address].filter(Boolean).join(" — ");
}
function escapeIcs(v) {
	return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
/** Gera um arquivo .ics compatível com Google Agenda, Apple, Outlook e Teams. */
function buildIcs(items, calendarName = "SG-CDM") {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//SG-CDM//Calendario//PT-BR",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeIcs(calendarName)}`
	];
	for (const it of items) {
		lines.push("BEGIN:VEVENT", `UID:${it.id}@sg-cdm`, `DTSTAMP:${toUtcStamp((/* @__PURE__ */ new Date()).toISOString())}`, `DTSTART:${toUtcStamp(it.start_at)}`, `DTEND:${toUtcStamp(endOrDefault(it))}`, `SUMMARY:${escapeIcs(it.title)}`);
		const loc = fullLocation(it);
		if (loc) lines.push(`LOCATION:${escapeIcs(loc)}`);
		if (it.description) lines.push(`DESCRIPTION:${escapeIcs(it.description)}`);
		lines.push("END:VEVENT");
	}
	lines.push("END:VCALENDAR");
	return lines.join("\r\n");
}
function downloadIcs(items, filename, calendarName) {
	const blob = new Blob([buildIcs(items, calendarName)], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
function googleCalendarUrl(item) {
	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: item.title,
		dates: `${toUtcStamp(item.start_at)}/${toUtcStamp(endOrDefault(item))}`
	});
	const loc = fullLocation(item);
	if (loc) params.set("location", loc);
	if (item.description) params.set("details", item.description);
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function outlookCalendarUrl(item) {
	const params = new URLSearchParams({
		path: "/calendar/action/compose",
		rru: "addevent",
		subject: item.title,
		startdt: new Date(item.start_at).toISOString(),
		enddt: new Date(endOrDefault(item)).toISOString()
	});
	const loc = fullLocation(item);
	if (loc) params.set("location", loc);
	if (item.description) params.set("body", item.description);
	return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
var Accordion = Root2;
var AccordionItem = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
	ref,
	className: cn("border-b", className),
	...props
}));
AccordionItem.displayName = "AccordionItem";
var AccordionTrigger = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
	className: "flex",
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Trigger2, {
		ref,
		className: cn("flex flex-1 items-center justify-between py-4 text-sm font-medium cursor-pointer transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" })]
	})
}));
AccordionTrigger.displayName = Trigger2.displayName;
var AccordionContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: "overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("pb-4 pt-0", className),
		children
	})
}));
AccordionContent.displayName = Content2.displayName;
var MOBILE_BREAKPOINT = 768;
function useIsMobile() {
	const [isMobile, setIsMobile] = import_react.useState(void 0);
	import_react.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};
		mql.addEventListener("change", onChange);
		setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		return () => mql.removeEventListener("change", onChange);
	}, []);
	return !!isMobile;
}
var ADMIN_ROLES = /* @__PURE__ */ new Set([
	"mestre_conselheiro",
	"escrivao",
	"admin_total",
	"consultor",
	"presidente_conselho"
]);
var itemsQO = (chapterIds) => queryOptions({
	queryKey: ["calendar", chapterIds.join(",")],
	queryFn: () => listCalendarItems({ data: { chapterIds } }),
	enabled: chapterIds.length > 0
});
function toLocalDateKey(iso) {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Todas as datas (chaves locais) cobertas pelo item — itens que viram o dia aparecem em ambas. */
function itemDayKeys(it) {
	const start = new Date(it.start_at);
	const end = it.end_at ? new Date(it.end_at) : start;
	const keys = [];
	const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	while (cur <= last && keys.length < 60) {
		keys.push(toLocalDateKey(cur.toISOString()));
		cur.setDate(cur.getDate() + 1);
	}
	return keys.length ? keys : [toLocalDateKey(it.start_at)];
}
function occursOnDay(it, key) {
	return itemDayKeys(it).includes(key);
}
function CalendarioPage() {
	const { active, memberships } = useActiveChapter();
	const isMobile = useIsMobile();
	const qc = useQueryClient();
	const [view, setView] = (0, import_react.useState)(isMobile ? "agenda" : "mes");
	const [typeFilters, setTypeFilters] = (0, import_react.useState)(new Set(CALENDAR_TYPES));
	const [chapterFilter, setChapterFilter] = (0, import_react.useState)("all");
	const [cursor, setCursor] = (0, import_react.useState)(() => {
		const d = /* @__PURE__ */ new Date();
		d.setDate(1);
		d.setHours(0, 0, 0, 0);
		return d;
	});
	const [selectedDay, setSelectedDay] = (0, import_react.useState)(null);
	const [detail, setDetail] = (0, import_react.useState)(null);
	const [editItem, setEditItem] = (0, import_react.useState)(null);
	const [createOpen, setCreateOpen] = (0, import_react.useState)(false);
	const [createDate, setCreateDate] = (0, import_react.useState)(null);
	const { data: items } = useSuspenseQuery(itemsQO((0, import_react.useMemo)(() => memberships.map((m) => m.chapter_id), [memberships])));
	const canCreate = active ? ADMIN_ROLES.has(active.role.name) : false;
	const filtered = (0, import_react.useMemo)(() => {
		return items.filter((it) => {
			if (!typeFilters.has(it.event_type)) return false;
			if (chapterFilter !== "all" && it.chapter_id !== chapterFilter) return false;
			return true;
		});
	}, [
		items,
		typeFilters,
		chapterFilter
	]);
	const chapterNameMap = (0, import_react.useMemo)(() => {
		const m = /* @__PURE__ */ new Map();
		for (const mem of memberships) m.set(mem.chapter_id, `${mem.chapter.name} · Nº ${mem.chapter.number}`);
		return m;
	}, [memberships]);
	function toggleType(t) {
		setTypeFilters((prev) => {
			const next = new Set(prev);
			if (next.has(t)) next.delete(t);
			else next.add(t);
			return next;
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Calendário",
			subtitle: "Sessões, eventos e ações de filantropia em uma visão única.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex w-full flex-wrap items-center gap-2 sm:w-auto",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "inline-flex rounded-[8px] border border-border p-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setView("mes"),
							className: "flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium",
							style: view === "mes" ? {
								backgroundColor: "var(--chapter-primary)",
								color: "#fff"
							} : { color: "var(--muted-foreground)" },
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGrid, { className: "h-3.5 w-3.5" }), " Mês"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setView("agenda"),
							className: "flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium",
							style: view === "agenda" ? {
								backgroundColor: "var(--chapter-primary)",
								color: "#fff"
							} : { color: "var(--muted-foreground)" },
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { className: "h-3.5 w-3.5" }), " Agenda"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						size: "sm",
						className: "h-9",
						onClick: () => downloadIcs(filtered, `calendario-sgcdm`, "SG-CDM · Calendário"),
						title: "Baixar .ics para Google Agenda, Apple, Outlook ou Teams",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-4 w-4 sm:mr-2" }),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Exportar"
							})
						]
					}),
					canCreate && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
						open: createOpen,
						onOpenChange: (o) => {
							setCreateOpen(o);
							if (!o) setCreateDate(null);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								className: "h-9",
								style: { backgroundColor: "var(--chapter-primary)" },
								onClick: () => setCreateDate(null),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Novo"]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateDialog, {
							chapterId: active?.chapter_id ?? "",
							chapterName: active ? `${active.chapter.name} · Nº ${active.chapter.number}` : "",
							defaultDate: createDate,
							onClose: () => setCreateOpen(false),
							onCreated: () => {
								setCreateOpen(false);
								setCreateDate(null);
								qc.invalidateQueries({ queryKey: ["calendar"] });
							}
						}, createDate ?? "novo")]
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-wrap items-center gap-2",
			children: [CALENDAR_TYPES.map((t) => {
				const meta = TYPE_META[t];
				const on = typeFilters.has(t);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => toggleType(t),
					className: "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
					style: {
						backgroundColor: on ? meta.bg : "transparent",
						color: on ? meta.color : "var(--muted-foreground)",
						borderColor: on ? meta.color : "var(--border)"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "h-2 w-2 rounded-full",
						style: { backgroundColor: meta.color }
					}), meta.label]
				}, t);
			}), memberships.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-full sm:ml-auto sm:w-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: chapterFilter,
					onValueChange: setChapterFilter,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "h-9 w-full text-xs sm:w-[220px]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Capítulo" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "all",
						children: "Todos os capítulos"
					}), memberships.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
						value: m.chapter_id,
						children: [
							m.chapter.name,
							" · Nº ",
							m.chapter.number
						]
					}, m.chapter_id))] })]
				})
			})]
		}),
		view === "mes" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonthView, {
			cursor,
			setCursor,
			items: filtered,
			onDayClick: (key) => {
				const hasItems = filtered.some((it) => occursOnDay(it, key));
				if (canCreate && !hasItems) {
					setCreateDate(key);
					setCreateOpen(true);
					return;
				}
				setSelectedDay(key);
			}
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgendaView, {
			items: filtered,
			onSelect: setDetail,
			chapterNameMap,
			showChapter: memberships.length > 1
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!selectedDay,
			onOpenChange: (o) => !o && setSelectedDay(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: selectedDay && (/* @__PURE__ */ new Date(selectedDay + "T00:00:00")).toLocaleDateString("pt-BR", {
					weekday: "long",
					day: "2-digit",
					month: "long",
					year: "numeric"
				}) }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "space-y-2",
					children: [selectedDay && filtered.filter((it) => occursOnDay(it, selectedDay)).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted-foreground",
						children: "Nenhum item neste dia."
					}), selectedDay && filtered.filter((it) => occursOnDay(it, selectedDay)).sort((a, b) => a.start_at.localeCompare(b.start_at)).map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "w-full rounded-[8px] border border-border p-3 text-left hover:bg-muted",
						onClick: () => {
							setDetail(it);
							setSelectedDay(null);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemRow, {
							item: it,
							chapterName: chapterNameMap.get(it.chapter_id),
							showChapter: memberships.length > 1
						})
					}) }, it.id))]
				}),
				canCreate && selectedDay && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "w-full sm:w-auto",
					style: { backgroundColor: "var(--chapter-primary)" },
					onClick: () => {
						setCreateDate(selectedDay);
						setSelectedDay(null);
						setCreateOpen(true);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Adicionar neste dia"]
				}) })
			] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!detail,
			onOpenChange: (o) => !o && setDetail(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, { children: detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailContent, {
				item: detail,
				chapterName: chapterNameMap.get(detail.chapter_id),
				showChapter: memberships.length > 1,
				canDelete: canCreate && detail.chapter_id === active?.chapter_id,
				onEdit: () => {
					setEditItem(detail);
					setDetail(null);
				},
				onDeleted: () => {
					setDetail(null);
					qc.invalidateQueries({ queryKey: ["calendar"] });
				}
			}) })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!editItem,
			onOpenChange: (o) => !o && setEditItem(null),
			children: editItem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateDialog, {
				item: editItem,
				chapterId: editItem.chapter_id,
				chapterName: chapterNameMap.get(editItem.chapter_id) ?? "",
				onClose: () => setEditItem(null),
				onCreated: () => {
					setEditItem(null);
					qc.invalidateQueries({ queryKey: ["calendar"] });
				}
			}, editItem.id)
		})
	] });
}
function MonthView({ cursor, setCursor, items, onDayClick }) {
	const year = cursor.getFullYear();
	const month = cursor.getMonth();
	const startWeekday = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
	const byDay = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const it of items) for (const key of itemDayKeys(it)) {
			const arr = map.get(key) ?? [];
			arr.push(it);
			map.set(key, arr);
		}
		return map;
	}, [items]);
	const monthLabel = cursor.toLocaleDateString("pt-BR", {
		month: "long",
		year: "numeric"
	});
	const todayKey = toLocalDateKey((/* @__PURE__ */ new Date()).toISOString());
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-semibold capitalize",
					children: monthLabel
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "icon",
							variant: "ghost",
							onClick: () => setCursor(new Date(year, month - 1, 1)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => {
								const d = /* @__PURE__ */ new Date();
								d.setDate(1);
								d.setHours(0, 0, 0, 0);
								setCursor(d);
							},
							children: "Hoje"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "icon",
							variant: "ghost",
							onClick: () => setCursor(new Date(year, month + 1, 1)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground",
				children: [
					"Dom",
					"Seg",
					"Ter",
					"Qua",
					"Qui",
					"Sex",
					"Sáb"
				].map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "py-1",
					children: d
				}, d))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 gap-1",
				children: Array.from({ length: totalCells }).map((_, idx) => {
					const dayNum = idx - startWeekday + 1;
					if (!(dayNum >= 1 && dayNum <= daysInMonth)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "min-h-[64px] rounded-[6px] bg-transparent lg:min-h-[96px]" }, idx);
					const key = toLocalDateKey(new Date(year, month, dayNum).toISOString());
					const dayItems = byDay.get(key) ?? [];
					const isToday = key === todayKey;
					const visible = dayItems.slice(0, 3);
					const extra = dayItems.length - visible.length;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => onDayClick(key),
						className: "flex min-h-[64px] flex-col rounded-[6px] border border-border p-1 text-left transition-colors hover:bg-muted lg:min-h-[96px]",
						style: isToday ? { borderColor: "var(--chapter-primary)" } : void 0,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-1 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold",
								style: isToday ? { color: "var(--chapter-primary)" } : void 0,
								children: dayNum
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-0.5 lg:hidden",
								children: Array.from(new Set(dayItems.map((i) => i.event_type))).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "h-1.5 w-1.5 rounded-full",
									style: { backgroundColor: TYPE_META[t].color }
								}, t))
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden flex-col gap-0.5 lg:flex",
							children: [visible.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "truncate rounded px-1 py-0.5 text-[10px]",
								style: {
									backgroundColor: TYPE_META[it.event_type].bg,
									color: TYPE_META[it.event_type].color
								},
								children: [
									new Date(it.start_at).toLocaleTimeString("pt-BR", {
										hour: "2-digit",
										minute: "2-digit"
									}),
									" ",
									it.title
								]
							}, it.id)), extra > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] text-muted-foreground",
								children: [
									"+",
									extra,
									" mais"
								]
							})]
						})]
					}, idx);
				})
			})
		]
	});
}
function AgendaView({ items, onSelect, chapterNameMap, showChapter }) {
	const todayKey = toLocalDateKey((/* @__PURE__ */ new Date()).toISOString());
	const upcoming = items.filter((i) => itemDayKeys(i).some((k) => k >= todayKey)).sort((a, b) => a.start_at.localeCompare(b.start_at));
	if (upcoming.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-10 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarDays, { className: "mx-auto mb-3 h-10 w-10 text-muted-foreground" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-medium",
				children: "Nada agendado por aqui."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Os próximos itens do calendário aparecerão nesta lista."
			})
		]
	});
	const groups = /* @__PURE__ */ new Map();
	for (const it of upcoming) for (const key of itemDayKeys(it)) {
		if (key < todayKey) continue;
		const arr = groups.get(key) ?? [];
		arr.push(it);
		groups.set(key, arr);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-4",
		children: Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, list]) => {
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
				children: (/* @__PURE__ */ new Date(key + "T00:00:00")).toLocaleDateString("pt-BR", {
					weekday: "long",
					day: "2-digit",
					month: "long"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "divide-y divide-border",
					children: list.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "w-full p-4 text-left hover:bg-muted",
						onClick: () => onSelect(it),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemRow, {
							item: it,
							chapterName: chapterNameMap.get(it.chapter_id),
							showChapter
						})
					}) }, it.id))
				})
			})] }, key);
		})
	});
}
function ItemRow({ item, chapterName, showChapter }) {
	const meta = TYPE_META[item.event_type];
	const time = new Date(item.start_at).toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-xs font-semibold",
			style: {
				backgroundColor: meta.bg,
				color: meta.color
			},
			children: time
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate text-sm font-medium",
					children: item.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
					style: {
						backgroundColor: meta.bg,
						color: meta.color
					},
					children: meta.label
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground",
				children: [item.location && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-3 w-3" }), item.location]
				}), showChapter && chapterName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: chapterName })]
			})]
		})]
	});
}
function DetailContent({ item, chapterName, showChapter, canDelete, onDeleted, onEdit }) {
	const meta = TYPE_META[item.event_type];
	const { active: activeChapter } = useActiveChapter();
	const del = useMutation({
		mutationFn: () => deleteCalendarItem({ data: { id: item.id } }),
		onSuccess: () => {
			toast.success("Item excluído");
			onDeleted();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, {
			className: "flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
					style: {
						backgroundColor: meta.bg,
						color: meta.color
					},
					children: meta.label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
					style: item.mandatory ? {
						backgroundColor: "#FEE2E2",
						color: "#B91C1C"
					} : {
						backgroundColor: "var(--muted)",
						color: "var(--muted-foreground)"
					},
					children: item.mandatory ? "Obrigatório" : "Facultativo"
				}),
				item.public_open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
					style: {
						backgroundColor: "#DCFCE7",
						color: "#15803D"
					},
					children: "Aberto ao público"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.title })
			]
		}) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Início"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: formatDateTimeBR(item.start_at) })] }),
				item.end_at && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Término"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: formatDateTimeBR(item.end_at) })] }),
				item.location && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Local"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: item.location })] }),
				item.dress_code && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Traje"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: item.dress_code })] }),
				item.address && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Endereço"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: item.address })] }),
				showChapter && chapterName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Capítulo"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: chapterName })] }),
				item.description && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Descrição"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "whitespace-pre-wrap",
					children: item.description
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2 pt-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: async () => {
								try {
									await navigator.clipboard.writeText(buildChaveDoDia(item, {
										template: (activeChapter?.chapter)?.settings?.chave_template ?? null,
										chapterName: activeChapter?.chapter.name ?? null
									}));
									toast.success("Chave do dia copiada!");
								} catch {
									toast.error("Não foi possível copiar.");
								}
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "mr-2 h-3.5 w-3.5" }), " Chave do dia"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: googleCalendarUrl(item),
								target: "_blank",
								rel: "noreferrer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "mr-2 h-3.5 w-3.5" }), " Google Agenda"]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: outlookCalendarUrl(item),
								target: "_blank",
								rel: "noreferrer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "mr-2 h-3.5 w-3.5" }), " Outlook / Teams"]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => downloadIcs([item], item.title),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-2 h-3.5 w-3.5" }), " .ics (Apple)"]
						})
					]
				}),
				item.related_event_id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/eventos/$id",
					params: { id: item.related_event_id },
					className: "inline-flex items-center gap-1 text-sm font-medium",
					style: { color: "var(--chapter-primary)" },
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, { className: "h-4 w-4" }), " Ver evento"]
				}),
				canDelete && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/ongoing/$id",
					params: { id: item.id },
					className: "inline-flex items-center gap-1 text-sm font-medium",
					style: { color: "var(--chapter-primary)" },
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, { className: "h-4 w-4" }), " Abrir chamada e ata"]
				}) })
			]
		}),
		canDelete && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
			className: "sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "ghost",
				className: "text-destructive",
				onClick: () => del.mutate(),
				disabled: del.isPending,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-2 h-4 w-4" }), " Excluir"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				style: { backgroundColor: "var(--chapter-primary)" },
				onClick: onEdit,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "mr-2 h-4 w-4" }), " Editar"]
			})]
		})
	] });
}
function toLocalDateTimeInput(d) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
var DRESS_CODES = ["Informal", "Formal"];
function SectionTitle({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
		children
	});
}
function FieldError({ msg }) {
	if (!msg) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-1 text-[11px] font-medium text-destructive",
		children: msg
	});
}
function CreateDialog({ chapterId, chapterName, defaultDate, onClose, onCreated, item }) {
	const isEdit = Boolean(item);
	const isMobile = useIsMobile();
	const [title, setTitle] = (0, import_react.useState)(item?.title ?? "");
	const [type, setType] = (0, import_react.useState)(item?.event_type ?? "sessao_ritualistica");
	const [mandatory, setMandatory] = (0, import_react.useState)(item?.mandatory ?? true);
	const [publicOpen, setPublicOpen] = (0, import_react.useState)(item?.public_open ?? false);
	const [touched, setTouched] = (0, import_react.useState)(false);
	const baseDate = () => {
		const d = item ? new Date(item.start_at) : defaultDate ? /* @__PURE__ */ new Date(defaultDate + "T00:00:00") : /* @__PURE__ */ new Date();
		d.setSeconds(0, 0);
		return d;
	};
	const [startAt, setStartAt] = (0, import_react.useState)(() => {
		if (item) return toLocalDateTimeInput(new Date(item.start_at));
		const d = baseDate();
		d.setHours(13, 30, 0, 0);
		return toLocalDateTimeInput(d);
	});
	const [endAt, setEndAt] = (0, import_react.useState)(() => {
		if (item) return item.end_at ? toLocalDateTimeInput(new Date(item.end_at)) : "";
		const d = baseDate();
		d.setHours(17, 0, 0, 0);
		return toLocalDateTimeInput(d);
	});
	const [location, setLocation] = (0, import_react.useState)(item?.location ?? "");
	const [address, setAddress] = (0, import_react.useState)(item?.address ?? "");
	const [lodgeId, setLodgeId] = (0, import_react.useState)(item?.lodge_id ?? "");
	const [dressCode, setDressCode] = (0, import_react.useState)(item?.dress_code ?? "Formal");
	const [description, setDescription] = (0, import_react.useState)(item?.description ?? "");
	/** Sessões e eventos usam a loja patrocinadora para preencher local/endereço. */
	const usesLodge = isSessionType(type) || type === "evento";
	const lodges = useQuery({
		queryKey: ["chapter-lodges", chapterId],
		queryFn: () => listLodges({ data: { chapterId } }),
		enabled: Boolean(chapterId) && usesLodge
	});
	function pickLodge(id) {
		if (id === "none") {
			setLodgeId("");
			return;
		}
		setLodgeId(id);
		const l = (lodges.data ?? []).find((x) => x.id === id);
		if (!l) return;
		setLocation(l.name ?? "");
		setAddress(l.address ?? "");
	}
	const errors = (0, import_react.useMemo)(() => {
		const e = {};
		if (!title.trim()) e.title = "Informe o título da atividade.";
		if (!startAt) e.startAt = "Informe a data e hora de início.";
		if (endAt && startAt && endAt <= startAt) e.endAt = "O término deve ser após o início.";
		return e;
	}, [
		title,
		startAt,
		endAt
	]);
	const showErr = (k) => touched ? errors[k] : void 0;
	const isValid = Object.keys(errors).length === 0;
	const dateLabel = (0, import_react.useMemo)(() => {
		if (!startAt) return void 0;
		const d = new Date(startAt);
		if (Number.isNaN(d.getTime())) return void 0;
		return d.toLocaleDateString("pt-BR", {
			weekday: "long",
			day: "2-digit",
			month: "long"
		}) + `, às ${d.toLocaleTimeString("pt-BR", {
			hour: "2-digit",
			minute: "2-digit"
		})}`;
	}, [startAt]);
	/** Gera ou complementa a descrição com IA. */
	const ai = useMutation({
		mutationFn: () => composeEventDescription({ data: {
			title: title.trim(),
			eventType: TYPE_META[type].label,
			dressCode: dressCode || void 0,
			location: location.trim() || void 0,
			dateLabel,
			mandatory,
			publicOpen,
			current: description.trim() || void 0
		} }),
		onSuccess: (r) => {
			setDescription(r.text);
			toast.success(description.trim() ? "Descrição complementada pela IA" : "Descrição gerada pela IA");
		},
		onError: (e) => toast.error(e?.message ?? "Não foi possível gerar a descrição")
	});
	const payload = () => ({
		title: title.trim(),
		event_type: type,
		mandatory,
		public_open: publicOpen,
		start_at: new Date(startAt).toISOString(),
		end_at: endAt ? new Date(endAt).toISOString() : null,
		location: location.trim() || null,
		address: address.trim() || null,
		lodge_id: usesLodge ? lodgeId || null : null,
		dress_code: dressCode.trim() || null,
		description: description.trim() || null
	});
	const m = useMutation({
		mutationFn: () => isEdit ? updateCalendarItem({ data: {
			id: item.id,
			...payload()
		} }) : createCalendarItem({ data: payload() }),
		onSuccess: () => {
			toast.success(isEdit ? "Item atualizado" : "Item criado");
			onCreated();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	function submit() {
		setTouched(true);
		const first = Object.values(errors)[0];
		if (first) {
			toast.error(first);
			return;
		}
		m.mutate();
	}
	const identificacao = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Capítulo"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-11 items-center rounded-[8px] border border-border bg-muted px-3 text-sm font-medium text-muted-foreground",
					children: chapterName
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[11px] text-muted-foreground",
					children: "O evento será criado no capítulo ativo do usuário. Altere o capítulo pelo menu lateral."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Título *"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "h-11",
					value: title,
					onChange: (e) => setTitle(e.target.value),
					onBlur: () => setTouched(true),
					placeholder: "Ex: Sessão ordinária",
					"aria-invalid": Boolean(showErr("title"))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, { msg: showErr("title") })
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1.5 block text-xs",
				children: "Tipo"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: type,
				onValueChange: (v) => setType(v),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "h-11",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione o tipo" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: CALENDAR_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: t,
					children: TYPE_META[t].label
				}, t)) })]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1.5 block text-xs",
				children: "Traje"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: DRESS_CODES.includes(dressCode) ? dressCode : "Formal",
				onValueChange: setDressCode,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "h-11",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione o traje" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: DRESS_CODES.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: d,
					children: d
				}, d)) })]
			})] })
		]
	});
	const dataControle = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1 block text-xs",
						children: "Início *"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "datetime-local",
						className: "h-11 w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70",
						value: startAt,
						onChange: (e) => setStartAt(e.target.value),
						onBlur: () => setTouched(true),
						onClick: (e) => e.currentTarget.showPicker?.(),
						"aria-invalid": Boolean(showErr("startAt"))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, { msg: showErr("startAt") })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1 block text-xs",
						children: "Término"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "datetime-local",
						className: "h-11 w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70",
						value: endAt,
						min: startAt || void 0,
						onChange: (e) => setEndAt(e.target.value),
						onBlur: () => setTouched(true),
						onClick: (e) => e.currentTarget.showPicker?.(),
						"aria-invalid": Boolean(showErr("endAt"))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, { msg: showErr("endAt") })
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-[56px] items-center justify-between gap-3 rounded-[10px] border border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-xs font-medium",
					children: "Obrigatório"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-[11px] text-muted-foreground",
					children: "Conta na frequência dos membros."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: mandatory,
					onCheckedChange: setMandatory,
					className: "scale-110"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-[56px] items-center justify-between gap-3 rounded-[10px] border border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-xs font-medium",
					children: "Aberto ao público"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-[11px] text-muted-foreground",
					children: "Convidados e familiares podem participar."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: publicOpen,
					onCheckedChange: setPublicOpen,
					className: "scale-110"
				})]
			})
		]
	});
	const localBloco = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			usesLodge && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Loja patrocinadora"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: lodgeId || "none",
					onValueChange: pickLodge,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "h-11",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: (lodges.data ?? []).length ? "Selecione a loja…" : "Nenhuma loja cadastrada" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "none",
						children: "Sem loja vinculada"
					}), (lodges.data ?? []).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
						value: l.id,
						children: [l.name, l.is_primary ? " · principal" : ""]
					}, l.id))] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-[11px] text-muted-foreground",
					children: "Local e endereço são preenchidos automaticamente e podem ser editados."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1 block text-xs",
					children: "Local"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "h-11",
					list: "cal-local-sugestoes",
					value: location,
					onChange: (e) => setLocation(e.target.value),
					placeholder: "Templo, salão…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
					id: "cal-local-sugestoes",
					children: (lodges.data ?? []).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: l.name }, l.id))
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1 block text-xs",
				children: "Endereço"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				className: "h-11",
				value: address,
				onChange: (e) => setAddress(e.target.value),
				placeholder: "Rua, número, bairro, cidade"
			})] })
		]
	});
	const descricaoBloco = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				className: "h-9 w-full text-xs sm:w-auto",
				disabled: ai.isPending || !title.trim(),
				onClick: () => ai.mutate(),
				children: [ai.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "mr-1.5 h-3.5 w-3.5" }), ai.isPending ? "Gerando…" : description.trim() ? "Complementar com IA" : "Gerar com IA"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				value: description,
				onChange: (e) => setDescription(e.target.value),
				rows: 5
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted-foreground",
				children: "Com texto escrito, a IA complementa mantendo o seu conteúdo; vazio, ela gera a partir do título e dos dados da atividade."
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: "flex max-h-[95dvh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0 sm:max-w-3xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, {
				className: "border-b border-border px-4 py-3 sm:px-5 sm:py-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
					className: "text-left text-base",
					children: isEdit ? "Editar item de calendário" : defaultDate ? `Novo item · ${(/* @__PURE__ */ new Date(defaultDate + "T00:00:00")).toLocaleDateString("pt-BR", {
						weekday: "long",
						day: "2-digit",
						month: "long"
					})}` : "Novo item de calendário"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5",
				children: isMobile ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Accordion, {
					type: "multiple",
					defaultValue: ["ident", "data"],
					className: "w-full",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
							value: "ident",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
								className: "py-3 text-sm",
								children: "Identificação"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, {
								className: "pb-4",
								children: identificacao
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
							value: "data",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
								className: "py-3 text-sm",
								children: "Data e controle"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, {
								className: "pb-4",
								children: dataControle
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
							value: "local",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
								className: "py-3 text-sm",
								children: "Local"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, {
								className: "pb-4",
								children: localBloco
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AccordionItem, {
							value: "desc",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionTrigger, {
								className: "py-3 text-sm",
								children: "Descrição"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccordionContent, {
								className: "pb-4",
								children: descricaoBloco
							})]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-x-6 gap-y-5 md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { children: "Identificação" }), identificacao]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { children: "Data e controle" }), dataControle]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { children: "Local" }), localBloco]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { children: "Descrição" }), descricaoBloco]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
				className: "grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-background px-4 py-3 sm:flex sm:justify-end sm:px-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					className: "h-11 sm:h-9",
					onClick: onClose,
					children: "Cancelar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "h-11 sm:h-9",
					style: { backgroundColor: "var(--chapter-primary)" },
					disabled: m.isPending || touched && !isValid,
					onClick: submit,
					children: m.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar"
				})]
			})
		]
	});
}
//#endregion
export { CalendarioPage as component };
