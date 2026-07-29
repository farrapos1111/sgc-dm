import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { competenceLabel, duesDescription } from "@/lib/cash-categories";

const chapterInput = z.object({ chapterId: z.string().uuid() });

export { competenceLabel };


/* ----------------------------- Fluxo de caixa ---------------------------- */

/**
 * Lista lançamentos do mês ou de todo o período (`month: null`) e devolve
 * também os totais acumulados de todos os tempos (saldo do banco).
 */
export const listCashEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        month: z.number().int().min(1).max(12).nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("cash_entries")
      .select("id, kind, category, subcategory, description, amount, entry_date, created_at")
      .eq("chapter_id", data.chapterId);

    if (data.month) {
      const from = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
      const end = new Date(data.year, data.month, 1).toISOString().slice(0, 10);
      query = query.gte("entry_date", from).lt("entry_date", end);
    }

    const [rows, all] = await Promise.all([
      query.order("entry_date", { ascending: false }).limit(2000),
      context.supabase
        .from("cash_entries")
        .select("kind, amount")
        .eq("chapter_id", data.chapterId)
        .limit(10000),
    ]);
    if (rows.error) throw new Error(rows.error.message);
    if (all.error) throw new Error(all.error.message);

    let bankIn = 0;
    let bankOut = 0;
    for (const r of all.data ?? []) {
      if (r.kind === "entrada") bankIn += Number(r.amount);
      else bankOut += Number(r.amount);
    }

    return {
      entries: rows.data ?? [],
      bank: { income: bankIn, expense: bankOut, balance: bankIn - bankOut },
    };
  });

