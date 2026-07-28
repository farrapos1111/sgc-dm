import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVENT_SELECT =
  "id, chapter_id, title, event_type, mandatory, start_at, end_at, location, address, description, related_event_id";

/** Itens do calendário que já começaram e ainda não terminaram (ou começaram há < 6h). */
export const listOngoingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const now = new Date();
    const floor = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("calendar_events")
      .select(EVENT_SELECT)
      .eq("chapter_id", data.chapterId)
      .gte("start_at", floor)
      .lte("start_at", now.toISOString())
      .order("start_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).filter((r: any) => !r.end_at || new Date(r.end_at) >= now);
  });

/** Dados completos da tela de Ongoing: item, membros ativos, presenças e ata. */
export const getOngoing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ calendarEventId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: item, error: e1 } = await context.supabase
      .from("calendar_events")
      .select(EVENT_SELECT)
      .eq("id", data.calendarEventId)
      .single();
    if (e1) throw new Error(e1.message);

    const [members, records, minutes] = await Promise.all([
      context.supabase
        .from("members")
        .select("id, full_name, status")
        .eq("chapter_id", item.chapter_id)
        .eq("status", "ativo")
        .order("full_name"),
      context.supabase
        .from("attendance_records")
        .select("id, member_id, status, justification, updated_at")
        .eq("calendar_event_id", data.calendarEventId),
      context.supabase
        .from("session_minutes")
        .select("id, content, opened_at, updated_at, status, title")
        .eq("calendar_event_id", data.calendarEventId)
        .maybeSingle(),

    ]);
    if (members.error) throw new Error(members.error.message);
    if (records.error) throw new Error(records.error.message);
    if (minutes.error) throw new Error(minutes.error.message);

    return {
      item,
      members: members.data ?? [],
      records: records.data ?? [],
      minutes: minutes.data ?? null,
    };
  });

export const setAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        calendarEventId: z.string().uuid(),
        memberId: z.string().uuid(),
        status: z.enum(["presente", "ausente"]),
        justification: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("attendance_records").upsert(
      {
        chapter_id: data.chapterId,
        calendar_event_id: data.calendarEventId,
        member_id: data.memberId,
        status: data.status,
        justification: data.justification ?? null,
        recorded_by: context.userId,
      },
      { onConflict: "calendar_event_id,member_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        calendarEventId: z.string().uuid(),
        content: z.string(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: exErr } = await context.supabase
      .from("session_minutes")
      .select("id, status")
      .eq("calendar_event_id", data.calendarEventId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing && existing.status !== "rascunho") {
      throw new Error(
        "Ata bloqueada para edição. Reabra a ata para correção antes de alterar o texto.",
      );
    }

    const { data: saved, error } = await context.supabase
      .from("session_minutes")
      .upsert(
        {
          chapter_id: data.chapterId,
          calendar_event_id: data.calendarEventId,
          content: data.content,
          opened_by: context.userId,
        },
        { onConflict: "calendar_event_id" },
      )
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, minute: saved };
  });


/** Visão geral do módulo de Presenças: itens passados/atuais + registros. */
export const listAttendanceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const [items, members] = await Promise.all([
      context.supabase
        .from("calendar_events")
        .select(EVENT_SELECT)
        .eq("chapter_id", data.chapterId)
        .lte("start_at", new Date().toISOString())
        .order("start_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("members")
        .select("id, full_name, status")
        .eq("chapter_id", data.chapterId)
        .order("full_name"),
    ]);
    if (items.error) throw new Error(items.error.message);
    if (members.error) throw new Error(members.error.message);

    const eventRows = items.data ?? [];
    const eventIds = eventRows.map((row: { id: string }) => row.id);

    type AttendanceRow = {
      id: string;
      calendar_event_id: string;
      member_id: string;
      status: string;
      justification: string | null;
    };
    let records: { data: AttendanceRow[] | null; error: { message: string } | null };

    if (eventIds.length === 0) {
      records = { data: [], error: null };
    } else {
      records = await context.supabase
        .from("attendance_records")
        .select("id, calendar_event_id, member_id, status, justification")
        .eq("chapter_id", data.chapterId)
        .in("calendar_event_id", eventIds);
    }
    if (records.error) throw new Error(records.error.message);
    return { items: eventRows, members: members.data ?? [], records: records.data ?? [] };
  });

/** Histórico de presença de um membro. */
export const getMemberAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("attendance_records")
      .select(
        "id, status, justification, calendar_event:calendar_events(id, title, event_type, mandatory, start_at)",
      )
      .eq("member_id", data.memberId);
    if (error) throw new Error(error.message);
    return (rows ?? []).sort((a: any, b: any) =>
      (b.calendar_event?.start_at ?? "").localeCompare(a.calendar_event?.start_at ?? ""),
    );
  });
