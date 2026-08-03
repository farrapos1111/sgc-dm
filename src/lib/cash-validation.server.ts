import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeOfCategory } from "./cash-categories";

type AnyClient = SupabaseClient<any, any, any>;

export type ResolvedSubcategory = {
  subcategory: string | null;
  calendar_event_id: string | null;
  event_id: string | null;
  event_finance_item_id: string | null;
};

/**
 * Garante que lançamentos em categorias dinâmicas (Eventos / Hospitalaria)
 * usem apenas subcategorias previamente configuradas.
 * Eventos: prioriza event_finance_items (módulo de eventos);
 * fallback legado: cash_subcategories + calendar_events.
 */
export async function resolveSubcategory(
  supabase: AnyClient,
  chapterId: string,
  category: string,
  subcategoryId: string | null,
  eventId: string | null = null,
): Promise<ResolvedSubcategory> {
  const scope = scopeOfCategory(category);
  if (!scope) {
    return {
      subcategory: null,
      calendar_event_id: null,
      event_id: null,
      event_finance_item_id: null,
    };
  }

  if (!subcategoryId) {
    throw new Error(
      scope === "eventos"
        ? "Selecione o evento e o tipo de movimentação configurados pela Comissão de Eventos"
        : "Selecione o item configurado pela Comissão de Hospitalaria",
    );
  }

  if (scope === "eventos") {
    // Novo fluxo: item do financeiro do evento (events)
    const { data: item, error: itemErr } = await supabase
      .from("event_finance_items")
      .select("id, name, active, event_id, chapter_id")
      .eq("id", subcategoryId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);

    if (item) {
      if (
        item.chapter_id !== chapterId ||
        !item.active ||
        (eventId && item.event_id !== eventId)
      ) {
        throw new Error("Item inexistente ou desativado no financeiro do evento");
      }
      return {
        subcategory: item.name,
        calendar_event_id: null,
        event_id: item.event_id,
        event_finance_item_id: item.id,
      };
    }

    // Legado: cash_subcategories + calendar_events
    const { data, error } = await supabase
      .from("cash_subcategories")
      .select("id, name, scope, active, calendar_event_id, chapter_id")
      .eq("id", subcategoryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (
      !data ||
      data.chapter_id !== chapterId ||
      data.scope !== scope ||
      !data.active
    ) {
      throw new Error("Subcategoria inexistente ou desativada pela comissão");
    }
    return {
      subcategory: data.name,
      calendar_event_id: data.calendar_event_id,
      event_id: null,
      event_finance_item_id: null,
    };
  }

  const { data, error } = await supabase
    .from("cash_subcategories")
    .select("id, name, scope, active, calendar_event_id, chapter_id")
    .eq("id", subcategoryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (
    !data ||
    data.chapter_id !== chapterId ||
    data.scope !== scope ||
    !data.active
  ) {
    throw new Error("Subcategoria inexistente ou desativada pela comissão");
  }

  return {
    subcategory: data.name,
    calendar_event_id: data.calendar_event_id,
    event_id: null,
    event_finance_item_id: null,
  };
}
