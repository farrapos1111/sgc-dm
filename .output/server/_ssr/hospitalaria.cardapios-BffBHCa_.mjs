import { a as __toESM } from "../_runtime.mjs";
import { r as formatDateBR, t as formatBRL } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { T as Plus, l as Trash2, r as UtensilsCrossed } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { i as deleteMenu, n as createMenu, s as listMenus } from "./hospitality.functions-DTnUgQoy.mjs";
import { t as useCommissionAccess } from "./useCommissionAccess-BnP5Bq5-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hospitalaria.cardapios-BffBHCa_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Cardapios() {
	const { active } = useActiveChapter();
	const { canManage } = useCommissionAccess();
	const writable = canManage("hospitalaria");
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [form, setForm] = (0, import_react.useState)({
		title: "",
		menu_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
		items: "",
		estimated_cost: 0,
		notes: ""
	});
	const { data: menus = [], isLoading } = useQuery({
		queryKey: ["hospitality-menus", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listMenus({ data: { chapterId: active.chapter_id } })
	});
	const create = useMutation({
		mutationFn: () => createMenu({ data: {
			chapterId: active.chapter_id,
			...form,
			estimated_cost: Number(form.estimated_cost)
		} }),
		onSuccess: async () => {
			toast.success("Cardápio salvo");
			setOpen(false);
			setForm({
				title: "",
				menu_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
				items: "",
				estimated_cost: 0,
				notes: ""
			});
			await qc.invalidateQueries({ queryKey: ["hospitality-menus"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteMenu({ data: { id } }),
		onSuccess: async () => {
			toast.success("Cardápio excluído");
			await qc.invalidateQueries({ queryKey: ["hospitality-menus"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Cardápios",
			subtitle: "Planejamento das refeições e custos estimados.",
			actions: writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setOpen((v) => !v),
				style: { backgroundColor: active?.chapter.primary_color },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), " Novo cardápio"]
			}) : null
		}),
		open && writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-6 space-y-4 rounded-[12px] p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1.5 block text-sm",
							children: "Título *"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.title,
							onChange: (e) => setForm((f) => ({
								...f,
								title: e.target.value
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Data"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: form.menu_date,
						onChange: (e) => setForm((f) => ({
							...f,
							menu_date: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Custo estimado (R$)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						step: "0.01",
						value: form.estimated_cost,
						onChange: (e) => setForm((f) => ({
							...f,
							estimated_cost: Number(e.target.value)
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1.5 block text-sm",
							children: "Itens"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: form.items,
							onChange: (e) => setForm((f) => ({
								...f,
								items: e.target.value
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1.5 block text-sm",
							children: "Observações"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: form.notes,
							onChange: (e) => setForm((f) => ({
								...f,
								notes: e.target.value
							}))
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => setOpen(false),
					children: "Cancelar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => create.mutate(),
					disabled: create.isPending || !form.title.trim(),
					style: { backgroundColor: active?.chapter.primary_color },
					children: create.isPending ? "Salvando…" : "Salvar cardápio"
				})]
			})]
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : menus.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UtensilsCrossed, { className: "h-7 w-7" }),
			title: "Nenhum cardápio cadastrado",
			description: "Cadastre o cardápio das próximas sessões e eventos."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
			children: menus.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-1 flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate font-semibold",
								children: m.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground",
								children: formatDateBR(m.menu_date)
							})]
						}), writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							onClick: () => remove.mutate(m.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4 text-muted-foreground" })
						})]
					}),
					m.items && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-line text-sm text-muted-foreground",
						children: m.items
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 text-sm font-medium",
						children: formatBRL(Number(m.estimated_cost))
					}),
					m.notes && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: m.notes
					})
				]
			}, m.id))
		})
	] });
}
//#endregion
export { Cardapios as component };
