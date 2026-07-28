import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeOfCategory } from "./cash-categories";

type AnyClient = SupabaseClient<any, any, any>;

/**
 * Garante que lançamentos em categorias dinâmicas (Eventos / Hospitalaria)
 * usem apenas subcategorias previamente configuradas pela comissão.
 * O texto é devolvido para ser gravado como snapshot histórico.
 */
export async function resolveSubcategory(
  supabase: AnyClient,
  chapterId: string,
  category: string,
  subcategoryId: string | null,
): Promise<{ subcategory: string | null; calendar_event_id: string | null }> {
  const scope = scopeOfCategory(category);
  if (!scope) return { subcategory: null, calendar_event_id: null };

  if (!subcategoryId) {
    throw new Error(
      scope === "eventos"
        ? "Selecione o evento e o tipo de movimentação configurados pela Comissão de Eventos"
        : "Selecione o item configurado pela Comissão de Hospitalaria",
    );
  }

  const { data, error } = await supabase
    .from("cash_subcategories")
    .select("id, name, scope, active, calendar_event_id, chapter_id")
    .eq("id", subcategoryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.chapter_id !== chapterId || data.scope !== scope || !data.active) {
    throw new Error("Subcategoria inexistente ou desativada pela comissão");
  }

  return { subcategory: data.name, calendar_event_id: data.calendar_event_id };
}
