import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { competenceLabel, duesDescription } from "@/lib/cash-categories";
import {
  autoDueStatus,
  memberInYearTable,
  type AwayPeriod,
  type DueMemberLite,
} from "@/lib/dues-rules";

const chapterInput = z.object({ chapterId: z.string().uuid() });

export { competenceLabel };

async function loadAwayPeriodsByMember(
  supabase: { from: (t: string) => any },
  chapterId: string,
  memberIds: string[],
): Promise<Map<string, AwayPeriod[]>> {
  const map = new Map<string, AwayPeriod[]>();
  if (memberIds.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from("member_away_periods")
      .select("member_id, started_on, ended_on")
      .eq("chapter_id", chapterId)
      .in("member_id", memberIds);
    // Tabela pode ainda não existir se a migration não foi aplicada
    if (error) {
      console.error("loadAwayPeriodsByMember:", error.message);
      return map;
    }
    for (const row of data ?? []) {
      const list = map.get(row.member_id) ?? [];
      list.push({ started_on: row.started_on, ended_on: row.ended_on });
      map.set(row.member_id, list);
    }
  } catch (e: any) {
    console.error("loadAwayPeriodsByMember:", e?.message ?? e);
  }
  return map;
}

async function loadManualInclusionIds(
  supabase: { from: (t: string) => any },
  chapterId: string,
  year: number,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("member_dues_manual_inclusions")
      .select("member_id")
      .eq("chapter_id", chapterId)
      .eq("year", year);
    if (error) {
      console.error("loadManualInclusionIds:", error.message);
      return [];
    }
    return (data ?? []).map((r: { member_id: string }) => r.member_id);
  } catch (e: any) {
    console.error("loadManualInclusionIds:", e?.message ?? e);
    return [];
  }
}

function withAwayPeriods(
  members: DueMemberLite[],
  byMember: Map<string, AwayPeriod[]>,
): DueMemberLite[] {
  return members.map((m) => ({
    ...m,
    awayPeriods: byMember.get(m.id) ?? [],
  }));
}

async function applyAutoStatusesForOpenDues(
  supabase: { from: (t: string) => any },
  chapterId: string,
  year: number,
  rows: { member_id: string; competence_month: number; status: string }[],
) {
  const autoIsento = new Set(
    rows.filter((r) => r.status === "isento").map((r) => `${r.member_id}:${r.competence_month}`),
  );
  const autoDesligado = new Set(
    rows.filter((r) => r.status === "desligado").map((r) => `${r.member_id}:${r.competence_month}`),
  );
  if (autoIsento.size === 0 && autoDesligado.size === 0) return;

  const { data: openRows, error: openErr } = await supabase
    .from("member_dues")
    .select("id, member_id, competence_month")
    .eq("chapter_id", chapterId)
    .eq("competence_year", year)
    .eq("status", "em_aberto")
    .is("cash_entry_id", null);
  if (openErr) throw new Error(openErr.message);

  const isentoIds = (openRows ?? [])
    .filter((r: { member_id: string; competence_month: number }) =>
      autoIsento.has(`${r.member_id}:${r.competence_month}`),
    )
    .map((r: { id: string }) => r.id);
  const desligadoIds = (openRows ?? [])
    .filter((r: { member_id: string; competence_month: number }) =>
      autoDesligado.has(`${r.member_id}:${r.competence_month}`),
    )
    .map((r: { id: string }) => r.id);

  for (let i = 0; i < isentoIds.length; i += 200) {
    const chunk = isentoIds.slice(i, i + 200);
    const { error } = await supabase
      .from("member_dues")
      .update({ status: "isento", paid_at: null })
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < desligadoIds.length; i += 200) {
    const chunk = desligadoIds.slice(i, i + 200);
    const { error } = await supabase
      .from("member_dues")
      .update({ status: "desligado", paid_at: null })
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }
}


/* ----------------------------- Fluxo de caixa ---------------------------- */

