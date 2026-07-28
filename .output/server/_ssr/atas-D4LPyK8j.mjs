import { a as __toESM } from "../_runtime.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Overlay2, c as Title2, i as Description2, n as Cancel, o as Portal2, r as Content2, s as Root2, t as Action } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { $ as Download, C as Radio, T as Plus, l as Trash2, q as FileText } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { n as buttonVariants, t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CCJRliUM.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { d as listTemplates, i as SIGNER_ROLES, n as MINUTE_STATUS_LABELS, o as createTemplate, p as saveTemplate, r as SIGNER_LABELS, s as deleteTemplate, t as AVAILABLE_VARS, u as listChapterMinutes } from "./minute-vars-ChG2Qv-l.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/atas-D4LPyK8j.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var AlertDialog = Root2;
var AlertDialogPortal = Portal2;
var AlertDialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, {
	className: cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props,
	ref
}));
AlertDialogOverlay.displayName = Overlay2.displayName;
var AlertDialogContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props
})] }));
AlertDialogContent.displayName = Content2.displayName;
var AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col space-y-2 text-center sm:text-left", className),
	...props
});
AlertDialogHeader.displayName = "AlertDialogHeader";
var AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
AlertDialogFooter.displayName = "AlertDialogFooter";
var AlertDialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title2, {
	ref,
	className: cn("text-lg font-semibold", className),
	...props
}));
AlertDialogTitle.displayName = Title2.displayName;
var AlertDialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
AlertDialogDescription.displayName = Description2.displayName;
var AlertDialogAction = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
	ref,
	className: cn(buttonVariants(), className),
	...props
}));
AlertDialogAction.displayName = Action.displayName;
var AlertDialogCancel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
	ref,
	className: cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className),
	...props
}));
AlertDialogCancel.displayName = Cancel.displayName;
var templatesQO = (chapterId) => queryOptions({
	queryKey: ["minute-templates", chapterId],
	queryFn: () => listTemplates({ data: { chapterId } })
});
var minutesQO = (chapterId) => queryOptions({
	queryKey: ["chapter-minutes", chapterId],
	queryFn: () => listChapterMinutes({ data: { chapterId } })
});
var STATUS_STYLE = {
	rascunho: {
		bg: "#F3F4F6",
		color: "#6B6B6B"
	},
	em_revisao: {
		bg: "#FEF3C7",
		color: "#B45309"
	},
	aprovada: {
		bg: "#D1FAE5",
		color: "#047857"
	}
};
function ExportPdfButton({ minute, size }) {
	const { active } = useActiveChapter();
	const [busy, setBusy] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		variant: "outline",
		size,
		disabled: busy || !minute?.content?.trim(),
		onClick: async (e) => {
			e.preventDefault();
			e.stopPropagation();
			setBusy(true);
			try {
				const { exportMinutePdf } = await import("./minute-pdf-D3g6DTBA.mjs");
				await exportMinutePdf({
					chapterName: active?.chapter.name ?? "",
					chapterCity: active?.chapter.city,
					logoPath: active?.chapter.logo_url,
					title: minute.calendar_event?.title ?? "Sessão",
					dateISO: minute.calendar_event?.start_at ?? minute.opened_at,
					status: MINUTE_STATUS_LABELS[minute.status] ?? minute.status,
					signatures: SIGNER_ROLES.filter((r) => (minute.approvals ?? []).some((a) => a.signer_role === r)).map((r) => SIGNER_LABELS[r]),
					content: minute.content ?? ""
				});
			} catch (err) {
				toast.error(err?.message ?? "Erro ao gerar o PDF");
			} finally {
				setBusy(false);
			}
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-2 h-4 w-4" }), busy ? "Gerando…" : "PDF"]
	});
}
function StatusBadge({ status }) {
	const st = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
		style: {
			backgroundColor: st.bg,
			color: st.color
		},
		children: MINUTE_STATUS_LABELS[status] ?? status
	});
}
function AtasPage() {
	const { active } = useActiveChapter();
	const chapterId = active?.chapter_id ?? "";
	const { data: templates } = useSuspenseQuery(templatesQO(chapterId));
	const { data: minutes } = useSuspenseQuery(minutesQO(chapterId));
	const allowed = can(active?.role.name, "secretaria") || can(active?.role.name, "admin");
	const [status, setStatus] = (0, import_react.useState)("all");
	const rows = minutes;
	const current = (0, import_react.useMemo)(() => {
		const now = Date.now();
		return rows.find((r) => {
			const ev = r.calendar_event;
			if (!ev) return false;
			const start = +new Date(ev.start_at);
			const end = ev.end_at ? +new Date(ev.end_at) : start + 12 * 3600 * 1e3;
			return start <= now && now <= end;
		}) ?? rows.find((r) => r.status !== "aprovada") ?? null;
	}, [rows]);
	const filtered = rows.filter((r) => (status === "all" || r.status === status) && r.id !== current?.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Atas",
		subtitle: "Ata em andamento, histórico por situação e modelos padrão do capítulo."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		defaultValue: "atual",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "atual",
						children: "Atual"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "todas",
						children: "Todas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "modelos",
						children: "Modelos"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "atual",
				children: !current ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-7 w-7" }),
					title: "Nenhuma ata em andamento",
					description: "Ao abrir um item do calendário em andamento, a ata da sessão aparece aqui.",
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "outline",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/calendario",
							children: "Ver calendário"
						})
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "rounded-[12px] p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
									className: "h-4 w-4 animate-pulse",
									style: { color: "var(--chapter-primary)" }
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-medium",
									children: current.calendar_event?.title ?? "Sessão"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: current.status }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: current.calendar_event?.start_at ? formatDateTimeBR(current.calendar_event.start_at) : ""
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: "max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border p-3 font-sans text-sm leading-relaxed",
							children: current.content || "Ata ainda em branco."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mr-auto text-xs text-muted-foreground",
									children: [
										"Assinaturas:",
										" ",
										SIGNER_ROLES.filter((r) => (current.approvals ?? []).some((a) => a.signer_role === r)).map((r) => SIGNER_LABELS[r]).join(", ") || "nenhuma"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportPdfButton, { minute: current }),
								current.calendar_event_id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									style: { backgroundColor: "var(--chapter-primary)" },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/ongoing/$id",
										params: { id: current.calendar_event_id },
										children: "Redigir ata"
									})
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
				value: "todas",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-4 flex items-center gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: status,
						onValueChange: setStatus,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "h-9 w-[240px] text-sm",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Filtrar por situação" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "all",
								children: "Todas as situações"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "rascunho",
								children: "Rascunho"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "em_revisao",
								children: "Em Revisão para Aprovação"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "aprovada",
								children: "Aprovada"
							})
						] })]
					})
				}), filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-7 w-7" }),
					title: "Nenhuma ata encontrada",
					description: "Não há atas registradas para esta situação."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-2",
					children: filtered.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/ongoing/$id",
						params: { id: m.calendar_event_id },
						className: "flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card p-4 hover:bg-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium",
								children: m.calendar_event?.title ?? "Sessão"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-muted-foreground",
								children: [
									m.calendar_event?.start_at ? formatDateTimeBR(m.calendar_event.start_at) : formatDateTimeBR(m.opened_at),
									" · ",
									(m.approvals ?? []).length,
									"/3 assinaturas"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex shrink-0 items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: m.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportPdfButton, {
								minute: m,
								size: "sm"
							})]
						})]
					}) }, m.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
				value: "modelos",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "mb-4 rounded-[12px] p-4 text-xs text-muted-foreground",
						children: [
							"Variáveis reconhecidas: ",
							AVAILABLE_VARS.join(" · "),
							". Ao inserir um modelo na ata da sessão, elas são preenchidas automaticamente com os dados do capítulo e dos oficiais da vigência atual. Variáveis não reconhecidas permanecem entre colchetes para preenchimento manual."
						]
					}),
					allowed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewTemplate, { chapterId }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-4",
						children: templates.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TemplateCard, {
							template: t,
							chapterId,
							editable: allowed
						}, t.id))
					})
				]
			})
		]
	})] });
}
function NewTemplate({ chapterId }) {
	const qc = useQueryClient();
	const [name, setName] = (0, import_react.useState)("");
	const create = useMutation({
		mutationFn: () => createTemplate({ data: {
			chapterId,
			name: name.trim(),
			body: ""
		} }),
		onSuccess: () => {
			toast.success("Modelo criado");
			setName("");
			qc.invalidateQueries({ queryKey: ["minute-templates", chapterId] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao criar modelo")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "mb-4 flex flex-wrap items-center gap-2 rounded-[12px] p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			value: name,
			placeholder: "Nome do novo modelo padrão",
			onChange: (e) => setName(e.target.value),
			className: "h-10 max-w-sm text-sm"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			style: { backgroundColor: "var(--chapter-primary)" },
			disabled: !name.trim() || create.isPending,
			onClick: () => create.mutate(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), create.isPending ? "Criando…" : "Incluir modelo"]
		})]
	});
}
function TemplateCard({ template, chapterId, editable }) {
	const qc = useQueryClient();
	const [name, setName] = (0, import_react.useState)(template.name);
	const [body, setBody] = (0, import_react.useState)(template.body);
	const [confirm, setConfirm] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setName(template.name);
		setBody(template.body);
	}, [template.name, template.body]);
	const save = useMutation({
		mutationFn: () => saveTemplate({ data: {
			id: template.id,
			name,
			body
		} }),
		onSuccess: () => {
			toast.success("Modelo salvo");
			qc.invalidateQueries({ queryKey: ["minute-templates", chapterId] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar modelo")
	});
	const remove = useMutation({
		mutationFn: () => deleteTemplate({ data: { id: template.id } }),
		onSuccess: () => {
			toast.success("Modelo excluído");
			qc.invalidateQueries({ queryKey: ["minute-templates", chapterId] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir modelo")
	});
	const dirty = name !== template.name || body !== template.body;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-4 w-4 text-muted-foreground" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						disabled: !editable,
						onChange: (e) => setName(e.target.value),
						className: "h-9 max-w-sm text-sm font-medium"
					}),
					editable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon",
						className: "ml-auto h-10 w-10 text-muted-foreground",
						"aria-label": "Excluir modelo",
						onClick: () => setConfirm(true),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				value: body,
				rows: 10,
				readOnly: !editable,
				onChange: (e) => setBody(e.target.value),
				className: "text-sm leading-relaxed"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex items-center justify-end gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mr-auto text-xs text-muted-foreground",
					children: ["Atualizado em ", formatDateTimeBR(template.updated_at)]
				}), editable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					style: { backgroundColor: "var(--chapter-primary)" },
					disabled: !dirty || save.isPending,
					onClick: () => save.mutate(),
					children: save.isPending ? "Salvando…" : "Salvar alterações"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialog, {
				open: confirm,
				onOpenChange: setConfirm,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogTitle, { children: [
					"Excluir modelo “",
					template.name,
					"”?"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogDescription, { children: "O modelo será removido do capítulo. As atas já redigidas não são afetadas." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogCancel, { children: "Cancelar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogAction, {
					onClick: () => remove.mutate(),
					children: "Excluir"
				})] })] })
			})
		]
	});
}
//#endregion
export { AtasPage as component };
