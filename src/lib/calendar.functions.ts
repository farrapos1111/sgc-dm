import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventTypeEnum = z.enum(["sessao_ritualistica", "sessao_administrativa", "evento", "filantropia", "entretenimento"]);

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
      .select(
        "id, chapter_id, title, event_type, mandatory, public_open, start_at, end_at, location, address, lodge_id, dress_code, description, related_event_id, created_by, created_at",
      )

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
        created_by: context.userId,
      })
      .select()
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
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
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
      })
      .eq("id", id)
      .select()
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
