import { a as __toESM } from "../_runtime.mjs";
import { $ as booleanType, Q as arrayType, et as enumType, it as stringType, rt as objectType } from "../_libs/@ai-sdk/gateway+[...].mjs";
import { c as createServerFn } from "./createServerFn-BFFE07zL.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-BwdutfJC.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { i as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CNNKHX4E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/OrgScopeContext-BWQf9cDC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Lideranças supra-capitulares do usuário logado, já com os capítulos
* que cada escopo abrange (a RLS garante que só venham os permitidos).
*/
var getMyOrgContext = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("67ebd48f9476250d0d8fedcc842fa5720abf43fc76a0faf835d41c51bc3a1732"));
var scopeInput = objectType({
	scopeType: enumType(["region", "state"]),
	scopeId: stringType().uuid()
});
/** Panorama das instituições de uma região ou estado. */
var listScopeChapters = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => scopeInput.parse(raw)).handler(createSsrRpc("f8d5d05cf285833583d38134ffe907f2da19a7edf8c7cfbfd1712122c959141c"));
/** Busca de membros em várias instituições do escopo (somente leitura, PII mascarada). */
var listScopeMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	chapterIds: arrayType(stringType().uuid()).min(1),
	search: stringType().optional().default(""),
	status: enumType([
		"ativo",
		"inativo",
		"senior",
		"macom",
		"all"
	]).optional().default("all")
}).parse(raw)).handler(createSsrRpc("3164535ffeb67b4a15251b4a5122bac4f8ecd89dfe172580160651fba24a09b8"));
/** Regiões de um estado (para gestão do GME). */
var listRegions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ stateId: stringType().uuid() }).parse(raw)).handler(createSsrRpc("04a3975847f1462a856fa255b948968f581778508d747b6f87c3270fe3603e81"));
var saveRegion = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid().optional(),
	state_id: stringType().uuid(),
	name: stringType().min(1),
	code: stringType().nullable().optional()
}).parse(raw)).handler(createSsrRpc("73427acf2b551c7fee14857f10ccc8341721e6d0698a630313b1b74023e260f4"));
var deleteRegion = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({ id: stringType().uuid() }).parse(raw)).handler(createSsrRpc("5ece9b7203a4998116a9ab0dced9db69614f2fc5e6f3a20e8b9d30a51344e9ea"));
var saveChapter = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid().optional(),
	state_id: stringType().uuid(),
	region_id: stringType().uuid().nullable().optional(),
	name: stringType().min(1),
	number: stringType().min(1),
	city: stringType().nullable().optional(),
	active: booleanType().optional()
}).parse(raw)).handler(createSsrRpc("a6e320e0637e14d4b6ae35c226861fd979952088af0bbe60bb9b1934f65da7cd"));
var setChapterActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((raw) => objectType({
	id: stringType().uuid(),
	active: booleanType()
}).parse(raw)).handler(createSsrRpc("9c69f21f585ffe7da834f89be9d71757682903f62395e6e8ca6f449883c76388"));
var STORAGE_KEY = "sgcdm.activeOrgScope";
var OrgScopeContext = (0, import_react.createContext)(null);
var ROLE_PREFIX = {
	gme: "Grande Mestre Estadual",
	mce: "Mestre Conselheiro Estadual",
	mcr: "Mestre Conselheiro Regional",
	oe: "Oficial Executivo"
};
function OrgScopeProvider({ children }) {
	const { data, isLoading } = useQuery({
		queryKey: ["org-context"],
		queryFn: () => getMyOrgContext(),
		staleTime: 6e4
	});
	const leaderships = (0, import_react.useMemo)(() => data ?? [], [data]);
	const scopes = (0, import_react.useMemo)(() => leaderships.map((l) => {
		const type = l.region_id ? "region" : "state";
		const id = l.region_id ?? l.state_id;
		return {
			key: `${type}:${id}`,
			type,
			id,
			label: l.region_name ?? l.state_name ?? "Escopo",
			orgRole: l.org_role,
			chapterIds: l.chapter_ids
		};
	}), [leaderships]);
	const [activeScopeKey, setActiveScopeKeyState] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return null;
		return window.localStorage.getItem(STORAGE_KEY);
	});
	const setActiveScopeKey = (0, import_react.useCallback)((key) => {
		setActiveScopeKeyState(key);
		if (typeof window === "undefined") return;
		if (key) window.localStorage.setItem(STORAGE_KEY, key);
		else window.localStorage.removeItem(STORAGE_KEY);
	}, []);
	(0, import_react.useEffect)(() => {
		if (isLoading || !activeScopeKey) return;
		if (!scopes.some((s) => s.key === activeScopeKey)) setActiveScopeKey(null);
	}, [
		isLoading,
		activeScopeKey,
		scopes,
		setActiveScopeKey
	]);
	const activeScope = (0, import_react.useMemo)(() => scopes.find((s) => s.key === activeScopeKey) ?? null, [scopes, activeScopeKey]);
	const value = (0, import_react.useMemo)(() => ({
		leaderships,
		scopes,
		loading: isLoading,
		activeScope,
		setActiveScopeKey,
		isGme: leaderships.some((l) => l.org_role === "gme")
	}), [
		leaderships,
		scopes,
		isLoading,
		activeScope,
		setActiveScopeKey
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrgScopeContext.Provider, {
		value,
		children
	});
}
function useOrgScope() {
	const ctx = (0, import_react.useContext)(OrgScopeContext);
	if (!ctx) throw new Error("useOrgScope deve ser usado dentro de OrgScopeProvider");
	return ctx;
}
//#endregion
export { listScopeChapters as a, saveRegion as c, listRegions as i, setChapterActive as l, ROLE_PREFIX as n, listScopeMembers as o, deleteRegion as r, saveChapter as s, OrgScopeProvider as t, useOrgScope as u };
