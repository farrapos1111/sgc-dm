import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
import { i as useQuery } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ActiveChapterContext-Bm8gqppb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STORAGE_KEY = "sgcdm.activeChapterId";
var ActiveChapterContext = (0, import_react.createContext)(null);
function ActiveChapterProvider({ userId, children }) {
	const { data, isLoading, refetch } = useQuery({
		queryKey: ["memberships", userId],
		queryFn: async () => {
			const { data, error } = await supabase.from("chapter_members").select("id, chapter_id, role_id, active, chapter:chapters(id, name, number, city, primary_color, logo_url, settings), role:roles(id, name, label)").eq("user_id", userId).eq("active", true);
			if (error) throw error;
			return data ?? [];
		}
	});
	const memberships = data ?? [];
	const { data: profile } = useQuery({
		queryKey: ["profile-active-chapter", userId],
		queryFn: async () => {
			const { data, error } = await supabase.from("profiles").select("active_chapter_id").eq("id", userId).single();
			if (error) throw error;
			return data;
		},
		enabled: Boolean(userId)
	});
	const [activeChapterId, setActiveChapterIdState] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return null;
		return window.localStorage.getItem(STORAGE_KEY);
	});
	const setActiveChapterId = (0, import_react.useCallback)((id) => {
		setActiveChapterIdState(id);
		if (typeof window !== "undefined") if (id) window.localStorage.setItem(STORAGE_KEY, id);
		else window.localStorage.removeItem(STORAGE_KEY);
		if (userId) supabase.from("profiles").update({ active_chapter_id: id }).eq("id", userId).then(({ error }) => {
			if (error) console.error("Erro ao salvar capítulo ativo:", error);
		});
	}, [userId]);
	(0, import_react.useEffect)(() => {
		if (activeChapterId) return;
		const fromProfile = profile?.active_chapter_id;
		if (fromProfile && memberships.some((m) => m.chapter_id === fromProfile)) setActiveChapterId(fromProfile);
	}, [
		profile,
		activeChapterId,
		memberships,
		setActiveChapterId
	]);
	(0, import_react.useEffect)(() => {
		if (isLoading) return;
		if (memberships.length === 0) {
			setActiveChapterId(null);
			return;
		}
		if (memberships.length === 1) {
			const only = memberships[0].chapter_id;
			if (activeChapterId !== only) setActiveChapterId(only);
			return;
		}
		if (activeChapterId && !memberships.some((m) => m.chapter_id === activeChapterId)) setActiveChapterId(null);
	}, [
		isLoading,
		memberships,
		activeChapterId,
		setActiveChapterId
	]);
	const active = (0, import_react.useMemo)(() => memberships.find((m) => m.chapter_id === activeChapterId) ?? null, [memberships, activeChapterId]);
	const value = (0, import_react.useMemo)(() => ({
		memberships,
		loading: isLoading,
		activeChapterId,
		active,
		setActiveChapterId,
		refetch
	}), [
		memberships,
		isLoading,
		activeChapterId,
		active,
		setActiveChapterId,
		refetch
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveChapterContext.Provider, {
		value,
		children
	});
}
function useActiveChapter() {
	const ctx = (0, import_react.useContext)(ActiveChapterContext);
	if (!ctx) throw new Error("useActiveChapter deve ser usado dentro de ActiveChapterProvider");
	return ctx;
}
//#endregion
export { useActiveChapter as n, ActiveChapterProvider as t };
