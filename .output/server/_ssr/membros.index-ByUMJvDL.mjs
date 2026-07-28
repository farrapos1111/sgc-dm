import { a as __toESM } from "../_runtime.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as isAptoGrauDemolay, f as statusLabel, o as grauOf, r as formatDateBR } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { o as keepPreviousData } from "../_libs/tanstack__query-core.mjs";
import { i as useQuery, n as queryOptions } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { _ as Search, i as Users, rt as CirclePlus } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { r as listMembers } from "./members.functions-DeZwihqx.mjs";
import { n as membersListKey } from "./query-keys-Cpoprrf-.mjs";
import { t as PageSkeleton } from "./PageSkeleton-ZHfLWY70.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/membros.index-ByUMJvDL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var membersQO = (chapterId, search, status) => queryOptions({
	queryKey: membersListKey(chapterId, search, status),
	queryFn: () => listMembers({ data: {
		chapterId,
		search,
		status
	} })
});
function MembrosList() {
	const { active } = useActiveChapter();
	if (!active) return null;
	const [searchInput, setSearchInput] = (0, import_react.useState)("");
	const [searchDebounced, setSearchDebounced] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("all");
	(0, import_react.useEffect)(() => {
		const handle = window.setTimeout(() => setSearchDebounced(searchInput), 300);
		return () => window.clearTimeout(handle);
	}, [searchInput]);
	const { data: members = [], isPending, isFetching } = useQuery({
		...membersQO(active.chapter_id, searchDebounced, status),
		placeholderData: keepPreviousData
	});
	const isAdmin = can(active.role.name, "secretaria") || can(active.role.name, "conselho") || can(active.role.name, "admin");
	if (isPending && members.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageSkeleton, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: isFetching ? "opacity-80 transition-opacity" : void 0,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Membros",
				subtitle: `${members.length} ${members.length === 1 ? "membro" : "membros"}`,
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					style: { backgroundColor: active.chapter.primary_color },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/membros/novo",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Novo membro"]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Buscar por nome…",
						className: "pl-9",
						value: searchInput,
						onChange: (e) => setSearchInput(e.target.value)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: status,
					onValueChange: (v) => setStatus(v),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "all",
							children: "Todos os status"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "ativo",
							children: "Ativo"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "inativo",
							children: "Inativo"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "senior",
							children: "Senior DeMolay"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: "macom",
							children: "Maçom"
						})
					] })]
				})]
			}),
			members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "h-7 w-7" }),
				title: "Nenhum membro encontrado",
				description: "Cadastre o primeiro membro do capítulo.",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					style: { backgroundColor: active.chapter.primary_color },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/membros/novo",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), " Cadastrar membro"]
					})
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-2 md:grid-cols-2",
				children: members.map((m) => {
					const grau = grauOf(m);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/membros/$id",
						params: { id: m.id },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							className: "rounded-[12px] p-4 transition-colors hover:bg-muted/40",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "truncate font-medium",
										children: m.full_name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-xs text-muted-foreground",
										children: [
											m.email || m.phone || "—",
											" · Nasc. ",
											formatDateBR(m.birth_date)
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex shrink-0 items-center gap-1.5",
									children: [
										isAdmin && isAptoGrauDemolay(m) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											className: "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/20",
											children: "Apto a G∴D∴"
										}),
										grau.code && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "outline",
											children: grau.code
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "secondary",
											children: statusLabel(m.status)
										})
									]
								})]
							})
						})
					}, m.id);
				})
			})
		]
	});
}
//#endregion
export { MembrosList as component };
