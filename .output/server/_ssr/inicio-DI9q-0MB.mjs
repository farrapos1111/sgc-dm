import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as formatDateTimeBR, r as formatDateBR, t as formatBRL } from "./format-BWFXNFqE.mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, n as queryOptions, r as useSuspenseQuery } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { C as Radio, dt as Calendar, et as Copy, i as Users, j as MapPin, n as Wallet, pt as Cake, rt as CirclePlus } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { n as canManageAttendance } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as listCalendarItems } from "./calendar.functions-DtITjqb1.mjs";
import { r as buildChaveDoDia } from "./chave-do-dia-DmSt55yO.mjs";
import { n as TYPE_META } from "./calendar-types-DWS_Rd7G.mjs";
import { s as listEvents } from "./events.functions-CSdsJ1ax.mjs";
import { r as listMembers } from "./members.functions-DeZwihqx.mjs";
import { n as membersListKey } from "./query-keys-Cpoprrf-.mjs";
import { i as listOngoingItems } from "./attendance.functions-B5vlRrhX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/inicio-DI9q-0MB.js
var import_jsx_runtime = require_jsx_runtime();
var eventsQO = (chapterId) => queryOptions({
	queryKey: ["events", chapterId],
	queryFn: () => listEvents({ data: { chapterId } })
});
var membersQO = (chapterId) => queryOptions({
	queryKey: membersListKey(chapterId, "", "all"),
	queryFn: () => listMembers({ data: {
		chapterId,
		search: "",
		status: "all"
	} })
});
function Inicio() {
	const { active } = useActiveChapter();
	if (!active) return null;
	const chapterId = active.chapter_id;
	const { data: events } = useSuspenseQuery(eventsQO(chapterId));
	const { data: members } = useSuspenseQuery(membersQO(chapterId));
	const canAttendance = canManageAttendance(active.role.name);
	const { data: ongoing } = useQuery({
		queryKey: ["ongoing-items", chapterId],
		queryFn: () => listOngoingItems({ data: { chapterId } }),
		enabled: Boolean(chapterId),
		refetchInterval: 6e4
	});
	const now = /* @__PURE__ */ new Date();
	const upcoming = events.filter((e) => new Date(e.starts_at) >= now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
	const birthdayMonth = now.getMonth();
	const birthdays = members.filter((m) => m.birth_date && new Date(m.birth_date).getMonth() === birthdayMonth).slice(0, 5);
	const hasAnyData = members.length > 0 || events.length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: `Olá, ${typeof window !== "undefined" && window.__demolayName || active.role.label}`,
			subtitle: `${active.chapter.name}${active.chapter.city ? ` · ${active.chapter.city}` : ""}`
		}),
		(ongoing?.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-5 rounded-[12px] p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center gap-2 text-sm font-medium",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
					className: "h-5 w-5 animate-pulse",
					style: { color: active.chapter.primary_color }
				}), "Acontecendo agora"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2",
				children: (ongoing ?? []).map((it) => {
					const meta = TYPE_META[it.event_type];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OngoingRow, {
						to: canAttendance ? it.id : null,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium",
								children: it.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-muted-foreground",
								children: [formatDateTimeBR(it.start_at), it.mandatory ? " · Obrigatório" : " · Facultativo"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
							style: {
								backgroundColor: meta?.bg,
								color: meta?.color
							},
							children: meta?.label ?? it.event_type
						})]
					}) }, it.id);
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NextItemCard, { chapterId }),
		!hasAnyData ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "h-7 w-7" }),
			title: "Nenhum lançamento ainda",
			description: "Cadastre o primeiro membro ou crie um evento para começar.",
			action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap justify-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					style: { backgroundColor: active.chapter.primary_color },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/membros/novo",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Cadastrar membro"]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "outline",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/eventos/novo",
						children: "Criar evento"
					})
				})]
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-4 md:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "h-5 w-5" }),
					label: "Saldo do mês",
					value: formatBRL(0),
					hint: "Em breve — integração financeira"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/membros",
					className: "block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "h-5 w-5" }),
						label: "Mensalidades pendentes",
						value: `${Math.max(0, Math.floor(members.length * .2))} membros`,
						hint: "Toque para ver a lista"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "h-5 w-5" }),
					label: "Próximo evento",
					value: upcoming?.name ?? "Nenhum",
					hint: upcoming ? formatDateBR(upcoming.starts_at) : "—"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "rounded-[12px] p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cake, { className: "h-5 w-5" }), " Aniversariantes do mês"]
					}), birthdays.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: "Nenhum neste mês."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-1.5",
						children: birthdays.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: m.full_name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: formatDateBR(m.birth_date)
							})]
						}, m.id))
					})]
				})
			]
		})
	] });
}
function OngoingRow({ to, children }) {
	const cls = "flex items-center justify-between gap-3 rounded-[8px] border border-border p-3";
	if (!to) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cls,
		children
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/ongoing/$id",
		params: { id: to },
		className: `${cls} hover:bg-muted`,
		children
	});
}
function MetricCard({ icon, label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm font-medium text-muted-foreground",
				children: [
					icon,
					" ",
					label
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 text-2xl font-bold",
				children: value
			}),
			hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
function NextItemCard({ chapterId }) {
	const { active: activeChapter } = useActiveChapter();
	const { data } = useQuery({
		queryKey: ["calendar-next", chapterId],
		queryFn: () => listCalendarItems({ data: {
			chapterIds: [chapterId],
			from: (/* @__PURE__ */ new Date()).toISOString()
		} }),
		enabled: Boolean(chapterId)
	});
	const next = (data ?? [])[0];
	if (!next) return null;
	const meta = TYPE_META[next.event_type];
	async function copyChave() {
		const text = buildChaveDoDia(next, {
			template: (activeChapter?.chapter)?.settings?.chave_template ?? null,
			chapterName: activeChapter?.chapter.name ?? null
		});
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Chave do dia copiada!");
		} catch {
			toast.error("Não foi possível copiar. Copie manualmente.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "mb-5 rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "h-4 w-4 text-muted-foreground" }), "Próximo compromisso"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
					style: {
						backgroundColor: meta?.bg,
						color: meta?.color
					},
					children: meta?.label ?? next.event_type
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-base font-semibold",
				children: next.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-xs text-muted-foreground",
				children: formatDateTimeBR(next.start_at)
			}),
			next.location && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-3 w-3" }),
					" ",
					next.location
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					className: "w-full sm:w-auto",
					onClick: copyChave,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "mr-2 h-4 w-4" }), " Copiar chave do dia"]
				})
			})
		]
	});
}
//#endregion
export { Inicio as component };
