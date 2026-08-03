import { buildChaveDoDia, buildSindicanciaChave } from "@/lib/chave-do-dia";
import { getSindicanciaChaveContext } from "@/lib/investigations.functions";

type CalendarChaveItem = {
  id: string;
  event_type: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  address?: string | null;
  dress_code?: string | null;
};

type ChapterForChave = {
  name?: string | null;
  settings?: Record<string, unknown> | null;
} | null | undefined;

/** Resolve o texto da chave (dia ou sindicância) para copiar. */
export async function resolveCalendarChaveText(
  item: CalendarChaveItem,
  chapter?: ChapterForChave,
): Promise<string> {
  if (item.event_type === "sindicancia") {
    const ctx = await getSindicanciaChaveContext({
      data: { calendarEventId: item.id },
    });
    return buildSindicanciaChave({
      template: ctx.template,
      chapterName: ctx.chapterName || chapter?.name,
      nominee: ctx.nominee,
      start_at: ctx.start_at || item.start_at,
      location: ctx.location || item.location,
      padrinho: ctx.padrinho,
      sindicante: ctx.sindicante,
      senior: ctx.senior,
      escrivao: ctx.escrivao,
    });
  }

  const settings = chapter?.settings;
  const rawTemplate =
    settings && typeof settings === "object"
      ? settings.chave_template
      : null;
  const template = typeof rawTemplate === "string" ? rawTemplate : null;

  return buildChaveDoDia(item, {
    template,
    chapterName: chapter?.name ?? null,
  });
}
