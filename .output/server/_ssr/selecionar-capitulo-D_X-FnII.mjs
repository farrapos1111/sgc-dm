import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/selecionar-capitulo-D_X-FnII.js
var import_jsx_runtime = require_jsx_runtime();
function ChapterPicker() {
	const { memberships, loading, setActiveChapterId } = useActiveChapter();
	const navigate = useNavigate();
	function pick(chapterId) {
		setActiveChapterId(chapterId);
		navigate({ to: "/" });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen p-6 flex items-center justify-center bg-[#E9E8E3] dark:bg-background",
		style: { fontFamily: "Inter, system-ui, sans-serif" },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center mb-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
						style: { backgroundColor: "#9E1B32" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-white font-bold text-xl",
							children: "SG"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-bold text-foreground",
						children: "Selecione o capítulo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground mt-1 text-center",
						children: "Você pertence a mais de um capítulo. Escolha com qual deseja trabalhar agora."
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground text-center",
					children: "Carregando..."
				}) : memberships.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground text-center",
					children: "Nenhum vínculo ativo."
				}) : memberships.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => pick(m.chapter_id),
					className: "w-full text-left bg-card rounded-2xl shadow-sm border border-border p-5 hover:border-muted-foreground/50 transition-colors",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
							style: { backgroundColor: m.chapter.primary_color || "#9E1B32" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white font-bold text-xs",
								children: m.chapter.number
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-semibold text-foreground truncate",
									children: m.chapter.name
								}),
								m.chapter.city && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm text-muted-foreground truncate",
									children: m.chapter.city
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "inline-flex items-center gap-2 text-xs font-medium px-2 py-0.5 rounded-full mt-1.5",
									style: {
										backgroundColor: `color-mix(in srgb, ${m.chapter.primary_color || "#9E1B32"} 18%, transparent)`,
										color: m.chapter.primary_color || "#9E1B32"
									},
									children: m.role.label
								})
							]
						})]
					})
				}, m.id))
			})]
		})
	});
}
//#endregion
export { ChapterPicker as component };
