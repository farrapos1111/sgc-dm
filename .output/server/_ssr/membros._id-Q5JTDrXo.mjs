import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as formatRgMask, c as isAptoGrauDemolay, f as statusLabel, i as formatDateTimeBR, n as formatCpfMask, o as grauOf, r as formatDateBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { E as Pencil, T as Plus, Y as Eye, l as Trash2, m as Shield, vt as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CCJRliUM.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, n as DialogContent, o as DialogTitle, s as DialogTrigger, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { n as TYPE_META } from "./calendar-types-DWS_Rd7G.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { c as removePosition, i as listCatalog, n as assignPosition, r as getMemberOrgHistory, s as removeCommissionMember, t as assignCommissionMember } from "./organization.functions-VBOyTKjU.mjs";
import { i as revealMemberPii, n as getMember } from "./members.functions-DeZwihqx.mjs";
import { n as termLabel, r as termOptions, t as currentTerm } from "./terms-DRv0pA-p.mjs";
import { t as getMemberAttendance } from "./attendance.functions-B5vlRrhX.mjs";
import { t as Route } from "./membros._id-BLnQw5l0.mjs";
import { t as PageSkeleton } from "./PageSkeleton-ZHfLWY70.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/membros._id-Q5JTDrXo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var memberQO = (id) => queryOptions({
	queryKey: ["member", id],
	queryFn: () => getMember({ data: { id } })
});
var orgQO = (memberId) => queryOptions({
	queryKey: ["member-org", memberId],
	queryFn: () => getMemberOrgHistory({ data: { memberId } })
});
var attendanceQO = (memberId) => queryOptions({
	queryKey: ["member-attendance", memberId],
	queryFn: () => getMemberAttendance({ data: { memberId } })
});
function MembroPerfil() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const [tab, setTab] = (0, import_react.useState)("dados");
	const { data } = useSuspenseQuery(memberQO(id));
	const needsOrg = tab === "cargos";
	const needsAttendance = tab === "presencas";
	const { data: org, isPending: orgPending } = useQuery({
		...orgQO(id),
		enabled: needsOrg
	});
	const { data: attendance = [], isPending: attendancePending } = useQuery({
		...attendanceQO(id),
		enabled: needsAttendance
	});
	const { member, guardians, consents, audit } = data;
	const orgData = org ?? {
		positions: [],
		commissions: []
	};
	const mandatoryRecs = attendance.filter((r) => r.calendar_event?.mandatory);
	const mandatoryPresent = mandatoryRecs.filter((r) => r.status === "presente").length;
	const mandatoryPct = mandatoryRecs.length > 0 ? Math.round(mandatoryPresent / mandatoryRecs.length * 100) : null;
	const [revealed, setRevealed] = (0, import_react.useState)({});
	const reveal = useMutation({
		mutationFn: (field) => revealMemberPii({ data: {
			memberId: id,
			field
		} }),
		onSuccess: (res, field) => {
			setRevealed((r) => ({
				...r,
				[field]: res.value
			}));
			toast.success(`${field.toUpperCase()} revelado (auditoria registrada)`);
		},
		onError: (e) => toast.error(e?.message ?? "Sem permissão")
	});
	const qc = useQueryClient();
	const { active } = useActiveChapter();
	const roleName = active?.role.name;
	const canEditOrg = can(roleName, "conselho") || can(roleName, "secretaria");
	const isAdminView = canEditOrg || can(roleName, "admin");
	const chapterId = member.chapter_id ?? active?.chapter_id ?? "";
	const [term, setTerm] = (0, import_react.useState)(currentTerm());
	const { data: catalog } = useQuery({
		queryKey: ["org-catalog"],
		queryFn: () => listCatalog(),
		enabled: canEditOrg
	});
	function refreshOrg() {
		qc.invalidateQueries({ queryKey: ["member-org", id] });
		qc.invalidateQueries({ queryKey: ["chapter-positions"] });
		qc.invalidateQueries({ queryKey: ["commission-members"] });
	}
	const addPos = useMutation({
		mutationFn: (positionId) => assignPosition({ data: {
			chapterId,
			memberId: id,
			positionId,
			year: term.year,
			semester: term.semester
		} }),
		onSuccess: () => {
			toast.success("Perfil atualizado: cargo designado");
			refreshOrg();
		},
		onError: (e) => toast.error(e?.message ?? "Não foi possível designar")
	});
	const delPos = useMutation({
		mutationFn: (rowId) => removePosition({ data: { id: rowId } }),
		onSuccess: () => {
			toast.success("Perfil atualizado: cargo removido");
			refreshOrg();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const addCom = useMutation({
		mutationFn: (v) => assignCommissionMember({ data: {
			chapterId,
			memberId: id,
			commissionId: v.commissionId,
			role: v.role,
			year: term.year,
			semester: term.semester
		} }),
		onSuccess: () => {
			toast.success("Perfil atualizado: participação registrada");
			refreshOrg();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const delCom = useMutation({
		mutationFn: (rowId) => removeCommissionMember({ data: { id: rowId } }),
		onSuccess: () => {
			toast.success("Perfil atualizado: participação removida");
			refreshOrg();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: member.full_name,
		subtitle: `${statusLabel(member.status)} · ${grauOf(member).label}`,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "ghost",
				onClick: () => navigate({ to: "/membros" }),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Voltar"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "outline",
				onClick: () => navigate({
					to: "/membros/$id/editar",
					params: { id }
				}),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "mr-2 h-4 w-4" }), " Editar"]
			})]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		value: tab,
		onValueChange: setTab,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "dados",
						children: "Dados"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "cargos",
						children: "Cargos"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "presencas",
						children: "Presenças"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "timeline",
						children: "Linha do tempo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "financeiro",
						children: "Financeiro"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "dados",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 gap-4 md:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mb-3 text-sm font-semibold text-muted-foreground",
								children: "Identificação"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "space-y-2 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Nome",
										v: member.full_name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Nascimento",
										v: formatDateBR(member.birth_date)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Grau",
										v: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												variant: "outline",
												children: grauOf(member).label
											}), isAdminView && isAptoGrauDemolay(member) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												className: "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/20",
												children: "Apto a G∴D∴"
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Iniciação à Ordem DeMolay",
										v: formatDateBR(member.iniciacao_ordem)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Exame de Grau Iniciático",
										v: formatDateBR(member.exam_grau_iniciatico)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Iniciação ao Grau DeMolay",
										v: formatDateBR(member.iniciacao_grau_demolay)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Exame de Grau DeMolay",
										v: formatDateBR(member.exam_grau_demolay)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Status",
										v: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "secondary",
											children: statusLabel(member.status)
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted-foreground",
											children: "CPF"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
											className: "flex items-center gap-2 font-mono",
											children: [revealed.cpf ?? formatCpfMask(member.cpf_last2), !revealed.cpf && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => reveal.mutate("cpf"),
												disabled: reveal.isPending,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mr-1 h-3.5 w-3.5" }), " Revelar"]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted-foreground",
											children: "RG"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
											className: "flex items-center gap-2 font-mono",
											children: [revealed.rg ?? formatRgMask(member.rg_last2), !revealed.rg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => reveal.mutate("rg"),
												disabled: reveal.isPending,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mr-1 h-3.5 w-3.5" }), " Revelar"]
											})]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mb-3 text-sm font-semibold text-muted-foreground",
								children: "Contato"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "space-y-2 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Telefone",
										v: member.phone || "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Email",
										v: member.email || "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
										k: "Endereço",
										v: member.address && typeof member.address === "object" ? [
											member.address.street,
											member.address.city,
											member.address.state,
											member.address.zip
										].filter(Boolean).join(", ") || "—" : "—"
									})
								]
							})]
						}),
						guardians.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5 md:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mb-3 text-sm font-semibold text-muted-foreground",
								children: "Responsáveis"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-3",
								children: guardians.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-medium",
										children: [
											g.full_name,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "ml-1 text-xs text-muted-foreground",
												children: [
													"(",
													g.relationship || "—",
													")"
												]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-muted-foreground",
										children: [
											g.phone || "—",
											" · ",
											g.email || "—",
											" · CPF ",
											formatCpfMask(g.cpf_last2)
										]
									})]
								}, g.id))
							})]
						}),
						consents.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5 md:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "h-4 w-4" }), " Consentimentos LGPD"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-1.5 text-sm",
								children: consents.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Versão ", c.consent_text_version] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: formatDateTimeBR(c.signed_at)
									})]
								}, c.id))
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "cargos",
				children: orgPending && !org ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageSkeleton, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [canEditOrg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "text-sm text-muted-foreground",
						children: "Vigência para novas designações"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: `${term.year}-${term.semester}`,
						onValueChange: (v) => {
							const [y, s] = v.split("-");
							setTerm({
								year: Number(y),
								semester: Number(s)
							});
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "w-[220px]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: termOptions().map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: `${t.year}-${t.semester}`,
							children: termLabel(t.year, t.semester)
						}, `${t.year}-${t.semester}`)) })]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 gap-4 md:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "rounded-[12px] p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-semibold text-muted-foreground",
								children: "Cargos do capítulo e conselho"
							}), canEditOrg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerDialog, {
								title: "Designar cargo",
								triggerLabel: "Designar cargo",
								options: (catalog?.positions ?? []).map((p) => ({
									value: String(p.id),
									label: `${p.label} · ${p.scope === "consultivo" ? "Conselho" : "Capítulo"}`
								})),
								onConfirm: (v) => addPos.mutate(Number(v))
							})]
						}), orgData.positions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Nenhum cargo registrado."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "divide-y divide-border text-sm",
							children: orgData.positions.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-2 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.position?.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex shrink-0 items-center gap-2 text-muted-foreground",
									children: [termLabel(p.term_year, p.term_semester), canEditOrg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "icon",
										variant: "ghost",
										onClick: () => delPos.mutate(p.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
									})]
								})]
							}, p.id))
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "rounded-[12px] p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-semibold text-muted-foreground",
								children: "Histórico em comissões"
							}), canEditOrg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerDialog, {
								title: "Adicionar em comissão",
								triggerLabel: "Adicionar comissão",
								options: (catalog?.commissions ?? []).map((c) => ({
									value: String(c.id),
									label: c.label
								})),
								withRole: true,
								onConfirm: (v, role) => addCom.mutate({
									commissionId: Number(v),
									role: role ?? "membro"
								})
							})]
						}), orgData.commissions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Nenhuma participação registrada."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "divide-y divide-border text-sm",
							children: orgData.commissions.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-2 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									c.commission?.label,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "secondary",
										className: "ml-1",
										children: COMMISSION_ROLE_LABELS[c.role] ?? c.role
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex shrink-0 items-center gap-2 text-muted-foreground",
									children: [termLabel(c.term_year, c.term_semester), canEditOrg && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "icon",
										variant: "ghost",
										onClick: () => delCom.mutate(c.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
									})]
								})]
							}, c.id))
						})]
					})]
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "presencas",
				children: attendancePending && tab === "presencas" && attendance.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageSkeleton, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "mb-4 rounded-[12px] p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-medium text-muted-foreground",
						children: "Frequência em itens obrigatórios"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-baseline gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-3xl font-bold",
							style: { color: mandatoryPct === null ? "var(--muted-foreground)" : mandatoryPct >= 75 ? "#047857" : "#B91C1C" },
							children: mandatoryPct === null ? "—" : `${mandatoryPct}%`
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm text-muted-foreground",
							children: [
								mandatoryPresent,
								" de ",
								mandatoryRecs.length,
								" contabilizáveis"
							]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "rounded-[12px] p-0",
					children: attendance.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-5 text-sm text-muted-foreground",
						children: "Nenhum registro de presença ainda."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "divide-y divide-border",
						children: attendance.map((r) => {
							const ev = r.calendar_event;
							const meta = ev ? TYPE_META[ev.event_type] : void 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: ev?.title ?? "Item removido"
										}),
										meta && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
											style: {
												backgroundColor: meta.bg,
												color: meta.color
											},
											children: meta.label
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: ev?.mandatory ? "default" : "secondary",
											children: ev?.mandatory ? "Contabilizável" : "Facultativo"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-auto text-xs font-semibold",
											style: { color: r.status === "presente" ? "#047857" : "#B91C1C" },
											children: r.status === "presente" ? "Presente" : "Ausente"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [formatDateTimeBR(ev?.start_at), r.justification ? ` · Justificativa: ${r.justification}` : ""]
								})]
							}, r.id);
						})
					})
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "timeline",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "rounded-[12px] p-5",
					children: audit.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: "Nenhum evento registrado ainda."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-2 text-sm",
						children: audit.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between border-b border-border pb-2 last:border-b-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: a.action === "pii_reveal" ? `Revelação de ${a.new_value?.field?.toUpperCase() ?? "PII"}` : a.action }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: formatDateTimeBR(a.created_at)
							})]
						}, a.id))
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "financeiro",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "rounded-[12px] p-5 text-sm text-muted-foreground",
					children: "Extrato financeiro do membro será liberado em breve."
				})
			})
		]
	})] });
}
function PickerDialog({ title, triggerLabel, options, withRole, onConfirm }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [value, setValue] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("membro");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1.5 h-4 w-4" }),
					" ",
					triggerLabel
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }) }), options.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "Nada disponível."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1.5 block text-sm",
					children: "Selecione"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value,
					onValueChange: setValue,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Escolha uma opção" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: o.value,
						children: o.label
					}, o.value)) })]
				})] }),
				withRole && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1.5 block text-sm",
					children: "Cargo na comissão"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: role,
					onValueChange: setRole,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: Object.entries(COMMISSION_ROLE_LABELS).map(([v, l]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: v,
						children: l
					}, v)) })]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full",
					onClick: () => {
						if (!value) return;
						onConfirm(value, withRole ? role : void 0);
						setOpen(false);
						setValue("");
					},
					children: "Confirmar"
				})
			]
		})] })]
	});
}
var COMMISSION_ROLE_LABELS = {
	presidente: "Presidente",
	vice: "Vice",
	membro: "Membro",
	auxiliar_senior: "Auxiliar Sênior"
};
function Row({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-muted-foreground",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: v })]
	});
}
//#endregion
export { MembroPerfil as component };
