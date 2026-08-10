import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventTypeEnum = z.enum([
  "sessao_ritualistica",
  "sessao_administrativa",
  "evento",
  "filantropia",
  "entretenimento",
  "sindicancia",
]);

const CALENDAR_SELECT =
  "id, chapter_id, title, event_type, mandatory, public_open, start_at, end_at, location, address, lodge_id, dress_code, description, related_event_id, custom_category_id, org_mandatory_date_id, created_by, created_at";

/** Garante que a data obrigatória existe e se aplica ao capítulo (região/estado). */
async function assertMandatoryDateForChapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chapterId: string,
  mandatoryDateId: string | null | undefined,
) {
  if (!mandatoryDateId) return;
  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .select("region_id, state_id")
    .eq("id", chapterId)
    .maybeSingle();
  if (chErr) throw new Error(chErr.message);
  if (!chapter) throw new Error("Capítulo não encontrado");

  const { data: md, error: mdErr } = await supabase
    .from("org_mandatory_dates")
    .select("id, scope, region_id, state_id")
    .eq("id", mandatoryDateId)
    .maybeSingle();
  if (mdErr) throw new Error(mdErr.message);
  if (!md) throw new Error("Data obrigatória não encontrada");

  const ok =
    (md.scope === "region" &&
      chapter.region_id &&
      md.region_id === chapter.region_id) ||
    (md.scope === "state" &&
      chapter.state_id &&
      md.state_id === chapter.state_id);
  if (!ok) {
    throw new Error("Data obrigatória não se aplica a este capítulo");
  }
}

export type ChapterCalendarCategory = {
  id: string;
  chapter_id: string;
  name: string;
  color: string;
  icon: string | null;
  active: boolean;
  created_at: string;
};

export const listCalendarItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      chapterIds: z.array(z.string().uuid()).min(1),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("calendar_events")
      .select(CALENDAR_SELECT)

      .in("chapter_id", data.chapterIds)
      .order("start_at", { ascending: true });
    if (data.from) q = q.gte("start_at", data.from);
    if (data.to) q = q.lte("start_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


export const createCalendarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      chapter_id: z.string().uuid().optional(),
      title: z.string().min(1),
      event_type: eventTypeEnum,
      mandatory: z.boolean().optional(),
      public_open: z.boolean().optional(),
      start_at: z.string().datetime(),
      end_at: z.string().datetime().nullable().optional(),
      location: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      lodge_id: z.string().uuid().nullable().optional(),
      dress_code: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      related_event_id: z.string().uuid().nullable().optional(),
      custom_category_id: z.string().uuid().nullable().optional(),
      org_mandatory_date_id: z.string().uuid().nullable().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    let chapterId: string;
    if (data.chapter_id) {
      chapterId = data.chapter_id;
    } else {
      // O capítulo sempre é o ativo do usuário logado; nunca vem de campo do cliente.
      const { data: profile, error: profileError } = await context.supabase
        .from("profiles")
        .select("active_chapter_id")
        .eq("id", context.userId)
        .single();
      if (profileError || !profile?.active_chapter_id) {
        throw new Error("Nenhum capítulo ativo selecionado. Escolha um capítulo no menu.");
      }
      chapterId = profile.active_chapter_id;
    }

    await assertMandatoryDateForChapter(
      context.supabase,
      chapterId,
      data.org_mandatory_date_id,
    );

    const { data: row, error } = await context.supabase
      .from("calendar_events")
      .insert({
        chapter_id: chapterId,
        title: data.title,
        event_type: data.event_type,
        mandatory: data.mandatory ?? true,
        public_open: data.public_open ?? false,
        start_at: data.start_at,
        end_at: data.end_at ?? null,
        location: data.location ?? null,
        address: data.address ?? null,
        lodge_id: data.lodge_id ?? null,
        dress_code: data.dress_code ?? null,
        description: data.description ?? null,
        related_event_id: data.related_event_id ?? null,
        custom_category_id: data.custom_category_id ?? null,
        org_mandatory_date_id: data.org_mandatory_date_id ?? null,
        created_by: context.userId,
      })
      .select(CALENDAR_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });


