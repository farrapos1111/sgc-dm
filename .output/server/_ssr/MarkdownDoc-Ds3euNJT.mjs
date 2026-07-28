import { a as __toESM } from "../_runtime.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { a as slugifyHeading, i as rewriteDocsHref, n as extractToc } from "./docs-catalog-DO4oNcNx.mjs";
import { t as Markdown } from "../_libs/react-markdown+[...].mjs";
import { t as remarkGfm } from "../_libs/remark-gfm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/MarkdownDoc-Ds3euNJT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function flattenText(node) {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(flattenText).join("");
	if (typeof node === "object" && "props" in node) {
		const props = node.props;
		return flattenText(props.children);
	}
	return "";
}
function Heading({ level, children, ...props }) {
	const text = flattenText(children);
	const id = level >= 2 ? slugifyHeading(text) : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(`h${level}`, {
		id,
		className: {
			1: "sr-only",
			2: "text-xl font-semibold tracking-tight mt-10 mb-3 scroll-mt-24 border-b border-border/60 pb-2",
			3: "text-lg font-semibold mt-8 mb-2 scroll-mt-24",
			4: "text-base font-semibold mt-6 mb-2"
		}[level],
		...props,
		children
	});
}
function MarkdownDoc({ content, title }) {
	const toc = (0, import_react.useMemo)(() => extractToc(content), [content]);
	const components = (0, import_react.useMemo)(() => ({
		h1: ({ children, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			level: 1,
			...props,
			children
		}),
		h2: ({ children, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			level: 2,
			...props,
			children
		}),
		h3: ({ children, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			level: 3,
			...props,
			children
		}),
		h4: ({ children, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
			level: 4,
			...props,
			children
		}),
		p: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-4 text-[15px] leading-7 text-foreground/90",
			children
		}),
		ul: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mb-4 list-disc space-y-1.5 pl-6 text-[15px] leading-7",
			children
		}),
		ol: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "mb-4 list-decimal space-y-1.5 pl-6 text-[15px] leading-7",
			children
		}),
		li: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
			className: "pl-1",
			children
		}),
		blockquote: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
			className: "mb-4 border-l-4 border-[#9E1B32]/40 bg-[#9E1B32]/5 px-4 py-3 text-[15px] leading-7 text-foreground/90",
			children
		}),
		a: ({ href, children }) => {
			const rewritten = rewriteDocsHref(href);
			if (!rewritten) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children });
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: rewritten,
				className: "font-medium text-[#9E1B32] underline-offset-2 hover:underline",
				...rewritten.startsWith("http://") || rewritten.startsWith("https://") || rewritten.startsWith("mailto:") ? {
					target: "_blank",
					rel: "noreferrer"
				} : {},
				children
			});
		},
		code: ({ className, children, ...props }) => {
			if (Boolean(className?.includes("language-"))) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
				className: cn("font-mono text-[13px]", className),
				...props,
				children
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
				className: "rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground",
				...props,
				children
			});
		},
		pre: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "mb-4 overflow-x-auto rounded-lg border border-border bg-[#1A1A1A] p-4 text-[13px] leading-6 text-[#F5F5F5]",
			children
		}),
		table: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-6 overflow-x-auto rounded-lg border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
				className: "w-full min-w-[28rem] border-collapse text-left text-sm",
				children
			})
		}),
		thead: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
			className: "bg-muted/60",
			children
		}),
		th: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
			className: "border-b border-border px-3 py-2 font-semibold",
			children
		}),
		td: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
			className: "border-b border-border/70 px-3 py-2 align-top text-foreground/90",
			children
		}),
		hr: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("hr", { className: "my-8 border-border" }),
		strong: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
			className: "font-semibold text-foreground",
			children
		})
	}), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground",
				children: "Documentação"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mb-8 text-3xl font-bold tracking-tight",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
				remarkPlugins: [remarkGfm],
				components,
				children: content
			})
		] }), toc.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
			className: "hidden lg:block",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
					children: "Nesta página"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "space-y-1.5 border-l border-border pl-3",
					children: toc.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: `#${item.id}`,
						className: cn("block text-xs leading-snug text-muted-foreground transition-colors hover:text-foreground", item.level === 3 && "pl-3"),
						children: item.text
					}, item.id))
				})]
			})
		})]
	});
}
//#endregion
export { MarkdownDoc as t };
