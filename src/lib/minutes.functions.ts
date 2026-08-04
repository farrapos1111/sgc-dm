import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supportsMinutes } from "@/lib/calendar-types";

export const SIGNER_ROLES = ["presidente_conselho", "mestre_conselheiro", "escrivao"] as const;
export type SignerRole = (typeof SIGNER_ROLES)[number];

export const SIGNER_LABELS: Record<SignerRole, string> = {
  presidente_conselho: "Presidente do Conselho",
  mestre_conselheiro: "Mestre Conselheiro",
  escrivao: "Escrivão",
};

export const MINUTE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão para Aprovação",
  aprovada: "Aprovada",
};

/** Modelos de ata do capítulo (editáveis). */
export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("minute_templates")
      .select("id, code, name, body, sort_order, updated_at")
      .eq("chapter_id", data.chapterId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1),
        body: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("minute_templates")
      .update({ name: data.name, body: data.body })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Criar um novo modelo padrão do capítulo. */
export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        name: z.string().min(1),
        body: z.string().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const code = `custom_${Date.now()}`;
    const { data: last } = await context.supabase
      .from("minute_templates")
      .select("sort_order")
      .eq("chapter_id", data.chapterId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("minute_templates")
      .insert({
        chapter_id: data.chapterId,
        code,
        name: data.name,
        body: data.body || "Escreva aqui o texto base do modelo.",
        sort_order: ((last as any)?.sort_order ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any).id };
  });

/** Excluir um modelo do capítulo. */
export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("minute_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Todas as atas do capítulo, com o item de calendário vinculado e assinaturas. */
export const listChapterMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("session_minutes")
      .select(
        "id, content, status, kind, opened_at, updated_at, calendar_event_id, calendar_event:calendar_events(id, title, event_type, mandatory, start_at, end_at, location, address)",
      )
      .eq("chapter_id", data.chapterId)
      .order("opened_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    let approvals: any[] = [];
    if (ids.length) {
      const { data: ap, error: apErr } = await context.supabase
        .from("minute_approvals")
        .select("minute_id, signer_role, signed_at")
        .in("minute_id", ids);
      if (apErr) throw new Error(apErr.message);
      approvals = ap ?? [];
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      approvals: approvals.filter((a) => a.minute_id === r.id),
    }));
  });

/** Sessões que suportam ata e ainda não têm registro em session_minutes. */
export const listSessionsWithoutMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 60);
    const to = new Date(now);
    to.setDate(to.getDate() + 7);

    const [eventsRes, minutesRes] = await Promise.all([
      context.supabase
        .from("calendar_events")
        .select("id, title, event_type, start_at, end_at, location")
        .eq("chapter_id", data.chapterId)
        .gte("start_at", from.toISOString())
        .lte("start_at", to.toISOString())
        .order("start_at", { ascending: false }),
      context.supabase
        .from("session_minutes")
        .select("calendar_event_id")
        .eq("chapter_id", data.chapterId),
    ]);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    if (minutesRes.error) throw new Error(minutesRes.error.message);

    const withMinutes = new Set(
      (minutesRes.data ?? []).map((m: { calendar_event_id: string }) => m.calendar_event_id),
    );

    return (eventsRes.data ?? []).filter(
      (ev) => supportsMinutes(ev.event_type) && !withMinutes.has(ev.id),
    );
  });

/** Dados para resolver as variáveis dinâmicas: capítulo + oficiais da vigência atual. */
export const getMinuteContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        termYear: z.number().int(),
        termSemester: z.number().int().min(1).max(2),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const [chapter, positions] = await Promise.all([
      context.supabase
        .from("chapters")
        .select("id, name, number, city")
        .eq("id", data.chapterId)
        .single(),
      context.supabase
        .from("member_positions")
        .select("position:positions(code, label), member:members(id, full_name)")
        .eq("chapter_id", data.chapterId)
        .eq("term_year", data.termYear)
        .eq("term_semester", data.termSemester),
    ]);
    if (chapter.error) throw new Error(chapter.error.message);
    if (positions.error) throw new Error(positions.error.message);

    const officers: Record<string, string> = {};
    for (const row of (positions.data ?? []) as any[]) {
      const code = row.position?.code;
      const name = row.member?.full_name;
      if (!code || !name) continue;
      officers[code] = officers[code] ? `${officers[code]}, ${name}` : name;
    }
    return { chapter: chapter.data, officers };
  });

