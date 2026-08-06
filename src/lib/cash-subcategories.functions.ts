import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chapterInput = z.object({ chapterId: z.string().uuid() });

/** Escopos persistidos em cash_subcategories (legado hospitalaria mantido no banco). */
export type CashSubcategoryScope = "eventos" | "hospitalaria";

export type CashSubcategory = {
  id: string;
  scope: CashSubcategoryScope;
  calendar_event_id: string | null;
  name: string;
  active: boolean;
};

export type CashEventOption = { id: string; title: string; start_at: string };

/**
 * Configuração das subcategorias dinâmicas do fluxo de caixa:
 * eventos do calendário disponibilizados para a Comissão de Eventos e
 * os itens já liberados por cada comissão.
 */
export const listCashSubcategoryConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ events: CashEventOption[]; subcategories: CashSubcategory[] }> => {
      const [events, subs] = await Promise.all([
        context.supabase
          .from("calendar_events")
          .select("id, title, start_at, event_type")
          .eq("chapter_id", data.chapterId)
          .in("event_type", ["evento", "filantropia", "entretenimento"])
          .order("start_at", { ascending: false })
          .limit(100),
        context.supabase
          .from("cash_subcategories")
          .select("id, scope, calendar_event_id, name, active")
          .eq("chapter_id", data.chapterId)
          .order("name"),
      ]);
      if (events.error) throw new Error(events.error.message);
      if (subs.error) throw new Error(subs.error.message);

      return {
        events: (events.data ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          start_at: e.start_at,
        })),
        subcategories: (subs.data ?? []) as CashSubcategory[],
      };
    },
  );

export const upsertCashSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        id: z.string().uuid().optional(),
        scope: z.enum(["eventos", "hospitalaria"]),
        calendarEventId: z.string().uuid().nullable().default(null),
        name: z.string().trim().min(1, "Informe o nome do item").max(60),
        active: z.boolean().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.scope === "eventos" && !data.calendarEventId) {
      throw new Error("Selecione o evento do calendário");
    }
    const payload = {
      chapter_id: data.chapterId,
      scope: data.scope,
      calendar_event_id: data.scope === "eventos" ? data.calendarEventId : null,
      name: data.name,
      active: data.active,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("cash_subcategories")
        .update({ name: payload.name, active: payload.active })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("cash_subcategories")
        .insert({ ...payload, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCashSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cash_subcategories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