/**
 * Lista lançamentos do mês ou de todo o ano (`month: null`) e devolve
 * totais do banco, além do saldo de abertura (caixa remanescente do ano anterior /
 * acumulado até o início do período).
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

    const periodStart = data.month
      ? `${data.year}-${String(data.month).padStart(2, "0")}-01`
      : `${data.year}-01-01`;

    if (data.month) {
      const end = new Date(data.year, data.month, 1).toISOString().slice(0, 10);
      query = query.gte("entry_date", periodStart).lt("entry_date", end);
    } else {
      const end = `${data.year + 1}-01-01`;
      query = query.gte("entry_date", periodStart).lt("entry_date", end);
    }

    const [rows, all, prior] = await Promise.all([
      query.order("entry_date", { ascending: false }).limit(2000),
      context.supabase
        .from("cash_entries")
        .select("kind, amount")
        .eq("chapter_id", data.chapterId)
        .limit(10000),
      context.supabase
        .from("cash_entries")
        .select("kind, amount")
        .eq("chapter_id", data.chapterId)
        .lt("entry_date", periodStart)
        .limit(10000),
    ]);
    if (rows.error) throw new Error(rows.error.message);
    if (all.error) throw new Error(all.error.message);
    if (prior.error) throw new Error(prior.error.message);

    let bankIn = 0;
    let bankOut = 0;
    for (const r of all.data ?? []) {
      if (r.kind === "entrada") bankIn += Number(r.amount);
      else bankOut += Number(r.amount);
    }

    let openingBalance = 0;
    for (const r of prior.data ?? []) {
      if (r.kind === "entrada") openingBalance += Number(r.amount);
      else openingBalance -= Number(r.amount);
    }

    return {
      entries: rows.data ?? [],
      bank: { income: bankIn, expense: bankOut, balance: bankIn - bankOut },
      opening: {
        balance: openingBalance,
        previousYear: data.year - 1,
      },
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

const DEFAULT_DUES_AMOUNT = 50;

async function readDefaultDuesAmount(
  supabase: { from: (t: string) => any },
  chapterId: string,
): Promise<number> {
  const { data } = await supabase
    .from("chapters")
    .select("settings")
    .eq("id", chapterId)
    .single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const raw = settings.default_dues_amount;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DUES_AMOUNT;
}

/** Persistência do valor padrão de mensalidade em chapters.settings. */
export const saveDefaultDuesAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ amount: z.number().nonnegative() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readErr } = await context.supabase
      .from("chapters")
      .select("settings")
      .eq("id", data.chapterId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const settings = {
      ...(((current?.settings as Record<string, unknown> | null) ?? {}) as Record<string, unknown>),
      default_dues_amount: data.amount,
    };
    const { error } = await context.supabase
      .from("chapters")
      .update({ settings: settings as never })
      .eq("id", data.chapterId);
    if (error) throw new Error(error.message);
    return { amount: data.amount };
  });

const MEMBER_DUES_SELECT =
  "id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico";

type YearDuesResult = {
  members: DueMemberLite[];
  dues: {
    id: string;
    member_id: string;
    amount: number | string;
    status: string;
    paid_at: string | null;
    competence_year: number;
    competence_month: number;
    cash_entry_id: string | null;
  }[];
  defaultAmount: number;
};

