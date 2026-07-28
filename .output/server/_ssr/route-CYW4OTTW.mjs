import { j as redirect, m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-CYW4OTTW.js
var $$splitComponentImporter = () => import("./route-DFcC81NR.mjs");
var Route = createFileRoute("/_authenticated")({
	ssr: false,
	beforeLoad: async () => {
		const { data, error } = await supabase.auth.getUser();
		if (error || !data.user) throw redirect({ to: "/auth" });
		return { user: data.user };
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
