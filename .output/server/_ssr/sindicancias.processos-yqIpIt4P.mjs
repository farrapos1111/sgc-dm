import { a as __toESM } from "../_runtime.mjs";
import { r as formatDateBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { G as Gavel, T as Plus, l as Trash2 } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as useCommissionAccess } from "./useCommissionAccess-BnP5Bq5-.mjs";
import { a as listFiles, c as updateProcess, i as deleteProcess, n as createProcess, o as listProcesses } from "./investigations.functions-aE5UMS5B.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sindicancias.processos-yqIpIt4P.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATUS_LABELS = {
	aberta: "Aberto",
	em_andamento: "Em andamento",
	aprovada: "Aprovado",
	reprovada: "Reprovado",
	arquivada: "Arquivado"
};
function Processos() {
	const { active } = useActiveChapter();
	const { canManage } = useCommissionAccess();
	const writable = canManage("sindicancias");
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [form, setForm] = (0, import_react.useState)({
		title: "",
		file_id: "",
		opened_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
		opinion: ""
	});
	const { data: processes = [], isLoading } = useQuery({
		queryKey: ["investigation-processes", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listProcesses({ data: { chapterId: active.chapter_id } })
	});
	const { data: files = [] } = useQuery({
		queryKey: ["investigation-files", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listFiles({ data: { chapterId: active.chapter_id } })
	});
	const create = useMutation({
		mutationFn: () => createProcess({ data: {
			chapterId: active.chapter_id,
			title: form.title,
			file_id: form.file_id || null,
			opened_at: form.opened_at,
			opinion: form.opinion || null
		} }),
		onSuccess: async () => {
			toast.success("Processo aberto");
			setOpen(false);
			setForm({
				title: "",
				file_id: "",
				opened_at: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
				opinion: ""
			});
			await qc.invalidateQueries({ queryKey: ["investigation-processes"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	const update = useMutation({
		mutationFn: (v) => updateProcess({ data: v }),
		onSuccess: async () => qc.invalidateQueries({ queryKey: ["investigation-processes"] }),
		onError: (e) => toast.error(e?.message ?? "Erro ao atualizar")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteProcess({ data: { id } }),
		onSuccess: async () => {
			toast.success("Processo excluído");
			await qc.invalidateQueries({ queryKey: ["investigation-processes"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Processos",
			subtitle: "Processos de sindicância e seus pareceres.",
			actions: writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setOpen((v) => !v),
				style: { backgroundColor: active?.chapter.primary_color },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), " Novo processo"]
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
						children: "Ficha vinculada"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: form.file_id || "none",
						onValueChange: (v) => setForm((f) => ({
							...f,
							file_id: v === "none" ? "" : v
						})),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Nenhuma" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "none",
							children: "Nenhuma"
						}), files.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: f.id,
							children: f.candidate_name
						}, f.id))] })]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-sm",
						children: "Abertura"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						value: form.opened_at,
						onChange: (e) => setForm((f) => ({
							...f,
							opened_at: e.target.value
						}))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1.5 block text-sm",
							children: "Parecer inicial"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: form.opinion,
							onChange: (e) => setForm((f) => ({
								...f,
								opinion: e.target.value
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
					children: create.isPending ? "Salvando…" : "Abrir processo"
				})]
			})]
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : processes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gavel, { className: "h-7 w-7" }),
			title: "Nenhum processo aberto",
			description: "Abra um processo para acompanhar a sindicância de um candidato."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-4",
			children: processes.map((p) => {
				const file = p.file;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "rounded-[12px] p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-2 flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-semibold",
									children: p.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs text-muted-foreground",
									children: [
										"Aberto em ",
										formatDateBR(p.opened_at),
										file ? ` · ${file.candidate_name}` : ""
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								children: STATUS_LABELS[p.status] ?? p.status
							})]
						}),
						p.opinion && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: p.opinion
						}),
						writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: p.status,
								onValueChange: (v) => update.mutate({
									id: p.id,
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
								onClick: () => remove.mutate(p.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4 text-muted-foreground" })
							})]
						})
					]
				}, p.id);
			})
		})
	] });
}
//#endregion
export { Processos as component };