/** Núcleo compartilhado do calendário anual (evita reentrada de createServerFn). */
async function fetchYearDues(
  supabase: { from: (t: string) => any },
  userId: string,
  chapterId: string,
  year: number,
  ensure: boolean,
): Promise<YearDuesResult> {
  const membersQuery = supabase
    .from("members")
    .select(MEMBER_DUES_SELECT)
    .eq("chapter_id", chapterId)
    .eq("status", "regular")
    .in("kind", ["demolay_ativo", "senior"])
    .order("full_name");

  const duesQuery = supabase
    .from("member_dues")
    .select(
      "id, member_id, amount, status, paid_at, competence_year, competence_month, cash_entry_id",
    )
    .eq("chapter_id", chapterId)
    .eq("competence_year", year);

  async function resolveMembers(
    baseRows: DueMemberLite[],
    inclusionIds: string[],
    duesMemberIds: string[],
  ): Promise<DueMemberLite[]> {
    const eligible = baseRows
      .filter((m) => memberInYearTable(m, year))
      .map((m) => ({ ...m, manualInclude: false }));

    const byId = new Map(eligible.map((m) => [m.id, m]));
    const extraIds = [
      ...new Set([...inclusionIds, ...duesMemberIds].filter((id) => !byId.has(id))),
    ];

    if (extraIds.length > 0) {
      const { data: extra, error } = await supabase
        .from("members")
        .select(MEMBER_DUES_SELECT)
        .eq("chapter_id", chapterId)
        .in("id", extraIds)
        .order("full_name");
      if (error) throw new Error(error.message);
      const inclusionSet = new Set(inclusionIds);
      for (const m of (extra ?? []) as DueMemberLite[]) {
        byId.set(m.id, {
          ...m,
          // Sem tabela de inclusões, quem só entra via dues conta como manual
          manualInclude: inclusionSet.has(m.id) || !memberInYearTable(m, year),
        });
      }
    }

    for (const id of inclusionIds) {
      const m = byId.get(id);
      if (m) byId.set(id, { ...m, manualInclude: true });
    }

    return [...byId.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, "pt-BR"),
    );
  }

  const [defaultAmount, membersRes, duesRes, inclusionIds] = await Promise.all([
    readDefaultDuesAmount(supabase, chapterId),
    membersQuery,
    duesQuery,
    loadManualInclusionIds(supabase, chapterId, year),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (duesRes.error) throw new Error(duesRes.error.message);

  let dues = duesRes.data ?? [];
  const duesMemberIds = [...new Set(dues.map((d: { member_id: string }) => d.member_id))];

  let members = await resolveMembers(
    (membersRes.data ?? []) as DueMemberLite[],
    inclusionIds,
    duesMemberIds,
  );
  const away = await loadAwayPeriodsByMember(
    supabase,
    chapterId,
    members.map((m) => m.id),
  );
  members = withAwayPeriods(members, away);

  if (ensure && members.length > 0) {
    const rows = members.flatMap((m) =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        return {
          chapter_id: chapterId,
          member_id: m.id,
          competence_year: year,
          competence_month: month,
          amount: defaultAmount,
          status: autoDueStatus(m, year, month),
          created_by: userId,
        };
      }),
    );
    const { error: ensErr } = await supabase.from("member_dues").upsert(rows, {
      onConflict: "chapter_id,member_id,competence_year,competence_month",
      ignoreDuplicates: true,
    });
    if (ensErr) {
      // Ainda devolve membros para a UI não ficar vazia (ex.: enum/migration pendente)
      console.error("listYearDues ensure upsert:", ensErr.message);
    } else {
      try {
        await applyAutoStatusesForOpenDues(supabase, chapterId, year, rows);
      } catch (e: any) {
        console.error("listYearDues applyAutoStatuses:", e?.message ?? e);
      }
      const refreshed = await duesQuery;
      if (!refreshed.error) dues = refreshed.data ?? [];
    }
  }

  return { members, dues, defaultAmount };
}

/**
 * Calendário anual: membros elegíveis + inclusões manuais + quem já tem competência no ano.
 */
export const listYearDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        ensure: z.boolean().optional().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) =>
    fetchYearDues(
      context.supabase,
      context.userId,
      data.chapterId,
      data.year,
      data.ensure ?? true,
    ),
  );

/** Candidatos a inclusão manual (qualquer membro do capítulo fora da tabela do ano, incl. irregulares). */
export const listDuesInclusionCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ year: z.number().int() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const yearData = await fetchYearDues(
      context.supabase,
      context.userId,
      data.chapterId,
      data.year,
      false,
    );
    const inTable = new Set(yearData.members.map((m) => m.id));

    const { data: all, error } = await context.supabase
      .from("members")
      .select("id, full_name, status, kind")
      .eq("chapter_id", data.chapterId)
      .order("full_name");
    if (error) throw new Error(error.message);

    const candidates = ((all ?? []) as DueMemberLite[])
      .filter((m) => !inTable.has(m.id))
      .map((m) => ({
        id: m.id,
        full_name: m.full_name,
        status: m.status,
        kind: m.kind,
      }));

    candidates.sort((a, b) => {
      const ai = a.status === "irregular" ? 0 : 1;
      const bi = b.status === "irregular" ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.full_name.localeCompare(b.full_name, "pt-BR");
    });

    return {
      candidates,
      inTableCount: inTable.size,
      chapterMemberCount: (all ?? []).length,
    };
  });

