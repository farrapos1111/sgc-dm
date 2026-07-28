import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chapter-logo-BLyNpzNr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var LOGO_BUCKET = "chapter-logos";
/** URL assinada temporária para exibir a logo do capítulo (bucket privado). */
function useChapterLogo(path) {
	const [url, setUrl] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		if (!path) {
			setUrl(null);
			return;
		}
		supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
			if (!cancelled) setUrl(data?.signedUrl ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, [path]);
	return url;
}
/** Baixa a logo e converte para data URL (necessário para embutir no PDF). */
async function loadLogoDataUrl(path) {
	if (!path) return null;
	const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(path);
	if (error || !data) return null;
	return await new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(data);
	});
}
//#endregion
export { loadLogoDataUrl as n, useChapterLogo as r, LOGO_BUCKET as t };
