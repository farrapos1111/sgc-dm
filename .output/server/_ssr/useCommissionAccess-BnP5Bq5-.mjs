import { a as __toESM } from "../_runtime.mjs";
import { at as unionType, it as stringType, nt as numberType, rt as objectType, tt as literalType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { O as isRedirect, v as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { i as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { t as currentTerm } from "./terms-DRv0pA-p.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/useCommissionAccess-BnP5Bq5-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useServerFn(serverFn) {
	const router = useRouter();
	return import_react.useCallback(async (...args) => {
		try {
			const res = await serverFn(...args);
			if (isRedirect(res)) throw res;
			return res;
		} catch (err) {
			if (isRedirect(err)) {
				err.options._fromLocation = router.stores.location.get();
				return router.navigate(router.resolveRedirect(err).options);
			}
			throw err;
		}
	}, [router, serverFn]);
}
/**
* Comissões do usuário logado no capítulo/vigência informados.
* O vínculo usuário → membro é feito por e-mail ou nome completo do perfil.
*/
var listMyCommissions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterId: stringType().uuid(),
	year: numberType().int(),
	semester: unionType([literalType(1), literalType(2)])
}).parse(raw)).handler(createSsrRpc("9fcb1ed7d8864f683ecb7cb254b4abb285b7d5d5a7aa171e17cf9c12da5e65ed"));
function useCommissionAccess() {
	const { active } = useActiveChapter();
	const term = currentTerm();
	const fetchMine = useServerFn(listMyCommissions);
	const { data } = useQuery({
		queryKey: [
			"my-commissions",
			active?.chapter_id,
			term.year,
			term.semester
		],
		enabled: !!active,
		staleTime: 300 * 1e3,
		queryFn: () => fetchMine({ data: {
			chapterId: active.chapter_id,
			year: term.year,
			semester: term.semester
		} })
	});
	const commissions = data ?? [];
	const role = active?.role.name ?? null;
	const isAdmin = can(role, "admin") || can(role, "conselho");
	const canView = (0, import_react.useCallback)((code) => isAdmin || commissions.some((c) => c.code === code), [commissions, isAdmin]);
	const canManage = (0, import_react.useCallback)((code) => isAdmin || commissions.some((c) => c.code === code && c.isPresident), [commissions, isAdmin]);
	return (0, import_react.useMemo)(() => ({
		commissions,
		canView,
		canManage
	}), [
		commissions,
		canView,
		canManage
	]);
}
//#endregion
export { useCommissionAccess as t };
