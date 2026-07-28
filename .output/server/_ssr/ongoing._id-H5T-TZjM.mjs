import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { $ as Download, N as Lock, P as LoaderCircle, _ as Search, b as RotateCcw, it as CircleCheck, p as Signature, q as FileText, t as X, ut as Check, vt as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CCJRliUM.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { a as applyVars, c as getMinuteApprovals, d as listTemplates, f as reopenMinute, h as submitMinute, i as SIGNER_ROLES, l as getMinuteContext, m as signMinute, n as MINUTE_STATUS_LABELS, r as SIGNER_LABELS, t as AVAILABLE_VARS } from "./minute-vars-ChG2Qv-l.mjs";
import { n as canManageAttendance } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as TYPE_META } from "./calendar-types-DWS_Rd7G.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as currentTerm } from "./terms-DRv0pA-p.mjs";
import { a as saveMinutes, n as getOngoing, o as setAttendance } from "./attendance.functions-B5vlRrhX.mjs";
import { t as Route } from "./ongoing._id-gTygAUtx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ongoing._id-H5T-TZjM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
function MinutesPanel({ chapterId, calendarEventId, item, minutes, roleName, onChanged }) {
	const qc = useQueryClient();
	const { active } = useActiveChapter();
	const term = currentTerm();
	const [exporting, setExporting] = (0, import_react.useState)(false);
	const [ata, setAta] = (0, import_react.useState)(minutes?.content ?? "");
	const [templateId, setTemplateId] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setAta(minutes?.content ?? "");
	}, [minutes?.content]);
	const status = minutes?.status ?? "rascunho";
	const editable = status === "rascunho";
	const templates = useQuery({
		queryKey: ["minute-templates", chapterId],
		queryFn: () => listTemplates({ data: { chapterId } })
	});
	const ctx = useQuery({
		queryKey: [
			"minute-context",
			chapterId,
			term.year,
			term.semester
		],
		queryFn: () => getMinuteContext({ data: {
			chapterId,
			termYear: term.year,
			termSemester: term.semester
		} })
	});
	const approvals = useQuery({
		queryKey: ["minute-approvals", minutes?.id],
		queryFn: () => getMinuteApprovals({ data: { minuteId: minutes.id } }),
		enabled: Boolean(minutes?.id)
	});
	const signedRoles = (0, import_react.useMemo)(() => new Set((approvals.data ?? []).map((a) => a.signer_role)), [approvals.data]);
	const refresh = () => {
		onChanged();
		qc.invalidateQueries({ queryKey: ["minute-approvals", minutes?.id] });
	};
	const save = useMutation({
		mutationFn: (content) => saveMinutes({ data: {
			chapterId,
			calendarEventId,
			content
		} }),
		onSuccess: () => {
			toast.success("Ata salva");
			refresh();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar ata")
	});
	const conclude = useMutation({
		mutationFn: async () => {
			return submitMinute({ data: { minuteId: (await saveMinutes({ data: {
				chapterId,
				calendarEventId,
				content: ata
			} })).minute.id } });
		},
		onSuccess: () => {
			toast.success("Ata concluída — em revisão para aprovação");
			refresh();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao concluir ata")
	});
	const reopen = useMutation({
		mutationFn: () => reopenMinute({ data: { minuteId: minutes.id } }),
		onSuccess: () => {
			toast.success("Ata reaberta para correção — assinaturas removidas");
			refresh();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao reabrir ata")
	});
	const sign = useMutation({
		mutationFn: (signerRole) => signMinute({ data: {
			minuteId: minutes.id,
			signerRole
		} }),
		onSuccess: (r) => {
			toast.success(r?.approved ? "Ata aprovada!" : "Assinatura registrada");
			refresh();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao assinar")
	});
	function insertTemplate(id) {
		setTemplateId(id);
		const tpl = (templates.data ?? []).find((t) => t.id === id);
		if (!tpl) return;
		const filled = applyVars(tpl.body, {
			chapterName: ctx.data?.chapter?.name,
			chapterCity: ctx.data?.chapter?.city,
			date: item.start_at,
			location: item.location,
			address: item.address,
			officers: ctx.data?.officers
		});
		setAta(filled);
	}
	const st = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm font-medium text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-4 w-4" }),
						" Ata da sessão",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-full px-2 py-0.5 text-[11px] font-medium",
							style: {
								backgroundColor: st.bg,
								color: st.color
							},
							children: MINUTE_STATUS_LABELS[status] ?? status
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						size: "sm",
						disabled: exporting || !ata.trim(),
						onClick: async () => {
							setExporting(true);
							try {
								const { exportMinutePdf } = await import("./minute-pdf-D3g6DTBA.mjs");
								await exportMinutePdf({
									chapterName: active?.chapter.name ?? "",
									chapterCity: active?.chapter.city,
									logoPath: active?.chapter.logo_url,
									title: item.title,
									dateISO: item.start_at,
									status: MINUTE_STATUS_LABELS[status] ?? status,
									signatures: SIGNER_ROLES.filter((r) => signedRoles.has(r)).map((r) => SIGNER_LABELS[r]),
									content: ata
								});
							} catch (e) {
								toast.error(e?.message ?? "Erro ao gerar o PDF");
							} finally {
								setExporting(false);
							}
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-2 h-4 w-4" }), exporting ? "Gerando…" : "Exportar PDF"]
					}), editable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: templateId,
						onValueChange: insertTemplate,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "h-9 w-[260px] text-xs",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Inserir modelo de ata…" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: (templates.data ?? []).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: t.id,
							children: t.name
						}, t.id)) })]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				value: ata,
				onChange: (e) => setAta(e.target.value),
				rows: 18,
				readOnly: !editable,
				className: "text-sm leading-relaxed",
				placeholder: "Selecione um modelo de ata ou escreva livremente."
			}),
			editable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-muted-foreground",
				children: [
					"Variáveis dinâmicas: ",
					AVAILABLE_VARS.join(" · "),
					" — as não reconhecidas permanecem entre colchetes para preenchimento manual."
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center justify-end gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mr-auto text-xs text-muted-foreground",
						children: minutes?.updated_at ? `Última alteração: ${formatDateTimeBR(minutes.updated_at)}` : "Ainda não salva"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						disabled: save.isPending,
						onClick: () => save.mutate(ata),
						children: save.isPending ? "Salvando…" : "Salvar rascunho"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						style: { backgroundColor: "var(--chapter-primary)" },
						disabled: conclude.isPending || !ata.trim(),
						onClick: () => conclude.mutate(),
						children: conclude.isPending ? "Concluindo…" : "Concluir ata"
					})
				]
			})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 flex items-center gap-1.5 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-3.5 w-3.5" }), " Texto bloqueado. Reabra a ata para corrigir."]
			}),
			minutes && status !== "rascunho" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 border-t border-border pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center gap-2 text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Signature, { className: "h-4 w-4" }), " Assinaturas obrigatórias"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-2",
						children: SIGNER_ROLES.map((r) => {
							const signed = signedRoles.has(r);
							const canSign = roleName === "admin_total" || roleName === r;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-3 rounded-[8px] border border-border p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-2 text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
										className: "h-4 w-4",
										style: { color: signed ? "#047857" : "var(--muted-foreground)" }
									}), SIGNER_LABELS[r]]
								}), signed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									style: {
										backgroundColor: "#D1FAE5",
										color: "#047857"
									},
									children: "Assinada"
								}) : canSign ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "outline",
									disabled: sign.isPending,
									onClick: () => sign.mutate(r),
									children: "Assinar"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: "Pendente"
								})]
							}, r);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex justify-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							disabled: reopen.isPending,
							onClick: () => reopen.mutate(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "mr-2 h-4 w-4" }), reopen.isPending ? "Reabrindo…" : "Reabrir para correção"]
						})
					}),
					status === "aprovada" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs",
						style: { color: "#047857" },
						children: "Ata aprovada pelos três responsáveis."
					})
				]
			})
		]
	});
}
var ongoingQO = (id) => queryOptions({
	queryKey: ["ongoing", id],
	queryFn: () => getOngoing({ data: { calendarEventId: id } }),
	refetchInterval: 3e4
});
function OngoingPage() {
	const { id } = Route.useParams();
	const { active } = useActiveChapter();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { data } = useSuspenseQuery(ongoingQO(id));
	const [search, setSearch] = (0, import_react.useState)("");
	const allowed = canManageAttendance(active?.role.name);
	const item = data.item;
	const recordMap = (0, import_react.useMemo)(() => {
		const m = /* @__PURE__ */ new Map();
		for (const r of data.records) m.set(r.member_id, r);
		return m;
	}, [data.records]);
	const mark = useMutation({
		mutationFn: (v) => setAttendance({ data: {
			chapterId: item.chapter_id,
			calendarEventId: id,
			memberId: v.memberId,
			status: v.status,
			justification: v.justification ?? recordMap.get(v.memberId)?.justification ?? null
		} }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["ongoing", id] }),
		onError: (e) => toast.error(e?.message ?? "Erro ao registrar")
	});
	if (!allowed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "rounded-[12px] p-6 text-sm text-muted-foreground",
		children: "Você não tem permissão para conduzir a chamada desta sessão."
	});
	const meta = TYPE_META[item.event_type];
	const members = data.members.filter((m) => m.full_name.toLowerCase().includes(search.trim().toLowerCase()));
	const presentes = data.records.filter((r) => r.status === "presente").length;
	const ausentes = data.records.filter((r) => r.status === "ausente").length;
	const pendentes = data.members.length - presentes - ausentes;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: item.title,
			subtitle: `${meta?.label ?? item.event_type} · ${formatDateTimeBR(item.start_at)}${item.mandatory ? " · Obrigatório" : " · Facultativo"}`,
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "outline",
				onClick: () => navigate({ to: "/calendario" }),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Calendário"]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 grid grid-cols-3 gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Counter, {
					label: "Presentes",
					value: presentes,
					color: "#047857"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Counter, {
					label: "Ausentes",
					value: ausentes,
					color: "#B91C1C"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Counter, {
					label: "Pendentes",
					value: Math.max(0, pendentes),
					color: "#6B6B6B"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
			defaultValue: "chamada",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
					className: "mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "chamada",
						children: "Chamada"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "ata",
						children: "Ata"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
					value: "chamada",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative mb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "pl-9",
								placeholder: "Buscar membro…",
								value: search,
								onChange: (e) => setSearch(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							className: "rounded-[12px] p-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "divide-y divide-border",
								children: [members.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "p-5 text-sm text-muted-foreground",
									children: "Nenhum membro ativo encontrado."
								}), members.map((m) => {
									const rec = recordMap.get(m.id);
									const pendingThis = mark.isPending && mark.variables?.memberId === m.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "group p-3 transition-colors duration-200",
										style: { backgroundColor: rec?.status === "presente" ? "rgba(4,120,87,0.05)" : rec?.status === "ausente" ? "rgba(185,28,28,0.05)" : void 0 },
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex min-w-0 items-center gap-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "h-2 w-2 shrink-0 rounded-full transition-colors duration-200",
														style: { backgroundColor: rec?.status === "presente" ? "#047857" : rec?.status === "ausente" ? "#B91C1C" : "var(--border)" }
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "min-w-0 truncate text-sm font-medium",
														children: m.full_name
													}),
													pendingThis && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" })
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex shrink-0 gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													"aria-label": "Presente",
													"aria-pressed": rec?.status === "presente",
													disabled: pendingThis,
													onClick: () => mark.mutate({
														memberId: m.id,
														status: "presente"
													}),
													className: "grid h-11 w-11 place-items-center rounded-[8px] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#047857] hover:bg-[#ECFDF5] hover:text-[#047857] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 active:translate-y-0 active:scale-95 disabled:opacity-60",
													style: rec?.status === "presente" ? {
														backgroundColor: "#D1FAE5",
														borderColor: "#047857",
														color: "#047857",
														boxShadow: "0 0 0 3px rgba(4,120,87,0.12)"
													} : {
														borderColor: "var(--border)",
														color: "var(--muted-foreground)"
													},
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: `h-5 w-5 transition-transform duration-200 ${rec?.status === "presente" ? "scale-110" : "group-hover:scale-105"}` })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													"aria-label": "Ausente",
													"aria-pressed": rec?.status === "ausente",
													disabled: pendingThis,
													onClick: () => mark.mutate({
														memberId: m.id,
														status: "ausente"
													}),
													className: "grid h-11 w-11 place-items-center rounded-[8px] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#B91C1C] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]/40 active:translate-y-0 active:scale-95 disabled:opacity-60",
													style: rec?.status === "ausente" ? {
														backgroundColor: "#FEE2E2",
														borderColor: "#B91C1C",
														color: "#B91C1C",
														boxShadow: "0 0 0 3px rgba(185,28,28,0.12)"
													} : {
														borderColor: "var(--border)",
														color: "var(--muted-foreground)"
													},
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: `h-5 w-5 transition-transform duration-200 ${rec?.status === "ausente" ? "scale-110" : "group-hover:scale-105"}` })
												})]
											})]
										}), rec?.status === "ausente" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											className: "mt-2 h-9 animate-fade-in text-xs",
											placeholder: "Justificativa (opcional)",
											defaultValue: rec.justification ?? "",
											onBlur: (e) => mark.mutate({
												memberId: m.id,
												status: "ausente",
												justification: e.target.value.trim() || null
											})
										})]
									}, m.id);
								})]
							})
						}),
						!item.mandatory && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-xs text-muted-foreground",
							children: "Este item é facultativo: as presenças ficam registradas, mas não impactam a frequência."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
					value: "ata",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MinutesPanel, {
						chapterId: item.chapter_id,
						calendarEventId: id,
						item: {
							title: item.title,
							start_at: item.start_at,
							location: item.location,
							address: item.address ?? null
						},
						minutes: data.minutes ?? null,
						roleName: active?.role.name ?? null,
						onChanged: () => qc.invalidateQueries({ queryKey: ["ongoing", id] })
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 text-xs text-muted-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/presencas",
				style: { color: "var(--chapter-primary)" },
				children: "Ver módulo de Presenças"
			})
		})
	] });
}
function Counter({ label, value, color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-4 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-2xl font-bold",
			style: { color },
			children: value
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-muted-foreground",
			children: label
		})]
	});
}
//#endregion
export { OngoingPage as component };
