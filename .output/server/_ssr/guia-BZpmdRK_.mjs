import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as DocsLayout } from "./DocsLayout-Bk6OyUVM.mjs";
import { t as category } from "./guia-BGd2792G.mjs";
import { t as MarkdownDoc } from "./MarkdownDoc-Ds3euNJT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/guia-BZpmdRK_.js
var import_jsx_runtime = require_jsx_runtime();
function DocumentacaoGuia() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocsLayout, {
		activeSlug: "guia",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkdownDoc, {
			content: category.content,
			title: category.title
		})
	});
}
//#endregion
export { DocumentacaoGuia as component };
