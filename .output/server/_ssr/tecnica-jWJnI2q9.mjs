import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as DocsLayout } from "./DocsLayout-Bk6OyUVM.mjs";
import { t as MarkdownDoc } from "./MarkdownDoc-Ds3euNJT.mjs";
import { t as category } from "./tecnica-Wxa_q0LB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tecnica-jWJnI2q9.js
var import_jsx_runtime = require_jsx_runtime();
function DocumentacaoTecnica() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocsLayout, {
		activeSlug: "tecnica",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkdownDoc, {
			content: category.content,
			title: category.title
		})
	});
}
//#endregion
export { DocumentacaoTecnica as component };
