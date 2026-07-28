import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { E as Pencil, T as Plus, l as Trash2 } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { a as listScopeChapters, c as saveRegion, i as listRegions, r as deleteRegion, u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
import { n as ScopeGuard } from "./regional.index-CmkLbDal.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/regional.regioes-qBF3YSYs.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ManageRegions() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScopeGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RegionsContent, {}) });
}
function RegionsContent() {
	const { activeScope, leaderships } = useOrgScope();
	const scope = activeScope;
	const qc = useQueryClient();
	const [draft, setDraft] = (0, import_react.useState)(null);
	const gme = leaderships.find((l) => l.org_role === "gme");
	const stateId = gme?.state_id ?? null;
	const { data: regions, isLoading } = useQuery({
		queryKey: ["regions", stateId],
		queryFn: () => listRegions({ data: { stateId } }),
		enabled: !!stateId
	});
	const { data: chapters } = useQuery({
		queryKey: ["scope-chapters", scope.key],
		queryFn: () => listScopeChapters({ data: {
			scopeType: scope.type,
			scopeId: scope.id
		} })
	});
	const save = useMutation({
		mutationFn: (d) => saveRegion({ data: {
			id: d.id,
			state_id: stateId,
			name: d.name,
			code: d.code || null
		} }),
		onSuccess: () => {
			toast.success("Região salva");
			setDraft(null);
			qc.invalidateQueries({ queryKey: ["regions"] });
		},
		onError: (e) => toast.error(e.message)
	});
	const remove = useMutation({
		mutationFn: (id) => deleteRegion({ data: { id } }),
		onSuccess: () => {
			toast.success("Região removida");
			qc.invalidateQueries({ queryKey: ["regions"] });
			qc.invalidateQueries({ queryKey: ["scope-chapters"] });
		},
		onError: (e) => toast.error(e.message)
	});
	if (!gme) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "rounded-[12px] p-6 text-sm text-muted-foreground",
		children: "Apenas o Grande Mestre Estadual pode gerenciar regiões."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Regiões",
				subtitle: gme.state_name ?? "Estado",
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					onClick: () => setDraft({
						name: "",
						code: ""
					}),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 h-4 w-4" }), " Nova"]
				})
			}),
			isLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm text-muted-foreground",
				children: "Carregando…"
			}),
			!isLoading && (regions ?? []).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-8 text-center text-sm text-muted-foreground",
				children: "Nenhuma região cadastrada."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: (regions ?? []).map((r) => {
					const count = (chapters ?? []).filter((c) => c.region_id === r.id).length;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "flex items-center gap-3 rounded-[12px] p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate text-sm font-semibold",
									children: r.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xs text-muted-foreground",
									children: [
										r.code ? `${r.code} · ` : "",
										count,
										" instituição(ões)"
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "sm",
								onClick: () => setDraft({
									id: r.id,
									name: r.name,
									code: r.code ?? ""
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-4 w-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "sm",
								className: "text-destructive",
								disabled: count > 0,
								title: count > 0 ? "Remova as instituições da região primeiro" : "Excluir região",
								onClick: () => remove.mutate(r.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
							})
						]
					}, r.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: !!draft,
				onOpenChange: (o) => !o && setDraft(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "sm:max-w-md",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: draft?.id ? "Editar região" : "Nova região" }) }),
						draft && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rg-name",
								children: "Nome"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "rg-name",
								value: draft.name,
								onChange: (e) => setDraft({
									...draft,
									name: e.target.value
								})
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rg-code",
								children: "Sigla / código"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "rg-code",
								value: draft.code,
								onChange: (e) => setDraft({
									...draft,
									code: e.target.value
								})
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setDraft(null),
							children: "Cancelar"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: !draft?.name || !stateId || save.isPending,
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
export { ManageRegions as component };