export const updateCalendarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1),
      event_type: eventTypeEnum,
      mandatory: z.boolean().optional(),
      public_open: z.boolean().optional(),
      start_at: z.string().datetime(),
      end_at: z.string().datetime().nullable().optional(),
      location: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      lodge_id: z.string().uuid().nullable().optional(),
      dress_code: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      custom_category_id: z.string().uuid().nullable().optional(),
      org_mandatory_date_id: z.string().uuid().nullable().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;

    const { data: existing, error: existErr } = await context.supabase
      .from("calendar_events")
      .select("chapter_id")
      .eq("id", id)
      .maybeSingle();
    if (existErr) throw new Error(existErr.message);
    if (!existing) throw new Error("Evento não encontrado");

    await assertMandatoryDateForChapter(
      context.supabase,
      existing.chapter_id,
      rest.org_mandatory_date_id,
    );

    const { data: row, error } = await context.supabase
      .from("calendar_events")
      .update({
        title: rest.title,
        event_type: rest.event_type,
        mandatory: rest.mandatory ?? true,
        public_open: rest.public_open ?? false,
        start_at: rest.start_at,
        end_at: rest.end_at ?? null,
        location: rest.location ?? null,
        address: rest.address ?? null,
        lodge_id: rest.lodge_id ?? null,
        dress_code: rest.dress_code ?? null,
        description: rest.description ?? null,
        custom_category_id: rest.custom_category_id ?? null,
        org_mandatory_date_id: rest.org_mandatory_date_id ?? null,
      })
      .eq("id", id)
      .select(CALENDAR_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });


export const deleteCalendarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("calendar_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listChapterCalendarCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        includeInactive: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<ChapterCalendarCategory[]> => {
    let q = context.supabase
      .from("chapter_calendar_categories")
      .select("id, chapter_id, name, color, icon, active, created_at")
      .eq("chapter_id", data.chapterId)
      .order("name");
    if (!data.includeInactive) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ChapterCalendarCategory[];
  });

export const upsertChapterCalendarCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "Informe o nome").max(60),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
        icon: z.string().trim().max(40).nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      chapter_id: data.chapterId,
      name: data.name.trim(),
      color: data.color.toUpperCase(),
      icon: data.icon?.trim() || null,
      active: data.active ?? true,
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("chapter_calendar_categories")
        .update({
          name: payload.name,
          color: payload.color,
          icon: payload.icon,
          active: payload.active,
        })
        .eq("id", data.id)
        .eq("chapter_id", data.chapterId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row as ChapterCalendarCategory;
    }

    const { data: row, error } = await context.supabase
      .from("chapter_calendar_categories")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as ChapterCalendarCategory;
  });

export const deleteChapterCalendarCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        chapterId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chapter_calendar_categories")
      .delete()
      .eq("id", data.id)
      .eq("chapter_id", data.chapterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const calendarTypeEnum = z.enum([
  "sessao_ritualistica",
  "sessao_administrativa",
  "evento",
  "filantropia",
  "entretenimento",
  "sindicancia",
]);

/** Renomeia rótulos das categorias padrão do calendário (por capítulo). */
export const updateCalendarTypeLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        labels: z.record(calendarTypeEnum, z.string().trim().max(60)),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.labels)) {
      const name = value.trim();
      if (name) cleaned[key] = name;
    }

    const { data: settings, error } = await context.supabase.rpc(
      "patch_chapter_settings",
      {
        _chapter_id: data.chapterId,
        _patch: {
          calendar_type_labels:
            Object.keys(cleaned).length > 0 ? cleaned : null,
        },
      },
    );
    if (error) throw new Error(error.message);
    return { ok: true, settings };
  });
