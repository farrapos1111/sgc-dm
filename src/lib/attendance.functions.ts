import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  memberEligibleForAttendance,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { supportsAttendance, supportsMinutes } from "@/lib/calendar-types";

const EVENT_SELECT =
  "id, chapter_id, title, event_type, mandatory, start_at, end_at, location, address, description, related_event_id";

const MEMBER_ATTENDANCE_SELECT =
  "id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico, exam_grau_demolay";

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
    return (rows ?? []).filter(
      (r: { end_at?: string | null; event_type?: string }) =>
        supportsAttendance(r.event_type ?? "") &&
        (!r.end_at || new Date(r.end_at) >= now),
    );
  });

/** Dados completos da tela de Ongoing: item, membros ativos, presenças e atas. */
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
        .select(MEMBER_ATTENDANCE_SELECT)
        .eq("chapter_id", item.chapter_id)
        .eq("status", "regular")
        .in("kind", ["demolay_ativo", "senior"])
        .order("full_name"),
      context.supabase
        .from("attendance_records")
        .select("id, member_id, status, justification, updated_at")
        .eq("calendar_event_id", data.calendarEventId),
      context.supabase
        .from("session_minutes")
        .select("id, content, opened_at, updated_at, status, title, kind")
        .eq("calendar_event_id", data.calendarEventId)
        .order("opened_at", { ascending: true }),
    ]);
    if (members.error) throw new Error(members.error.message);
    if (records.error) throw new Error(records.error.message);
    if (minutes.error) throw new Error(minutes.error.message);

    const eligible = ((members.data ?? []) as DueMemberLite[]).filter((m) =>
      memberEligibleForAttendance(m, item.start_at),
    );

    return {
      item,
      members: eligible,
      records: records.data ?? [],
      minutes: minutes.data ?? [],
    };
  });

/** Lista todas as atas de um evento, ordenadas por abertura. */
export const listMinutesForEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ calendarEventId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("session_minutes")
      .select("id, content, opened_at, updated_at, status, title, kind")
      .eq("calendar_event_id", data.calendarEventId)
      .order("opened_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        calendarEventId: z.string().uuid(),
        memberId: z.string().uuid(),
        /** null = desmarca (remove o registro). */
        status: z.enum(["presente", "ausente"]).nullable(),
        justification: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: eventMeta, error: metaErr } = await context.supabase
      .from("calendar_events")
      .select("id, start_at, event_type")
      .eq("id", data.calendarEventId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (metaErr) throw new Error(metaErr.message);
    if (!eventMeta) throw new Error("Evento não encontrado");
    if (!supportsAttendance(eventMeta.event_type)) {
      throw new Error("Sindicância não possui chamada de presença.");
    }

    if (data.status === null) {
      const { error } = await context.supabase
        .from("attendance_records")
        .delete()
        .eq("calendar_event_id", data.calendarEventId)
        .eq("member_id", data.memberId)
        .eq("chapter_id", data.chapterId);
      if (error) throw new Error(error.message);
      return { ok: true, cleared: true };
    }

    const { data: member, error: mErr } = await context.supabase
      .from("members")
      .select(MEMBER_ATTENDANCE_SELECT)
      .eq("id", data.memberId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Membro não encontrado");

    if (
      !memberEligibleForAttendance(
        member as DueMemberLite,
        eventMeta.start_at,
      )
    ) {
      throw new Error(
        "Membro fora da regra de presença neste evento (iniciação ou Senior).",
      );
    }

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
    return { ok: true, cleared: false };
  });

export const saveMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        calendarEventId: z.string().uuid(),
        content: z.string(),
        kind: z.enum(["publica", "grau_iniciatico", "grau_demolay"]).optional(),
        /** Se informado, atualiza a ata existente; senão cria uma nova. */
        id: z.string().uuid().optional(),
        /** Chave estável por instância de “Nova ata” (dedupe atômico). */
        clientDraftKey: z.string().uuid().optional(),
        title: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: event, error: evErr } = await context.supabase
      .from("calendar_events")
      .select("id, event_type, chapter_id")
      .eq("id", data.calendarEventId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!event) throw new Error("Evento não encontrado");
    if (!supportsMinutes(event.event_type)) {
      throw new Error(
        "Filantropia e entretenimento não possuem registro de ata.",
      );
    }

    if (data.id) {
      const kind = data.kind ?? "publica";
      const patch: Record<string, unknown> = {
        content: data.content,
        kind,
      };
      if (data.title !== undefined) patch.title = data.title;

      const { data: saved, error } = await context.supabase
        .from("session_minutes")
        .update(patch as never)
        .eq("id", data.id)
        .eq("status", "rascunho")
        .eq("calendar_event_id", data.calendarEventId)
        .eq("chapter_id", data.chapterId)
        .select("id, status, kind, title")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!saved) {
        throw new Error(
          "Ata bloqueada para edição. Reabra a ata para correção antes de alterar o texto.",
        );
      }
      return { ok: true, minute: saved };
    }

    if (!data.clientDraftKey) {
      throw new Error("Chave de rascunho obrigatória para nova ata.");
    }

    const kind = data.kind ?? "publica";
    const { data: saved, error } = await context.supabase.rpc(
      "upsert_session_minute_draft" as never,
      {
        _chapter_id: data.chapterId,
        _calendar_event_id: data.calendarEventId,
        _content: data.content,
        _kind: kind,
        _title: data.title === undefined ? null : data.title,
        _client_draft_key: data.clientDraftKey,
      } as never,
    );
    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        throw new Error(
          "Rascunho já está sendo salvo. Aguarde e tente novamente.",
        );
      }
      throw new Error(error.message);
    }
    const minute = Array.isArray(saved) ? saved[0] : saved;
    if (!minute) throw new Error("Não foi possível salvar o rascunho.");
    return { ok: true, minute };
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
        .select(MEMBER_ATTENDANCE_SELECT)
        .eq("chapter_id", data.chapterId)
        .order("full_name"),
    ]);
    if (items.error) throw new Error(items.error.message);
    if (members.error) throw new Error(members.error.message);

    const eventRows = (items.data ?? []).filter((row: { event_type?: string }) =>
      supportsAttendance(row.event_type ?? ""),
    );
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
