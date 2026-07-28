import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as formatDateTimeBR, t as formatBRL } from "./format-BWFXNFqE.mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { n as queryOptions, r as useSuspenseQuery } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { dt as Calendar, rt as CirclePlus } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { s as listEvents } from "./events.functions-CSdsJ1ax.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as Progress } from "./progress-DOIEKRJF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/eventos.index-DFPeulSf.js
var import_jsx_runtime = require_jsx_runtime();
var eventsQO = (chapterId) => queryOptions({
	queryKey: ["events", chapterId],
	queryFn: () => listEvents({ data: { chapterId } })
});
function EventosList() {
	const { active } = useActiveChapter();
	if (!active) return null;
	const { data: events } = useSuspenseQuery(eventsQO(active.chapter_id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Eventos",
		subtitle: `${events.length} ${events.length === 1 ? "evento" : "eventos"} cadastrados`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			style: { backgroundColor: active.chapter.primary_color },
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/eventos/novo",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Novo evento"]
			})
		})
	}), events.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "h-7 w-7" }),
		title: "Nenhum evento ainda",
		description: "Crie o primeiro evento do seu capítulo.",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			style: { backgroundColor: active.chapter.primary_color },
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/eventos/novo",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Criar evento"]
			})
		})
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-1 gap-3 md:grid-cols-2",
		children: events.map((e) => {
			const pct = e.goal_amount > 0 ? Math.min(100, Number(e.raised) / Number(e.goal_amount) * 100) : 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/eventos/$id",
				params: { id: e.id },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "rounded-[12px] p-5 transition-colors hover:bg-muted/30",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-semibold",
									children: e.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground",
									children: formatDateTimeBR(e.starts_at)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								className: "capitalize shrink-0",
								children: e.status
							})]
						}),
						e.goal_amount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatBRL(Number(e.raised)) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Meta: ", formatBRL(Number(e.goal_amount))] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, {
								value: pct,
								className: "h-1.5"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 text-xs text-muted-foreground",
							children: [
								e.tickets_sold,
								" ",
								e.tickets_sold === 1 ? "ingresso vendido" : "ingressos vendidos"
							]
						})
					]
				})
			}, e.id);
		})
	})] });
}
//#endregion
export { EventosList as component };