/** Ata + assinaturas. */
export const getMinuteApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ minuteId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("minute_approvals")
      .select("id, signer_role, user_id, signed_at")
      .eq("minute_id", data.minuteId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function loadMinute(supabase: any, minuteId: string) {
  const { data, error } = await supabase
    .from("session_minutes")
    .select("id, chapter_id, status")
    .eq("id", minuteId)
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; chapter_id: string; status: string };
}

/** Concluir a ata: passa automaticamente para "Em Revisão para Aprovação". */
export const submitMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ minuteId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const minute = await loadMinute(context.supabase, data.minuteId);
    if (minute.status === "aprovada") throw new Error("Ata já aprovada.");
    const { error } = await context.supabase
      .from("session_minutes")
      .update({ status: "em_revisao" })
      .eq("id", data.minuteId);
    if (error) throw new Error(error.message);
    return { ok: true, status: "em_revisao" as const };
  });

/** Reabrir para correção: limpa as assinaturas e volta para rascunho. */
export const reopenMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ minuteId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const minute = await loadMinute(context.supabase, data.minuteId);
    const del = await context.supabase
      .from("minute_approvals")
      .delete()
      .eq("minute_id", minute.id);
    if (del.error) throw new Error(del.error.message);
    const { error } = await context.supabase
      .from("session_minutes")
      .update({ status: "rascunho" })
      .eq("id", minute.id);
    if (error) throw new Error(error.message);
    return { ok: true, status: "rascunho" as const };
  });

/** Assinar a ata como Presidente, Mestre Conselheiro ou Escrivão. */
export const signMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ minuteId: z.string().uuid(), signerRole: z.enum(SIGNER_ROLES) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const minute = await loadMinute(context.supabase, data.minuteId);
    if (minute.status === "rascunho") {
      throw new Error("Conclua a ata antes de coletar as assinaturas.");
    }

    const { data: membership, error: mErr } = await context.supabase
      .from("chapter_members")
      .select("role:roles(name)")
      .eq("chapter_id", minute.chapter_id)
      .eq("user_id", context.userId)
      .eq("active", true)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    const roleName = (membership as any)?.role?.name as string | undefined;
    if (roleName !== "admin_total" && roleName !== data.signerRole) {
      throw new Error("Você não ocupa este cargo para assinar a ata.");
    }

    const ins = await context.supabase.from("minute_approvals").upsert(
      {
        chapter_id: minute.chapter_id,
        minute_id: minute.id,
        signer_role: data.signerRole,
        user_id: context.userId,
        signed_at: new Date().toISOString(),
      },
      { onConflict: "minute_id,signer_role" },
    );
    if (ins.error) throw new Error(ins.error.message);

    const { data: all, error: aErr } = await context.supabase
      .from("minute_approvals")
      .select("signer_role")
      .eq("minute_id", minute.id);
    if (aErr) throw new Error(aErr.message);
    const roles = new Set((all ?? []).map((r: any) => r.signer_role));
    const complete = SIGNER_ROLES.every((r) => roles.has(r));
    if (complete) {
      const upd = await context.supabase
        .from("session_minutes")
        .update({ status: "aprovada" })
        .eq("id", minute.id);
      if (upd.error) throw new Error(upd.error.message);
    }
    return { ok: true, approved: complete };
  });

/** Exclui a ata da sessão (votos e assinaturas em cascade). */
export const deleteMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ minuteId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const minute = await loadMinute(context.supabase, data.minuteId);
    if (minute.status !== "rascunho") {
      throw new Error("Somente atas em rascunho podem ser excluídas.");
    }

    const { data: allowed, error: roleErr } = await context.supabase.rpc(
      "has_any_role",
      {
        _chapter_id: minute.chapter_id,
        _role_names: [
          "admin_total",
          "mestre_conselheiro",
          "escrivao",
          "consultor",
          "presidente_conselho",
        ],
      },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) {
      throw new Error("Sem permissão para excluir esta ata");
    }

    const { data: deleted, error } = await context.supabase
      .from("session_minutes")
      .delete()
      .eq("id", minute.id)
      .eq("chapter_id", minute.chapter_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) {
      throw new Error("Ata não encontrada ou sem permissão para excluir");
    }
    return { ok: true as const };
  });
