import { a as __toESM } from "../_runtime.mjs";
import { t as formatBRL } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { S as Receipt } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { a as generateDues, d as listDues, m as upsertDue } from "./finance.functions-CIZoOWjJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tesouraria.mensalidades-Q4SxHOnK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DUE_LABELS = {
	em_aberto: "Em aberto",
	pago: "Pago",
	isento: "Isento"
};
function Mensalidades() {
	const { active } = useActiveChapter();
	const qc = useQueryClient();
	const now = /* @__PURE__ */ new Date();
	const [year, setYear] = (0, import_react.useState)(now.getFullYear());
	const [month, setMonth] = (0, import_react.useState)(now.getMonth() + 1);
	const [defaultAmount, setDefaultAmount] = (0, import_react.useState)(50);
	const [paidAt, setPaidAt] = (0, import_react.useState)((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
	const writable = can(active?.role.name, "tesouraria");
	const { data, isLoading } = useQuery({
		queryKey: [
			"dues",
			active?.chapter_id,
			year,
			month
		],
		enabled: !!active,
		queryFn: () => listDues({ data: {
			chapterId: active.chapter_id,
			year,
			month
		} })
	});
	const members = data?.members ?? [];
	const dues = data?.dues ?? [];
	const byMember = (0, import_react.useMemo)(() => new Map(dues.map((d) => [d.member_id, d])), [dues]);
	const totals = (0, import_react.useMemo)(() => {
		let paid = 0;
		let openAmount = 0;
		for (const d of dues) if (d.status === "pago") paid += Number(d.amount);
		else if (d.status === "em_aberto") openAmount += Number(d.amount);
		return {
			paid,
			openAmount
		};
	}, [dues]);
	const setStatus = useMutation({
		mutationFn: (v) => upsertDue({ data: {
			chapterId: active.chapter_id,
			memberId: v.memberId,
			year,
			month,
			amount: v.amount,
			status: v.status,
			paidAt
		} }),
		onSuccess: async (_r, v) => {
			if (v.status === "pago") toast.success("Pagamento registrado no fluxo de caixa");
			await qc.invalidateQueries({ queryKey: ["dues"] });
			await qc.invalidateQueries({ queryKey: ["cash-entries"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao atualizar")
	});
	const generate = useMutation({
		mutationFn: () => generateDues({ data: {
			chapterId: active.chapter_id,
			year,
			month,
			amount: defaultAmount
		} }),
		onSuccess: async (r) => {
			toast.success(`${r.created} mensalidades geradas`);
			await qc.invalidateQueries({ queryKey: ["dues"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao gerar")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Mensalidades",
			subtitle: "Cobrança apenas de membros ativos — Senior DeMolay e Maçom são isentos."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-wrap items-end gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: String(month),
					onValueChange: (v) => setMonth(Number(v)),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "w-40",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: Array.from({ length: 12 }, (_, i) => i + 1).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: String(m),
						children: new Date(2e3, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" })
					}, m)) })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: String(year),
					onValueChange: (v) => setYear(Number(v)),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "w-28",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: [
						now.getFullYear() + 1,
						now.getFullYear(),
						now.getFullYear() - 1
					].map((y) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: String(y),
						children: y
					}, y)) })]
				}),
				writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-xs text-muted-foreground",
						children: "Valor padrão"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						step: "0.01",
						className: "w-32",
						value: defaultAmount,
						onChange: (e) => setDefaultAmount(Number(e.target.value))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1.5 block text-xs text-muted-foreground",
						children: "Data do pagamento"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "date",
						className: "w-44",
						value: paidAt,
						onChange: (e) => setPaidAt(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => generate.mutate(),
						disabled: generate.isPending,
						style: { backgroundColor: active?.chapter.primary_color },
						children: "Gerar competência"
					})
				] })
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-6 grid grid-cols-2 gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm text-muted-foreground",
					children: "Recebido"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xl font-bold text-emerald-600 dark:text-emerald-400",
					children: formatBRL(totals.paid)
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm text-muted-foreground",
					children: "Em aberto"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xl font-bold text-amber-600 dark:text-amber-400",
					children: formatBRL(totals.openAmount)
				})]
			})]
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Receipt, { className: "h-7 w-7" }),
			title: "Nenhum membro ativo",
			description: "Apenas membros com status Ativo geram mensalidade."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "divide-y divide-border rounded-[12px]",
			children: members.map((m) => {
				const due = byMember.get(m.id);
				const status = due?.status ?? "em_aberto";
				const amount = Number(due?.amount ?? defaultAmount);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3 px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium",
								children: m.full_name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground",
								children: formatBRL(amount)
							})]
						}),
						!due && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "sem lançamento"
						}),
						writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: status,
							onValueChange: (v) => setStatus.mutate({
								memberId: m.id,
								status: v,
								amount
							}),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: "h-11 w-36",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: "em_aberto",
									children: "Em aberto"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: "pago",
									children: "Pago"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: "isento",
									children: "Isento"
								})
							] })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: "secondary",
							children: DUE_LABELS[status]
						})
					]
				}, m.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 text-xs text-muted-foreground",
			children: [
				"Ao marcar como ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Pago" }),
				", o sistema lança automaticamente uma entrada no fluxo de caixa na categoria “Mensalidades”."
			]
		})
	] });
}
//#endregion
export { Mensalidades as component };
