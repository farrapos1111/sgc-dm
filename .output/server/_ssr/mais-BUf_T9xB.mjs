import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { M as LogOut, gt as BookOpen, h as Settings, mt as Building2, x as Repeat, z as Landmark } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mais-BUf_T9xB.js
var import_jsx_runtime = require_jsx_runtime();
function MaisPage() {
	const { active, memberships } = useActiveChapter();
	const navigate = useNavigate();
	async function signOut() {
		if (typeof window !== "undefined") window.localStorage.removeItem("sgcdm.activeChapterId");
		await supabase.auth.signOut();
		window.location.assign("/auth");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Mais",
		subtitle: "Preferências e sessão."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "h-5 w-5" }), " Capítulo ativo"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-base font-semibold",
						children: active?.chapter.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-sm text-muted-foreground",
						children: [
							"Nº ",
							active?.chapter.number,
							" · ",
							active?.role.label
						]
					}),
					memberships.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						className: "mt-4",
						onClick: () => navigate({ to: "/selecionar-capitulo" }),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Repeat, { className: "mr-2 h-4 w-4" }), " Trocar de capítulo"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "h-5 w-5" }), " Configurações"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: "Logo do capítulo usada nas atas em PDF e identidade visual."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						className: "mt-4",
						onClick: () => navigate({ to: "/configuracoes" }),
						children: "Abrir configurações"
					})
				]
			}),
			can(active?.role.name, "secretaria") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "h-5 w-5" }), " Gestão"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: "Cargos do capítulo, conselho consultivo e comissões por vigência."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						className: "mt-4",
						onClick: () => navigate({ to: "/gestao" }),
						children: "Abrir gestão"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "h-5 w-5" }), " Documentação"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: "Guias técnicos, do usuário e de contribuição open source."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						className: "mt-4",
						onClick: () => navigate({ to: "/documentacao" }),
						children: "Abrir documentação"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "rounded-[12px] p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "destructive",
					onClick: signOut,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "mr-2 h-4 w-4" }), " Sair"]
				})
			})
		]
	})] });
}
//#endregion
export { MaisPage as component };
