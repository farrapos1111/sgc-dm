import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { _t as ArrowRight } from "../_libs/lucide-react.mjs";
import { t as DOCS_CATEGORIES } from "./docs-catalog-DO4oNcNx.mjs";
import { t as DocsLayout } from "./DocsLayout-Bk6OyUVM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/documentacao-CP7VcZIJ.js
var import_jsx_runtime = require_jsx_runtime();
function DocumentacaoHub() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocsLayout, {
		activeSlug: "hub",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-3xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-3xl font-bold tracking-tight sm:text-4xl",
					children: "Documentação"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-base leading-7 text-muted-foreground sm:text-lg",
					children: "Guias do SG-CDM separados por público: quem desenvolve, quem usa no capítulo e quem quer contribuir com o código."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-10 space-y-4",
					children: DOCS_CATEGORIES.map((cat) => {
						const Icon = cat.icon;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: cat.to,
							className: "group flex gap-4 rounded-2xl border border-border bg-card p-5 no-underline transition-colors hover:border-[#9E1B32]/40 hover:bg-[#9E1B32]/[0.03] sm:p-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white",
								style: { backgroundColor: "#9E1B32" },
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-lg font-semibold text-foreground",
										children: cat.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
										children: cat.audience
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#9E1B32]" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm leading-6 text-muted-foreground",
									children: cat.description
								})]
							})]
						}, cat.slug);
					})
				})
			]
		})
	});
}
//#endregion
export { DocumentacaoHub as component };
