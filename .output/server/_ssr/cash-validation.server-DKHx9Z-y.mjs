import { i as scopeOfCategory } from "./cash-categories-CWWVJoRh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cash-validation.server-DKHx9Z-y.js
/**
* Garante que lançamentos em categorias dinâmicas (Eventos / Hospitalaria)
* usem apenas subcategorias previamente configuradas pela comissão.
* O texto é devolvido para ser gravado como snapshot histórico.
*/
async function resolveSubcategory(supabase, chapterId, category, subcategoryId) {
	const scope = scopeOfCategory(category);
	if (!scope) return {
		subcategory: null,
		calendar_event_id: null
	};
	if (!subcategoryId) throw new Error(scope === "eventos" ? "Selecione o evento e o tipo de movimentação configurados pela Comissão de Eventos" : "Selecione o item configurado pela Comissão de Hospitalaria");
	const { data, error } = await supabase.from("cash_subcategories").select("id, name, scope, active, calendar_event_id, chapter_id").eq("id", subcategoryId).maybeSingle();
	if (error) throw new Error(error.message);
	if (!data || data.chapter_id !== chapterId || data.scope !== scope || !data.active) throw new Error("Subcategoria inexistente ou desativada pela comissão");
	return {
		subcategory: data.name,
		calendar_event_id: data.calendar_event_id
	};
}
//#endregion
export { resolveSubcategory };
