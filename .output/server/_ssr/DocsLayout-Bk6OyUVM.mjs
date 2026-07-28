import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as DOCS_CATEGORIES } from "./docs-catalog-DO4oNcNx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/DocsLayout-Bk6OyUVM.js
var import_jsx_runtime = require_jsx_runtime();
function DocsLayout({ children, activeSlug = "hub" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-[#FAFAF8] text-foreground dark:bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-40 border-b border-border/80 bg-[#FAFAF8]/95 backdrop-blur dark:bg-background/95",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/documentacao",
							className: "flex items-center gap-3 no-underline",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold tracking-wider text-white",
								style: { backgroundColor: "#9E1B32" },
								children: "SG"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "leading-tight",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold text-foreground",
									children: "SG-CDM"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground",
									children: "Documentação"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							className: "hidden items-center gap-1 md:flex",
							children: DOCS_CATEGORIES.map((cat) => {
								const active = activeSlug === cat.slug;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: cat.to,
									className: cn("rounded-md px-3 py-1.5 text-sm transition-colors", active ? "bg-[#9E1B32]/10 font-medium text-[#9E1B32]" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
									children: cat.shortLabel
								}, cat.slug);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/auth",
							className: "rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent",
							children: "Entrar"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden",
					children: DOCS_CATEGORIES.map((cat) => {
						const active = activeSlug === cat.slug;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: cat.to,
							className: cn("shrink-0 rounded-full px-3 py-1 text-xs", active ? "bg-[#9E1B32] text-white" : "bg-muted text-muted-foreground"),
							children: cat.shortLabel
						}, cat.slug);
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10",
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "border-t border-border/80 py-6 text-center text-xs text-muted-foreground",
				children: [
					"SG-CDM · licença",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "https://github.com/farrapos1111/sgc-dm/blob/main/LICENSE",
						className: "underline underline-offset-2 hover:text-foreground",
						target: "_blank",
						rel: "noreferrer",
						children: "AGPL-3.0"
					})
				]
			})
		]
	});
}
//#endregion
export { DocsLayout as t };
