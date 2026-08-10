import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeOfCategory, type DynamicScope } from "./cash-categories";

type AnyClient = SupabaseClient<any, any, any>;

export type ResolvedSubcategory = {
  subcategory: string | null;
  calendar_event_id: string | null;
  event_id: string | null;
  event_finance_item_id: string | null;
};

async function resolveLegacySubcategory(
  supabase: AnyClient,
  chapterId: string,
  scope: DynamicScope,
  subcategoryId: string,
): Promise<ResolvedSubcategory> {
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

/**
 * Garante que lançamentos em categorias dinâmicas (Eventos) usem apenas
 * subcategorias/itens previamente configurados.
 * Eventos: prioriza event_finance_items (módulo de eventos);
 * fallback legado: cash_subcategories + calendar_events.
 * Hospitalaria é categoria padrão (sem subcategoria obrigatória).
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
      "Selecione o evento e o tipo de movimentação configurados pela Comissão de Eventos",
    );
  }

  // Novo fluxo: item do financeiro do evento (events)
  const { data: item, error: itemErr } = await supabase
    .from("event_finance_items")
    .select("id, name, active, event_id, chapter_id")
    .eq("id", subcategoryId)
    .maybeSingle();
  if (itemErr) throw new Error(itemErr.message);

  if (item) {
    if (
      !eventId ||
      item.chapter_id !== chapterId ||
      !item.active ||
      item.event_id !== eventId
    ) {
      throw new Error("Item inexistente ou desativado no financeiro do evento");
    }
    const { data: event, error: evErr } = await supabase
      .from("events")
      .select("id, starts_at, status")
      .eq("id", item.event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!event) throw new Error("Evento não encontrado");
    const { assertEventFinanceOpen } = await import("@/lib/event-lifecycle");
    assertEventFinanceOpen(event.starts_at, event.status);

    return {
      subcategory: item.name,
      calendar_event_id: null,
      event_id: item.event_id,
      event_finance_item_id: item.id,
    };
  }

  // Legado: cash_subcategories + calendar_events
  return resolveLegacySubcategory(
    supabase,
    chapterId,
    scope,
    subcategoryId,
  );
}