/** Inclui membro manualmente no calendário do ano e gera competências. */
export const includeMemberInYearDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        memberId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: mErr } = await context.supabase
      .from("members")
      .select(
        "id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico, chapter_id",
      )
      .eq("id", data.memberId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Membro não encontrado neste capítulo");

    const { error: incErr } = await context.supabase
      .from("member_dues_manual_inclusions")
      .upsert(
        {
          chapter_id: data.chapterId,
          member_id: data.memberId,
          year: data.year,
          created_by: context.userId,
        },
        { onConflict: "chapter_id,member_id,year" },
      );
    if (incErr) {
      if (/member_dues_manual_inclusions|does not exist|schema cache/i.test(incErr.message)) {
        // Migration ainda não aplicada: segue só com as competências do ano
        console.warn("includeMemberInYearDues: tabela de inclusões ausente — usando só member_dues");
      } else {
        throw new Error(incErr.message);
      }
    }

    // Irregular sem período aberto: abre afastamento no ano para marcar meses como desligado
    if (member.status === "irregular") {
      const { data: openAway } = await context.supabase
        .from("member_away_periods")
        .select("id")
        .eq("member_id", data.memberId)
        .is("ended_on", null)
        .maybeSingle();
      if (!openAway) {
        const { error: awayErr } = await context.supabase.from("member_away_periods").insert({
          member_id: data.memberId,
          chapter_id: data.chapterId,
          started_on: `${data.year}-01-01`,
          ended_on: null,
          created_by: context.userId,
        });
        if (awayErr) {
          if (!/member_away_periods|does not exist|schema cache/i.test(awayErr.message)) {
            throw new Error(awayErr.message);
          }
          console.warn("includeMemberInYearDues: tabela de afastamentos ausente");
        }
      }
    }

    const defaultAmount = await readDefaultDuesAmount(context.supabase, data.chapterId);
    const away = await loadAwayPeriodsByMember(context.supabase, data.chapterId, [
      data.memberId,
    ]);
    const lite: DueMemberLite = {
      ...(member as DueMemberLite),
      awayPeriods: away.get(data.memberId) ?? [],
      manualInclude: true,
    };

    const rows = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return {
        chapter_id: data.chapterId,
        member_id: data.memberId,
        competence_year: data.year,
        competence_month: month,
        amount: defaultAmount,
        status: autoDueStatus(lite, data.year, month),
        created_by: context.userId,
      };
    });

    const { error: duesErr } = await context.supabase.from("member_dues").upsert(rows, {
      onConflict: "chapter_id,member_id,competence_year,competence_month",
      ignoreDuplicates: true,
    });
    if (duesErr) throw new Error(duesErr.message);

    await applyAutoStatusesForOpenDues(context.supabase, data.chapterId, data.year, rows);

    return { ok: true, memberId: data.memberId };
  });

/** Remove inclusão manual e as competências do ano (lançamentos de caixa já feitos permanecem). */
export const removeMemberFromYearDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        memberId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error: incErr } = await context.supabase
      .from("member_dues_manual_inclusions")
      .delete()
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .eq("year", data.year);
    if (
      incErr &&
      !/member_dues_manual_inclusions|does not exist|schema cache/i.test(incErr.message)
    ) {
      throw new Error(incErr.message);
    }

    // Sem isso o membro reaparece via competências existentes no ano
    const { error: duesErr } = await context.supabase
      .from("member_dues")
      .delete()
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .eq("competence_year", data.year);
    if (duesErr) throw new Error(duesErr.message);

    return { ok: true };
  });

