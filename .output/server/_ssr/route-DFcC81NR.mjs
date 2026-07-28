import { f as Outlet } from "../_libs/@tanstack/react-router+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as ActiveChapterProvider } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as OrgScopeProvider } from "./OrgScopeContext-BWQf9cDC.mjs";
import { t as Route } from "./route-CYW4OTTW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-DFcC81NR.js
var import_jsx_runtime = require_jsx_runtime();
function AuthenticatedLayout() {
	const { user } = Route.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveChapterProvider, {
		userId: user.id,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrgScopeProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) })
	});
}
//#endregion
export { AuthenticatedLayout as component };