export const createCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        kind: z.enum(["entrada", "saida"]),
        category: z.string().min(1).default("Outras"),
        subcategoryId: z.string().uuid().nullable().default(null),
        description: z.string().min(1, "Informe a descrição"),
        amount: z.number().nonnegative(),
        entry_date: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { resolveSubcategory } = await import("@/lib/cash-validation.server");
    const resolved = await resolveSubcategory(
      context.supabase,
      data.chapterId,
      data.category,
      data.subcategoryId,
    );
    const { error } = await context.supabase.from("cash_entries").insert({
      chapter_id: data.chapterId,
      kind: data.kind,
      category: data.category,
      subcategory: resolved.subcategory,
      calendar_event_id: resolved.calendar_event_id,
      description: data.description,
      amount: data.amount,
      entry_date: data.entry_date,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["entrada", "saida"]),
        category: z.string().min(1),
        subcategoryId: z.string().uuid().nullable().default(null),
        description: z.string().min(1),
        amount: z.number().nonnegative(),
        entry_date: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { resolveSubcategory } = await import("@/lib/cash-validation.server");
    const { data: current, error: curErr } = await context.supabase
      .from("cash_entries")
      .select("chapter_id")
      .eq("id", data.id)
      .single();
    if (curErr) throw new Error(curErr.message);

    const resolved = await resolveSubcategory(
      context.supabase,
      current.chapter_id,
      data.category,
      data.subcategoryId,
    );

    const { id, subcategoryId, ...patch } = data;
    const { error } = await context.supabase
      .from("cash_entries")
      .update({
        ...patch,
        subcategory: resolved.subcategory,
        calendar_event_id: resolved.calendar_event_id,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deleteCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cash_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Importação em lote (planilha revisada pelo usuário). */
export const importCashEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        rows: z
          .array(
            z.object({
              kind: z.enum(["entrada", "saida"]),
              category: z.string().min(1),
              description: z.string().min(1),
              amount: z.number().nonnegative(),
              entry_date: z.string().min(1),
            }),
          )
          .min(1)
          .max(1000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cash_entries").insert(
      data.rows.map((r) => ({
        chapter_id: data.chapterId,
        kind: r.kind,
        category: r.category,
        description: r.description,
        amount: r.amount,
        entry_date: r.entry_date,
        created_by: context.userId,
      })),
    );
    if (error) throw new Error(error.message);
    return { imported: data.rows.length };
  });

/* ------------------------------- Categorias ------------------------------ */

/**
 * Categorias fixas do capítulo + subcategorias dinâmicas configuradas pelas
 * comissões de Eventos e Hospitalaria (com os eventos do calendário).
 */
export const listCashCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const [cats, calendar, subs] = await Promise.all([
      context.supabase
        .from("cash_categories")
        .select("id, name, sort_order, is_system")
        .eq("chapter_id", data.chapterId)
        .order("sort_order")
        .order("name"),
      context.supabase
        .from("calendar_events")
        .select("id, title, start_at")
        .eq("chapter_id", data.chapterId)
        .in("event_type", ["evento", "filantropia", "entretenimento"])
        .order("start_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("cash_subcategories")
        .select("id, scope, calendar_event_id, name, active")
        .eq("chapter_id", data.chapterId)
        .eq("active", true)
        .order("name"),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (subs.error) throw new Error(subs.error.message);

    return {
      categories: cats.data ?? [],
      events: calendar.data ?? [],
      subcategories: subs.data ?? [],
    };
  });


export const upsertCashCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "Informe o nome").max(60),
        sort_order: z.number().int().default(100),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("cash_categories")
        .update({ name: data.name, sort_order: data.sort_order })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("cash_categories").insert({
        chapter_id: data.chapterId,
        name: data.name,
        sort_order: data.sort_order,
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCashCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cash_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Mensalidades ----------------------------- */

/** Somente membros ATIVOS pagam mensalidade (Senior DeMolay e Maçom são isentos). */
export const listDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({ year: z.number().int(), month: z.number().int().min(1).max(12) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const [members, dues] = await Promise.all([
      context.supabase
        .from("members")
        .select("id, full_name, status, kind")
        .eq("chapter_id", data.chapterId)
        .eq("status", "regular")
        .eq("kind", "demolay_ativo")
        .order("full_name"),
      context.supabase
        .from("member_dues")
        .select("id, member_id, amount, status, paid_at, competence_year, competence_month")
        .eq("chapter_id", data.chapterId)
        .eq("competence_year", data.year)
        .eq("competence_month", data.month),
    ]);
    if (members.error) throw new Error(members.error.message);
    if (dues.error) throw new Error(dues.error.message);
    return { members: members.data ?? [], dues: dues.data ?? [] };
  });

export const upsertDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        memberId: z.string().uuid(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        amount: z.number().nonnegative(),
        status: z.enum(["em_aberto", "pago", "isento"]),
        paidAt: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const paidAt = data.paidAt || new Date().toISOString().slice(0, 10);

    const { data: existing } = await context.supabase
      .from("member_dues")
      .select("id, status, cash_entry_id")
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .eq("competence_year", data.year)
      .eq("competence_month", data.month)
      .maybeSingle();

    const { data: member, error: memberErr } = await context.supabase
      .from("members")
      .select("full_name")
      .eq("id", data.memberId)
      .single();
    if (memberErr) throw new Error(memberErr.message);

    let cashEntryId: string | null = existing?.cash_entry_id ?? null;

    // Deixou de estar pago → remove o lançamento automático correspondente.
    if (data.status !== "pago" && cashEntryId) {
      await context.supabase.from("cash_entries").delete().eq("id", cashEntryId);
      cashEntryId = null;
    }

    // Passou a estar pago → gera o lançamento automático no fluxo de caixa.
    if (data.status === "pago" && !cashEntryId && data.amount > 0) {
      const { data: entry, error: entryErr } = await context.supabase
        .from("cash_entries")
        .insert({
          chapter_id: data.chapterId,
          kind: "entrada",
          category: "Mensalidades",
          description: `Mensalidade - ${member.full_name} - ${competenceLabel(data.year, data.month)}`,
          amount: data.amount,
          entry_date: paidAt,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (entryErr) throw new Error(entryErr.message);
      cashEntryId = entry.id;
    }

    const payload = {
      chapter_id: data.chapterId,
      member_id: data.memberId,
      competence_year: data.year,
      competence_month: data.month,
      amount: data.amount,
      status: data.status,
      paid_at: data.status === "pago" ? paidAt : null,
      cash_entry_id: cashEntryId,
      created_by: context.userId,
    };

    const { error } = await context.supabase
      .from("member_dues")
      .upsert(payload, { onConflict: "chapter_id,member_id,competence_year,competence_month" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        amount: z.number().nonnegative(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: members, error: mErr } = await context.supabase
      .from("members")
      .select("id")
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .eq("kind", "demolay_ativo");
    if (mErr) throw new Error(mErr.message);
    const rows = (members ?? []).map((m) => ({
      chapter_id: data.chapterId,
      member_id: m.id,
      competence_year: data.year,
      competence_month: data.month,
      amount: data.amount,
      status: "em_aberto" as const,
      created_by: context.userId,
    }));
    if (rows.length === 0) return { created: 0 };
    const { error } = await context.supabase.from("member_dues").upsert(rows, {
      onConflict: "chapter_id,member_id,competence_year,competence_month",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });

/* --------------------- Assinaturas do relatório (PDF) -------------------- */

/** Nomes de PCC, MC, Tesoureiro e Consultor da Tesouraria para o relatório. */
export const getFinanceSigners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const now = new Date();
    const year = now.getFullYear();
    const semester = now.getMonth() < 6 ? 1 : 2;

    const { data: rows, error } = await context.supabase
      .from("member_positions")
      .select("member_id, term_year, term_semester, positions(code, label), members(full_name)")
      .eq("chapter_id", data.chapterId)
      .eq("term_year", year)
      .eq("term_semester", semester);
    if (error) throw new Error(error.message);

    const find = (codes: string[]) =>
      (rows ?? []).find((r: any) => codes.includes(r.positions?.code))?.members?.full_name ?? "";

    return [
      { role: "Presidente do Conselho Consultivo", name: find(["presidente_conselho", "pcc"]) },
      { role: "Mestre Conselheiro", name: find(["mestre_conselheiro", "mc"]) },
      { role: "Tesoureiro", name: find(["tesoureiro", "tes"]) },
      { role: "Consultor da Tesouraria", name: find(["consultor_tesouraria", "consultor"]) },
    ];
  });

/* -------------------- Mensalidade: lançamento manual --------------------- */

/**
 * Lançamento manual de mensalidade (vários meses, valor negociado, ajustes).
 * Mantém a descrição padrão e marca as competências como pagas.
 */
export const createManualDuesEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        memberId: z.string().uuid(),
        competences: z
          .array(
            z.object({
              year: z.number().int(),
              month: z.number().int().min(1).max(12),
            }),
          )
          .min(1, "Selecione ao menos uma competência")
          .max(24),
        amount: z.number().nonnegative(),
        entry_date: z.string().min(1),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: memberErr } = await context.supabase
      .from("members")
      .select("full_name")
      .eq("id", data.memberId)
      .single();
    if (memberErr) throw new Error(memberErr.message);

    const description = duesDescription(member.full_name, data.competences);

    const { data: entry, error: entryErr } = await context.supabase
      .from("cash_entries")
      .insert({
        chapter_id: data.chapterId,
        kind: "entrada",
        category: "Mensalidades",
        description,
        amount: data.amount,
        entry_date: data.entry_date,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (entryErr) throw new Error(entryErr.message);

    const share = data.competences.length > 0 ? data.amount / data.competences.length : 0;
    const { error: duesErr } = await context.supabase.from("member_dues").upsert(
      data.competences.map((c) => ({
        chapter_id: data.chapterId,
        member_id: data.memberId,
        competence_year: c.year,
        competence_month: c.month,
        amount: Number(share.toFixed(2)),
        status: "pago" as const,
        paid_at: data.entry_date,
        cash_entry_id: entry.id,
        notes: data.notes ?? null,
        created_by: context.userId,
      })),
      { onConflict: "chapter_id,member_id,competence_year,competence_month" },
    );
    if (duesErr) throw new Error(duesErr.message);

    return { ok: true, description };
  });

/** Membros ativos do capítulo (para o lançamento manual de mensalidade). */
export const listActiveMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("members")
      .select("id, full_name")
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .eq("kind", "demolay_ativo")
      .order("full_name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