/** Compat: lista um mês a partir do calendário anual. */
export const listDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({ year: z.number().int(), month: z.number().int().min(1).max(12) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const yearData = await fetchYearDues(
      context.supabase,
      context.userId,
      data.chapterId,
      data.year,
      false,
    );
    return {
      members: yearData.members,
      dues: yearData.dues.filter((d) => d.competence_month === data.month),
      defaultAmount: yearData.defaultAmount,
    };
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
        status: z.enum(["em_aberto", "pago", "isento", "desligado"]),
        paidAt: z.string().optional(),
        /** Se true, marca pago sem criar lançamento no fluxo de caixa. */
        skipCashEntry: z.boolean().optional().default(false),
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

    let cashEntryId: string | null = existing?.cash_entry_id ?? null;

    if (data.status !== "pago" && cashEntryId) {
      await context.supabase.from("cash_entries").delete().eq("id", cashEntryId);
      cashEntryId = null;
    }

    const needsCashEntry =
      data.status === "pago" && !cashEntryId && data.amount > 0 && !data.skipCashEntry;

    if (needsCashEntry) {
      const { data: member, error: memberErr } = await context.supabase
        .from("members")
        .select("full_name")
        .eq("id", data.memberId)
        .single();
      if (memberErr) throw new Error(memberErr.message);

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

    const { data: row, error } = await context.supabase
      .from("member_dues")
      .upsert(payload, { onConflict: "chapter_id,member_id,competence_year,competence_month" })
      .select(
        "id, member_id, amount, status, paid_at, competence_year, competence_month, cash_entry_id",
      )
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Ações em lote no calendário do ano.
 * - pay_all / pay_except_jan_dec: baixa em aberto (mês atual e anteriores)
 * - open_all: reabre todas as competências do ano (remove caixa vinculado)
 * - exempt_all: isenta todas as competências do ano (remove caixa vinculado)
 */
export const bulkYearDuesAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        action: z.enum(["pay_all", "pay_except_jan_dec", "open_all", "exempt_all"]),
        amount: z.number().nonnegative().optional(),
        paidAt: z.string().optional(),
        skipCashEntry: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const amount =
      data.amount ?? (await readDefaultDuesAmount(context.supabase, data.chapterId));
    const paidAt = data.paidAt || new Date().toISOString().slice(0, 10);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const maxMonth =
      data.year > currentYear ? 0 : data.year < currentYear ? 12 : currentMonth;

    if (data.action === "pay_all" || data.action === "pay_except_jan_dec") {
      if (maxMonth === 0) return { updated: 0, action: data.action };

      let q = context.supabase
        .from("member_dues")
        .select("id, member_id, competence_month, cash_entry_id, members(full_name)")
        .eq("chapter_id", data.chapterId)
        .eq("competence_year", data.year)
        .eq("status", "em_aberto")
        .lte("competence_month", maxMonth);

      const { data: openRows, error: openErr } = await q;
      if (openErr) throw new Error(openErr.message);

      const toPay = (openRows ?? []).filter((d) =>
        data.action === "pay_except_jan_dec"
          ? d.competence_month !== 1 && d.competence_month !== 12
          : true,
      );

      let updated = 0;
      for (const d of toPay) {
        let cashEntryId: string | null = d.cash_entry_id ?? null;
        const memberName =
          (d.members as { full_name?: string } | null)?.full_name ?? "Membro";

        if (!cashEntryId && amount > 0 && !data.skipCashEntry) {
          const { data: entry, error: entryErr } = await context.supabase
            .from("cash_entries")
            .insert({
              chapter_id: data.chapterId,
              kind: "entrada",
              category: "Mensalidades",
              description: `Mensalidade - ${memberName} - ${competenceLabel(data.year, d.competence_month)}`,
              amount,
              entry_date: paidAt,
              created_by: context.userId,
            })
            .select("id")
            .single();
          if (entryErr) throw new Error(entryErr.message);
          cashEntryId = entry.id;
        }

        const { error } = await context.supabase
          .from("member_dues")
          .update({
            status: "pago",
            amount,
            paid_at: paidAt,
            cash_entry_id: cashEntryId,
          })
          .eq("id", d.id);
        if (error) throw new Error(error.message);
        updated += 1;
      }
      return { updated, action: data.action };
    }

    // open_all / exempt_all
    const targetStatus = data.action === "open_all" ? "em_aberto" : "isento";
    const { data: rows, error: rowsErr } = await context.supabase
      .from("member_dues")
      .select("id, cash_entry_id, status")
      .eq("chapter_id", data.chapterId)
      .eq("competence_year", data.year);
    if (rowsErr) throw new Error(rowsErr.message);

    const cashIds = (rows ?? [])
      .map((r) => r.cash_entry_id)
      .filter((id): id is string => !!id);
    if (cashIds.length > 0) {
      for (let i = 0; i < cashIds.length; i += 200) {
        const chunk = cashIds.slice(i, i + 200);
        const { error: delErr } = await context.supabase
          .from("cash_entries")
          .delete()
          .in("id", chunk);
        if (delErr) throw new Error(delErr.message);
      }
    }

    const ids = (rows ?? []).map((r) => r.id);
    let updated = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error, count } = await context.supabase
        .from("member_dues")
        .update({
          status: targetStatus,
          paid_at: null,
          cash_entry_id: null,
          amount,
        })
        .in("id", chunk);
      if (error) throw new Error(error.message);
      updated += count ?? chunk.length;
    }
    return { updated, action: data.action };
  });

