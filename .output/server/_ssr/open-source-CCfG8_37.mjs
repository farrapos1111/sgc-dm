import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as DocsLayout } from "./DocsLayout-Bk6OyUVM.mjs";
import { t as MarkdownDoc } from "./MarkdownDoc-Ds3euNJT.mjs";
import { t as category } from "./open-source-CPp1QJll.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/open-source-CCfG8_37.js
var import_jsx_runtime = require_jsx_runtime();
function DocumentacaoOpenSource() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocsLayout, {
		activeSlug: "open-source",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkdownDoc, {
			content: category.content,
			title: category.title
		})
	});
}
//#endregion
export { DocumentacaoOpenSource as component };
