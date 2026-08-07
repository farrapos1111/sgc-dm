import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentTerm, type Term } from "@/lib/terms";
import { datePartsInAppTz } from "@/lib/timezone";

export type OficioTemplate = {
  id: string;
  name: string;
  body: string;
  updated_at: string;
};

export type OficioRow = {
  id: string;
  chapter_id: string;
  series_id: string;
  number: number;
  year: number;
  title: string;
  body: string;
  template_id: string | null;
  mc_name: string;
  pcc_name: string;
  escrivao_name: string;
  escrivao_member_id: string;
  issued_at: string;
  issued_by: string | null;
  status: "rascunho" | "expedido";
};

export function formatOficioNumber(number: number, year: number) {
  return `Nº ${number}/${year}`;
}

/** Semestre civil da data de expedição (fuso do app). */
export function termFromOficioIssuedAt(issuedAt: string): Term {
  const { year, month } = datePartsInAppTz(new Date(issuedAt));
  return { year, semester: month <= 6 ? 1 : 2 };
}

export const listOficioTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<OficioTemplate[]> => {
    const { data: rows, error } = await context.supabase
      .from("oficio_templates" as never)
      .select("id, name, body, updated_at")
      .eq("chapter_id" as never, data.chapterId)
      .order("name" as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as OficioTemplate[];
  });

export const createOficioTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        name: z.string().trim().min(1),
        body: z.string().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("oficio_templates" as never)
      .insert({
        chapter_id: data.chapterId,
        name: data.name.trim(),
        body: data.body || "Escreva aqui o texto base do modelo.",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as { id: string }).id };
  });

export const saveOficioTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1),
        body: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("oficio_templates" as never)
      .update({ name: data.name.trim(), body: data.body } as never)
      .eq("id" as never, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOficioTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("oficio_templates" as never)
      .delete()
      .eq("id" as never, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOficios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<OficioRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("oficios" as never)
      .select(
        "id, chapter_id, series_id, number, year, title, body, template_id, mc_name, pcc_name, escrivao_name, escrivao_member_id, issued_at, issued_by, status",
      )
      .eq("chapter_id" as never, data.chapterId)
      .order("issued_at" as never, { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as OficioRow[];
  });

export const getOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<OficioRow> => {
    const { data: row, error } = await context.supabase
      .from("oficios" as never)
      .select(
        "id, chapter_id, series_id, number, year, title, body, template_id, mc_name, pcc_name, escrivao_name, escrivao_member_id, issued_at, issued_by, status",
      )
      .eq("id" as never, data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ofício não encontrado");
    return row as OficioRow;
  });

/** Exclui ofício. Se for o último número da série ativa, recua last_number. */
export const deleteOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await context.supabase
      .from("oficios" as never)
      .select("id, chapter_id, series_id, number")
      .eq("id" as never, data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Ofício não encontrado");

    const oficio = row as {
      id: string;
      chapter_id: string;
      series_id: string;
      number: number;
    };

    const { error: delErr } = await context.supabase
      .from("oficios" as never)
      .delete()
      .eq("id" as never, oficio.id);
    if (delErr) throw new Error(delErr.message);

    const { data: series } = await context.supabase
      .from("oficio_series" as never)
      .select("id, last_number, ended_at")
      .eq("id" as never, oficio.series_id)
      .maybeSingle();

    const s = series as {
      id: string;
      last_number: number;
      ended_at: string | null;
    } | null;

    if (
      s &&
      s.ended_at == null &&
      s.last_number === oficio.number &&
      oficio.number > 0
    ) {
      await context.supabase
        .from("oficio_series" as never)
        .update({ last_number: oficio.number - 1 } as never)
        .eq("id" as never, s.id);
    }

    return { ok: true as const };
  });

/** Oficiais do termo + preview do próximo número (considerando troca de escrivão). */
export const getOficioIssueContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const term = currentTerm();
    const [positionsRes, seriesRes] = await Promise.all([
      context.supabase
        .from("member_positions")
        .select("position:positions(code, label), member:members(id, full_name)")
        .eq("chapter_id", data.chapterId)
        .eq("term_year", term.year)
        .eq("term_semester", term.semester),
      context.supabase
        .from("oficio_series" as never)
        .select("id, escrivao_member_id, last_number")
        .eq("chapter_id" as never, data.chapterId)
        .is("ended_at" as never, null)
        .maybeSingle(),
    ]);
    if (positionsRes.error) throw new Error(positionsRes.error.message);
    if (seriesRes.error) throw new Error(seriesRes.error.message);

    const byCode: Record<string, { memberId: string; name: string }> = {};
    for (const row of (positionsRes.data ?? []) as any[]) {
      const code = row.position?.code as string | undefined;
      const memberId = row.member?.id as string | undefined;
      const name = row.member?.full_name as string | undefined;
      if (!code || !memberId || !name) continue;
      if (!byCode[code]) byCode[code] = { memberId, name };
    }

    const mc = byCode.mestre_conselheiro ?? null;
    const pcc = byCode.presidente_conselho_consultivo ?? null;
    const escrivao = byCode.escrivao ?? null;

    const series = seriesRes.data as {
      id: string;
      escrivao_member_id: string;
      last_number: number;
    } | null;

    const seriesMatches =
      series && escrivao && series.escrivao_member_id === escrivao.memberId;
    const nextNumber = seriesMatches ? series.last_number + 1 : 1;
    const year = term.year;

    const missing: string[] = [];
    if (!mc) missing.push("Mestre Conselheiro");
    if (!pcc) missing.push("Presidente do Conselho Consultivo");
    if (!escrivao) missing.push("Escrivão");

    return {
      mcName: mc?.name ?? null,
      pccName: pcc?.name ?? null,
      escrivaoName: escrivao?.name ?? null,
      escrivaoMemberId: escrivao?.memberId ?? null,
      nextNumber,
      year,
      label: formatOficioNumber(nextNumber, year),
      seriesResets: Boolean(escrivao) && !seriesMatches,
      missing,
      canIssue: missing.length === 0,
    };
  });

export const issueOficio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        title: z.string().trim().min(1, "Informe o título"),
        body: z.string().default(""),
        templateId: z.string().uuid().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "issue_oficio" as never,
      {
        _chapter_id: data.chapterId,
        _title: data.title.trim(),
        _body: data.body ?? "",
        _template_id: data.templateId ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    return result as {
      id: string;
      number: number;
      year: number;
      title: string;
      label: string;
      mc_name: string;
      pcc_name: string;
      escrivao_name: string;
    };
  });
