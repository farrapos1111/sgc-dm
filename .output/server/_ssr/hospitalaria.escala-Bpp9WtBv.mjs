import { a as __toESM } from "../_runtime.mjs";
import { r as formatDateBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { I as ListChecks, T as Plus, l as Trash2 } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { o as listDuties, r as deleteDuty, t as createDuty } from "./hospitality.functions-DTnUgQoy.mjs";
import { t as useCommissionAccess } from "./useCommissionAccess-BnP5Bq5-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hospitalaria.escala-Bpp9WtBv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Escala() {
	const { active } = useActiveChapter();
	const { canManage } = useCommissionAccess();
	const writable = canManage("hospitalaria");
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [form, setForm] = (0, import_react.useState)({
		member_id: "",
		duty_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
		role_label: "Serviço",
		notes: ""
	});
	const { data, isLoading } = useQuery({
		queryKey: ["hospitality-duties", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listDuties({ data: { chapterId: active.chapter_id } })
	});
	const duties = data?.duties ?? [];
	const members = data?.members ?? [];
	const create = useMutation({
		mutationFn: () => createDuty({ data: {
			chapterId: active.chapter_id,
			...form
		} }),
		onSuccess: async () => {
			toast.success("Escala registrada");
			setOpen(false);
			setForm({
				member_id: "",
				duty_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
				role_label: "Serviço",
				notes: ""
			});
			await qc.invalidateQueries({ queryKey: ["hospitality-duties"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteDuty({ data: { id } }),
		onSuccess: async () => {
			toast.success("Escala removida");
			await qc.invalidateQueries({ queryKey: ["hospitality-duties"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Escala de Serviço",
			subtitle: "Distribuição das funções da hospitalaria.",
			actions: writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setOpen((v) => !v),
				style: { backgroundColor: active?.chapter.primary_color },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), " Nova escala"]
			}) : null
		}),
		open && writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-6 space-y-4 rounded-[12px] p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Membro *"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: form.member_id,
						onValueChange: (v) => setForm((f) => ({
							...f,
							member_id: v
						})),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: m.id,
							children: m.full_name
						}, m.id)) })]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Data"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: form.duty_date,
						onChange: (e) => setForm((f) => ({
							...f,
							duty_date: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Função"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: form.role_label,
						onChange: (e) => setForm((f) => ({
							...f,
							role_label: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Observações"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: form.notes,
						onChange: (e) => setForm((f) => ({
							...f,
							notes: e.target.value
						}))
					})] })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => setOpen(false),
					children: "Cancelar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => create.mutate(),
					disabled: create.isPending || !form.member_id,
					style: { backgroundColor: active?.chapter.primary_color },
					children: create.isPending ? "Salvando…" : "Salvar escala"
				})]
			})]
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : duties.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListChecks, { className: "h-7 w-7" }),
			title: "Nenhuma escala definida",
			description: "Defina quem serve em cada data da hospitalaria."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "divide-y divide-border rounded-[12px]",
			children: duties.map((d) => {
				const member = d.member;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm font-medium",
							children: member?.full_name ?? "—"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs text-muted-foreground",
							children: [
								formatDateBR(d.duty_date),
								" · ",
								d.role_label,
								d.notes ? ` · ${d.notes}` : ""
							]
						})]
					}), writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon",
						onClick: () => remove.mutate(d.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4 text-muted-foreground" })
					})]
				}, d.id);
			})
		})
	] });
}
//#endregion
export { Escala as component };
