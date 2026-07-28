import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ThemeContext-NlVC_MCf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var THEME_STORAGE_KEY = "sgcdm.theme";
var ThemeContext = (0, import_react.createContext)({
	mode: "system",
	resolved: "light",
	setMode: () => {},
	toggle: () => {}
});
function systemPrefersDark() {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function applyTheme(resolved) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", resolved === "dark");
	root.style.colorScheme = resolved;
}
/** Script inline: aplica o tema antes da primeira pintura, evitando flash. */
var themeInitScript = `(function(){try{var m=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=m==="dark"||((!m||m==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
function ThemeProvider({ children }) {
	const [mode, setModeState] = (0, import_react.useState)("system");
	const [systemDark, setSystemDark] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === "light" || stored === "dark" || stored === "system") setModeState(stored);
		setSystemDark(systemPrefersDark());
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (e) => setSystemDark(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	const resolved = mode === "system" ? systemDark ? "dark" : "light" : mode;
	(0, import_react.useEffect)(() => {
		applyTheme(resolved);
	}, [resolved]);
	const setMode = (0, import_react.useCallback)((next) => {
		setModeState(next);
		try {
			window.localStorage.setItem(THEME_STORAGE_KEY, next);
		} catch {}
	}, []);
	const toggle = (0, import_react.useCallback)(() => {
		setMode(resolved === "dark" ? "light" : "dark");
	}, [resolved, setMode]);
	const value = (0, import_react.useMemo)(() => ({
		mode,
		resolved,
		setMode,
		toggle
	}), [
		mode,
		resolved,
		setMode,
		toggle
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeContext.Provider, {
		value,
		children
	});
}
function useTheme() {
	return (0, import_react.useContext)(ThemeContext);
}
//#endregion
export { themeInitScript as n, useTheme as r, ThemeProvider as t };
