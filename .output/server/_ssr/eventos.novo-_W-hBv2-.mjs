import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { ut as Check, vt as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { r as createEvent } from "./events.functions-CSdsJ1ax.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/eventos.novo-_W-hBv2-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function NovoEvento() {
	const { active } = useActiveChapter();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [form, setForm] = (0, import_react.useState)({
		name: "",
		description: "",
		location: "",
		starts_at: "",
		ends_at: "",
		goal_amount: 0,
		status: "rascunho"
	});
	const mutation = useMutation({
		mutationFn: async () => {
			if (!active) throw new Error("Sem capítulo ativo");
			if (!form.name.trim() || !form.starts_at) throw new Error("Preencha nome e data de início");
			return createEvent({ data: {
				chapter_id: active.chapter_id,
				name: form.name.trim(),
				description: form.description,
				location: form.location,
				starts_at: new Date(form.starts_at).toISOString(),
				ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
				goal_amount: Number(form.goal_amount) || 0,
				status: form.status
			} });
		},
		onSuccess: async (res) => {
			toast.success("Evento criado");
			await qc.invalidateQueries({ queryKey: ["events"] });
			navigate({
				to: "/eventos/$id",
				params: { id: res.id }
			});
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao criar")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Novo evento",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			onClick: () => navigate({ to: "/eventos" }),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-6 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1.5 block text-sm",
				children: "Nome *"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: form.name,
				onChange: (e) => setForm((f) => ({
					...f,
					name: e.target.value
				}))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				className: "mb-1.5 block text-sm",
				children: "Descrição"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				value: form.description,
				onChange: (e) => setForm((f) => ({
					...f,
					description: e.target.value
				}))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Local"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: form.location,
						onChange: (e) => setForm((f) => ({
							...f,
							location: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Meta (R$)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						step: "0.01",
						value: form.goal_amount,
						onChange: (e) => setForm((f) => ({
							...f,
							goal_amount: Number(e.target.value)
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Início *"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "datetime-local",
						value: form.starts_at,
						onChange: (e) => setForm((f) => ({
							...f,
							starts_at: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Término"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "datetime-local",
						value: form.ends_at,
						onChange: (e) => setForm((f) => ({
							...f,
							ends_at: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: form.status,
						onValueChange: (v) => setForm((f) => ({
							...f,
							status: v
						})),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "rascunho",
							children: "Rascunho"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "publicado",
							children: "Publicado"
						})] })]
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end pt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => mutation.mutate(),
					disabled: mutation.isPending,
					style: { backgroundColor: active?.chapter.primary_color },
					children: mutation.isPending ? "Salvando…" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-2 h-4 w-4" }), " Criar evento"] })
				})
			})
		]
	})] });
}
//#endregion
export { NovoEvento as component };