/** Gera competências do ano/mês com isenções automáticas (não sobrescreve existentes). */
export const generateDues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        year: z.number().int(),
        month: z.number().int().min(1).max(12).optional(),
        amount: z.number().nonnegative().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const amount =
      data.amount ?? (await readDefaultDuesAmount(context.supabase, data.chapterId));

    const { data: allMembers, error: mErr } = await context.supabase
      .from("members")
      .select("id, full_name, status, kind, birth_date, iniciacao_ordem, exam_grau_iniciatico")
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .in("kind", ["demolay_ativo", "senior"]);
    if (mErr) throw new Error(mErr.message);

    let members = ((allMembers ?? []) as DueMemberLite[]).filter((m) =>
      memberInYearTable(m, data.year),
    );
    const away = await loadAwayPeriodsByMember(
      context.supabase,
      data.chapterId,
      members.map((m) => m.id),
    );
    members = withAwayPeriods(members, away);

    const months = data.month
      ? [data.month]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    const rows = members.flatMap((m) =>
      months.map((month) => ({
        chapter_id: data.chapterId,
        member_id: m.id,
        competence_year: data.year,
        competence_month: month,
        amount,
        status: autoDueStatus(m, data.year, month),
        created_by: context.userId,
      })),
    );

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

/* ------------------------------- Cobranças ------------------------------- */

export const listMemberCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        status: z.enum(["all", "em_aberto", "pago", "isento"]).optional().default("all"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("member_charges")
      .select(
        "id, member_id, kind, category, subcategory, description, amount, due_date, status, paid_at, cash_entry_id, notes, created_at, members(full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .order("due_date", { ascending: false })
      .limit(500);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      member_name: r.members?.full_name ?? "",
      members: undefined,
    }));
  });

export const upsertMemberCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        id: z.string().uuid().optional(),
        memberId: z.string().uuid(),
        kind: z.enum(["entrada", "saida"]).default("entrada"),
        category: z.string().min(1).default("Outras"),
        subcategory: z.string().nullable().optional().default(null),
        description: z.string().min(1),
        amount: z.number().nonnegative(),
        dueDate: z.string().min(1),
        status: z.enum(["em_aberto", "pago", "isento"]).default("em_aberto"),
        paidAt: z.string().optional(),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const paidAt = data.paidAt || new Date().toISOString().slice(0, 10);

    const { data: member, error: memberErr } = await context.supabase
      .from("members")
      .select("full_name")
      .eq("id", data.memberId)
      .single();
    if (memberErr) throw new Error(memberErr.message);

    let cashEntryId: string | null = null;
    if (data.id) {
      const { data: existing } = await context.supabase
        .from("member_charges")
        .select("cash_entry_id")
        .eq("id", data.id)
        .maybeSingle();
      cashEntryId = existing?.cash_entry_id ?? null;
    }

    if (data.status !== "pago" && cashEntryId) {
      await context.supabase.from("cash_entries").delete().eq("id", cashEntryId);
      cashEntryId = null;
    }

    if (data.status === "pago" && !cashEntryId && data.amount > 0) {
      const { data: entry, error: entryErr } = await context.supabase
        .from("cash_entries")
        .insert({
          chapter_id: data.chapterId,
          kind: data.kind,
          category: data.category,
          subcategory: data.subcategory,
          description: data.description,
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
      kind: data.kind,
      category: data.category,
      subcategory: data.subcategory,
      description: data.description,
      amount: data.amount,
      due_date: data.dueDate,
      status: data.status,
      paid_at: data.status === "pago" ? paidAt : null,
      cash_entry_id: cashEntryId,
      notes: data.notes ?? null,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("member_charges")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("member_charges").insert(payload);
      if (error) throw new Error(error.message);
    }

    return { ok: true, memberName: member.full_name };
  });

export const deleteMemberCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("member_charges")
      .select("cash_entry_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.cash_entry_id) {
      await context.supabase.from("cash_entries").delete().eq("id", existing.cash_entry_id);
    }
    const { error } = await context.supabase.from("member_charges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Membros regulares (qualquer tipo) para atribuir cobranças. */
export const listChargeMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("members")
      .select("id, full_name, kind")
      .eq("chapter_id", data.chapterId)
      .eq("status", "regular")
      .order("full_name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
