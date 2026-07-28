import { a as __toESM } from "../_runtime.mjs";
import { r as formatDateBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { K as FolderSearch, T as Plus, l as Trash2 } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as useCommissionAccess } from "./useCommissionAccess-BnP5Bq5-.mjs";
import { n as STATUS_LABELS } from "./sindicancias.fichas-Dr3GHnbk.mjs";
import { a as listFiles, r as deleteFile, s as updateFileStatus, t as createFile } from "./investigations.functions-aE5UMS5B.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sindicancias.fichas-CLNZ1WyQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Fichas() {
	const { active } = useActiveChapter();
	const { canManage } = useCommissionAccess();
	const writable = canManage("sindicancias");
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [filter, setFilter] = (0, import_react.useState)("todas");
	const [form, setForm] = (0, import_react.useState)({
		candidate_name: "",
		candidate_birth_date: "",
		candidate_phone: "",
		candidate_email: "",
		guardian_name: "",
		referred_by: "",
		notes: ""
	});
	const { data: files = [], isLoading } = useQuery({
		queryKey: ["investigation-files", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listFiles({ data: { chapterId: active.chapter_id } })
	});
	const visible = files.filter((f) => filter === "todas" || f.status === filter);
	const create = useMutation({
		mutationFn: () => createFile({ data: {
			chapterId: active.chapter_id,
			...form
		} }),
		onSuccess: async () => {
			toast.success("Ficha criada");
			setOpen(false);
			setForm({
				candidate_name: "",
				candidate_birth_date: "",
				candidate_phone: "",
				candidate_email: "",
				guardian_name: "",
				referred_by: "",
				notes: ""
			});
			await qc.invalidateQueries({ queryKey: ["investigation-files"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	const setStatus = useMutation({
		mutationFn: (v) => updateFileStatus({ data: v }),
		onSuccess: async () => qc.invalidateQueries({ queryKey: ["investigation-files"] }),
		onError: (e) => toast.error(e?.message ?? "Erro ao atualizar")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteFile({ data: { id } }),
		onSuccess: async () => {
			toast.success("Ficha excluída");
			await qc.invalidateQueries({ queryKey: ["investigation-files"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Fichas",
			subtitle: "Candidatos em processo de sindicância.",
			actions: writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setOpen((v) => !v),
				style: { backgroundColor: active?.chapter.primary_color },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), " Nova ficha"]
			}) : null
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
				value: filter,
				onValueChange: setFilter,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
					className: "w-48",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: "todas",
					children: "Todas as situações"
				}), Object.entries(STATUS_LABELS).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
					value: k,
					children: v
				}, k))] })]
			})
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
							children: "Nome do candidato *"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.candidate_name,
							onChange: (e) => setForm((f) => ({
								...f,
								candidate_name: e.target.value
							}))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Nascimento"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: form.candidate_birth_date,
						onChange: (e) => setForm((f) => ({
							...f,
							candidate_birth_date: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Telefone"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: form.candidate_phone,
						onChange: (e) => setForm((f) => ({
							...f,
							candidate_phone: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "E-mail"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: form.candidate_email,
						onChange: (e) => setForm((f) => ({
							...f,
							candidate_email: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Responsável"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: form.guardian_name,
						onChange: (e) => setForm((f) => ({
							...f,
							guardian_name: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1.5 block text-sm",
							children: "Indicado por"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: form.referred_by,
							onChange: (e) => setForm((f) => ({
								...f,
								referred_by: e.target.value
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
					disabled: create.isPending || !form.candidate_name.trim(),
					style: { backgroundColor: active?.chapter.primary_color },
					children: create.isPending ? "Salvando…" : "Salvar ficha"
				})]
			})]
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderSearch, { className: "h-7 w-7" }),
			title: "Nenhuma ficha cadastrada",
			description: "As fichas de candidatos aparecerão aqui."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
			children: visible.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate font-semibold",
								children: f.candidate_name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-muted-foreground",
								children: [f.candidate_birth_date ? formatDateBR(f.candidate_birth_date) : "—", f.referred_by ? ` · indicado por ${f.referred_by}` : ""]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							children: STATUS_LABELS[f.status] ?? f.status
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1 text-sm text-muted-foreground",
						children: [
							f.candidate_phone && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: f.candidate_phone }),
							f.candidate_email && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate",
								children: f.candidate_email
							}),
							f.guardian_name && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Responsável: ", f.guardian_name] }),
							f.notes && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "pt-1 text-foreground",
								children: f.notes
							})
						]
					}),
					writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: f.status,
							onValueChange: (v) => setStatus.mutate({
								id: f.id,
								status: v
							}),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: "h-11 flex-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: Object.entries(STATUS_LABELS).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: k,
								children: v
							}, k)) })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							onClick: () => remove.mutate(f.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4 text-muted-foreground" })
						})]
					})
				]
			}, f.id))
		})
	] });
}
//#endregion
export { Fichas as component };
