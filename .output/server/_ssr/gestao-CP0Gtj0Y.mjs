import { a as __toESM } from "../_runtime.mjs";
import { o as grauOf, s as is21OrOlder } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { n as queryOptions, o as useQueryClient, r as useSuspenseQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { a as UserPlus, l as Trash2 } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-CCJRliUM.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, n as DialogContent, o as DialogTitle, s as DialogTrigger, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { a as listChapterPositions, c as removePosition, i as listCatalog, n as assignPosition, o as listCommissionMembers, s as removeCommissionMember, t as assignCommissionMember } from "./organization.functions-VBOyTKjU.mjs";
import { r as listMembers } from "./members.functions-DeZwihqx.mjs";
import { n as membersListKey } from "./query-keys-Cpoprrf-.mjs";
import { n as termLabel, r as termOptions, t as currentTerm } from "./terms-DRv0pA-p.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gestao-CP0Gtj0Y.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var COMMISSION_ROLES = [
	{
		value: "presidente",
		label: "Presidente"
	},
	{
		value: "vice",
		label: "Vice"
	},
	{
		value: "membro",
		label: "Membro"
	},
	{
		value: "auxiliar_senior",
		label: "Auxiliar Sênior"
	}
];
var catalogQO = queryOptions({
	queryKey: ["org-catalog"],
	queryFn: () => listCatalog()
});
function GestaoPage() {
	const { active } = useActiveChapter();
	const qc = useQueryClient();
	const [term, setTerm] = (0, import_react.useState)(currentTerm());
	const chapterId = active?.chapter_id ?? "";
	const canEdit = can(active?.role.name, "secretaria");
	const canEditCommissions = can(active?.role.name, "comissoes");
	const { data: catalog } = useSuspenseQuery(catalogQO);
	const { data: members } = useSuspenseQuery(queryOptions({
		queryKey: membersListKey(chapterId, "", "all"),
		queryFn: () => listMembers({ data: {
			chapterId,
			search: "",
			status: "all"
		} })
	}));
	const { data: positions } = useSuspenseQuery(queryOptions({
		queryKey: [
			"chapter-positions",
			chapterId,
			term.year,
			term.semester
		],
		queryFn: () => listChapterPositions({ data: {
			chapterId,
			year: term.year,
			semester: term.semester
		} })
	}));
	const { data: commissionMembers } = useSuspenseQuery(queryOptions({
		queryKey: [
			"commission-members",
			chapterId,
			term.year,
			term.semester
		],
		queryFn: () => listCommissionMembers({ data: {
			chapterId,
			year: term.year,
			semester: term.semester
		} })
	}));
	function invalidate() {
		qc.invalidateQueries({ queryKey: ["chapter-positions"] });
		qc.invalidateQueries({ queryKey: ["commission-members"] });
	}
	const assignPos = useMutation({
		mutationFn: (v) => assignPosition({ data: {
			chapterId,
			year: term.year,
			semester: term.semester,
			...v
		} }),
		onSuccess: () => {
			toast.success("Cargo designado");
			invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Não foi possível designar")
	});
	const delPos = useMutation({
		mutationFn: (id) => removePosition({ data: { id } }),
		onSuccess: () => {
			toast.success("Designação removida");
			invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const assignCom = useMutation({
		mutationFn: (v) => assignCommissionMember({ data: {
			chapterId,
			year: term.year,
			semester: term.semester,
			...v
		} }),
		onSuccess: () => {
			toast.success("Participação registrada");
			invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const delCom = useMutation({
		mutationFn: (id) => removeCommissionMember({ data: { id } }),
		onSuccess: () => {
			toast.success("Participação removida");
			invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const byPosition = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		positions.forEach((p) => map.set(p.position_id, p));
		return map;
	}, [positions]);
	const eligibleForChapter = members.filter((m) => grauOf(m).code === "DM");
	const eligibleForConselho = members.filter((m) => is21OrOlder(m.birth_date));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Gestão",
		subtitle: "Cargos do capítulo e comissões por vigência.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
			value: `${term.year}-${term.semester}`,
			onValueChange: (v) => {
				const [y, s] = v.split("-");
				setTerm({
					year: Number(y),
					semester: Number(s)
				});
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
				className: "w-[200px]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: termOptions().map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
				value: `${t.year}-${t.semester}`,
				children: termLabel(t.year, t.semester)
			}, `${t.year}-${t.semester}`)) })]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		defaultValue: "cargos",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "mb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
					value: "cargos",
					children: "Cargos"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
					value: "comissoes",
					children: "Comissões"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "cargos",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-1 gap-4 lg:grid-cols-2",
					children: ["capitulo", "consultivo"].map((scope) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "rounded-[12px] p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mb-3 text-sm font-semibold text-muted-foreground",
							children: scope === "capitulo" ? "Cargos do Capítulo" : "Conselho Consultivo"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "divide-y divide-border text-sm",
							children: catalog.positions.filter((p) => p.scope === scope).map((p) => {
								const assigned = byPosition.get(p.id);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between gap-2 py-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "font-medium",
											children: p.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "truncate text-xs text-muted-foreground",
											children: assigned?.member?.full_name ?? "Vago"
										})]
									}), canEdit && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex shrink-0 items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignDialog, {
											title: `Designar ${p.label}`,
											members: scope === "consultivo" ? eligibleForConselho : eligibleForChapter,
											emptyHint: scope === "consultivo" ? "Nenhum membro com 21 anos ou mais." : "Nenhum membro com grau DM.",
											onConfirm: (memberId) => assignPos.mutate({
												memberId,
												positionId: p.id
											})
										}), assigned && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "icon",
											variant: "ghost",
											onClick: () => delPos.mutate(assigned.id),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
										})]
									})]
								}, p.id);
							})
						})]
					}, scope))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "comissoes",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-1 gap-4 md:grid-cols-2",
					children: catalog.commissions.map((c) => {
						const rows = commissionMembers.filter((cm) => cm.commission_id === c.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "rounded-[12px] p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-3 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-semibold",
									children: c.label
								}), canEditCommissions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignDialog, {
									title: `Adicionar em ${c.label}`,
									members,
									withRole: true,
									onConfirm: (memberId, role) => assignCom.mutate({
										memberId,
										commissionId: c.id,
										role
									})
								})]
							}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: "Nenhum participante nesta vigência."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "divide-y divide-border text-sm",
								children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between gap-2 py-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 truncate",
										children: r.member?.full_name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex shrink-0 items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "secondary",
											children: COMMISSION_ROLES.find((x) => x.value === r.role)?.label ?? r.role
										}), canEditCommissions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "icon",
											variant: "ghost",
											onClick: () => delCom.mutate(r.id),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
										})]
									})]
								}, r.id))
							})]
						}, c.id);
					})
				})
			})
		]
	})] });
}
function AssignDialog({ title, members, withRole, emptyHint, onConfirm }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [memberId, setMemberId] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("membro");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "icon",
				variant: "ghost",
				"aria-label": title,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "h-4 w-4" })
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }) }), members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: emptyHint ?? "Nenhum membro elegível."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1.5 block text-sm",
					children: "Membro"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: memberId,
					onValueChange: setMemberId,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione um membro" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: m.id,
						children: m.full_name
					}, m.id)) })]
				})] }),
				withRole && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					className: "mb-1.5 block text-sm",
					children: "Cargo na comissão"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: role,
					onValueChange: setRole,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: COMMISSION_ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: r.value,
						children: r.label
					}, r.value)) })]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full",
					onClick: () => {
						if (!memberId) return;
						onConfirm(memberId, withRole ? role : void 0);
						setOpen(false);
						setMemberId("");
					},
					children: "Confirmar"
				})
			]
		})] })]
	});
}
//#endregion
export { GestaoPage as component };
