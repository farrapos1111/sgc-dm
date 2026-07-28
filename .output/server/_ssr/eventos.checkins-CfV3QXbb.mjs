import { a as __toESM } from "../_runtime.mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { w as QrCode } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { a as listCheckins } from "./hospitality.functions-DTnUgQoy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/eventos.checkins-CfV3QXbb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Checkins() {
	const { active } = useActiveChapter();
	const [eventId, setEventId] = (0, import_react.useState)("todos");
	const { data, isLoading } = useQuery({
		queryKey: ["checkins", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listCheckins({ data: { chapterId: active.chapter_id } })
	});
	const events = data?.events ?? [];
	const checkins = data?.checkins ?? [];
	const eventName = (0, import_react.useMemo)(() => new Map(events.map((e) => [e.id, e.name])), [events]);
	const visible = checkins.filter((c) => eventId === "todos" || c.event_id === eventId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Check-ins",
			subtitle: "Entradas registradas nos eventos do capítulo."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: eventId,
				onValueChange: setEventId,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "w-full sm:w-72",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: "todos",
					children: "Todos os eventos"
				}), events.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: e.id,
					children: e.name
				}, e.id))] })]
			})
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "h-7 w-7" }),
			title: "Nenhum check-in registrado",
			description: "Os check-ins feitos por QR code ou busca aparecerão aqui."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "divide-y divide-border rounded-[12px]",
			children: visible.map((c) => {
				const ticket = c.ticket;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm font-medium",
							children: ticket?.buyer_name ?? "—"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "truncate text-xs text-muted-foreground",
							children: [
								eventName.get(c.event_id) ?? "—",
								" · ",
								formatDateTimeBR(c.checked_in_at)
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "secondary",
						children: c.method === "qr" ? "QR" : "Busca"
					})]
				}, c.id);
			})
		})
	] });
}
//#endregion
export { Checkins as component };
