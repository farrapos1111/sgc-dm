import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { E as Pencil, T as Plus } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { t as Switch } from "./switch-Cn1w-cIH.mjs";
import { a as listScopeChapters, i as listRegions, l as setChapterActive, s as saveChapter, u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
import { n as ScopeGuard } from "./regional.index-CmkLbDal.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/regional.capitulos-z5LH02q1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EMPTY = {
	name: "",
	number: "",
	city: "",
	region_id: null
};
function ManageChapters() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScopeGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChaptersContent, {}) });
}
function ChaptersContent() {
	const { activeScope, leaderships } = useOrgScope();
	const scope = activeScope;
	const qc = useQueryClient();
	const [draft, setDraft] = (0, import_react.useState)(null);
	const stateId = leaderships.find((l) => l.org_role === "gme")?.state_id ?? leaderships.find((l) => (l.region_id ?? l.state_id) === scope.id)?.state_id ?? null;
	const canManage = leaderships.some((l) => l.org_role === "gme");
	const { data: chapters, isLoading } = useQuery({
		queryKey: ["scope-chapters", scope.key],
		queryFn: () => listScopeChapters({ data: {
			scopeType: scope.type,
			scopeId: scope.id
		} })
	});
	const { data: regions } = useQuery({
		queryKey: ["regions", stateId],
		queryFn: () => listRegions({ data: { stateId } }),
		enabled: !!stateId
	});
	const save = useMutation({
		mutationFn: (d) => saveChapter({ data: {
			id: d.id,
			state_id: stateId,
			region_id: d.region_id,
			name: d.name,
			number: d.number,
			city: d.city || null
		} }),
		onSuccess: () => {
			toast.success("Instituição salva");
			setDraft(null);
			qc.invalidateQueries({ queryKey: ["scope-chapters"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const toggleActive = useMutation({
		mutationFn: (v) => setChapterActive({ data: v }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["scope-chapters"] }),
		onError: (e) => toast.error(e.message)
	});
	if (!canManage) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "rounded-[12px] p-6 text-sm text-muted-foreground",
		children: "Apenas o Grande Mestre Estadual pode gerenciar instituições."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Instituições",
				subtitle: scope.label,
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					onClick: () => setDraft({ ...EMPTY }),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 h-4 w-4" }), " Nova"]
				})
			}),
			isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-muted-foreground",
				children: "Carregando…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: (chapters ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex items-center gap-3 rounded-[12px] p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-xs font-bold text-white",
							style: { backgroundColor: c.primary_color || "#9E1B32" },
							children: c.number.slice(-3)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-semibold",
								children: c.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "truncate text-xs text-muted-foreground",
								children: [
									"Nº ",
									c.number,
									c.city ? ` · ${c.city}` : "",
									c.region_name ? ` · ${c.region_name}` : " · sem região"
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex shrink-0 items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: c.active,
								onCheckedChange: (v) => toggleActive.mutate({
									id: c.id,
									active: v
								}),
								"aria-label": "Instituição ativa"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "sm",
								onClick: () => setDraft({
									id: c.id,
									name: c.name,
									number: c.number,
									city: c.city ?? "",
									region_id: c.region_id
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-4 w-4" })
							})]
						})
					]
				}, c.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: !!draft,
				onOpenChange: (o) => !o && setDraft(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "sm:max-w-md",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: draft?.id ? "Editar instituição" : "Nova instituição" }) }),
						draft && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "ch-name",
									children: "Nome"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "ch-name",
									value: draft.name,
									onChange: (e) => setDraft({
										...draft,
										name: e.target.value
									})
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "ch-number",
										children: "Número"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "ch-number",
										value: draft.number,
										onChange: (e) => setDraft({
											...draft,
											number: e.target.value
										})
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "ch-city",
										children: "Cidade"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "ch-city",
										value: draft.city,
										onChange: (e) => setDraft({
											...draft,
											city: e.target.value
										})
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Região" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
									value: draft.region_id ?? "none",
									onValueChange: (v) => setDraft({
										...draft,
										region_id: v === "none" ? null : v
									}),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: "none",
										children: "Sem região"
									}), (regions ?? []).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: r.id,
										children: r.name
									}, r.id))] })]
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setDraft(null),
							children: "Cancelar"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: !draft?.name || !draft?.number || !stateId || save.isPending,
							onClick: () => draft && save.mutate(draft),
							children: "Salvar"
						})] })
					]
				})
			})
		]
	});
}
//#endregion
export { ManageChapters as component };
