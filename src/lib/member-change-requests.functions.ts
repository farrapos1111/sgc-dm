import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayYmd } from "@/lib/timezone";

const changeItemSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  before: z.string().nullable(),
  after: z.string().nullable(),
});

const MASTER_FIELDS = new Set([
  "full_name",
  "birth_date",
  "phone",
  "email",
  "demolay_id",
  "masonic_id",
  "iniciacao_ordem",
  "exam_grau_iniciatico",
  "iniciacao_grau_demolay",
  "exam_grau_demolay",
  "initiation_chapter_id",
  "status",
  "kind",
  "address_zip",
  "address_street",
  "address_number",
  "address_complement",
  "address_neighborhood",
  "address_city",
  "address_state",
  "address_country",
]);

const STATUS_VALUES = new Set(["regular", "irregular"]);
const KIND_VALUES = new Set(["demolay_ativo", "senior", "macom"]);

function pickPatched<T>(
  patch: Record<string, unknown>,
  field: string,
  existing: T,
): T {
  return field in patch ? (patch[field] as T) : existing;
}

async function applyStatusSideEffects(
  supabase: {
    from: (t: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  },
  opts: {
    memberId: string;
    chapterId: string;
    userId: string;
    prevStatus: string;
    nextStatus: string;
  },
) {
  const { memberId, chapterId, userId, prevStatus, nextStatus } = opts;
  if (prevStatus === nextStatus) return;

  const effectiveOn = todayYmd();

  if (prevStatus === "regular" && nextStatus === "irregular") {
    const { error: awayErr } = await supabase.from("member_away_periods").insert({
      member_id: memberId,
      chapter_id: chapterId,
      started_on: effectiveOn,
      ended_on: null,
      created_by: userId,
    });
    if (awayErr) throw new Error(awayErr.message);

    const { error: duesErr } = await supabase.rpc("desligar_open_dues_from", {
      _member_id: memberId,
      _from: effectiveOn,
    });
    if (duesErr) throw new Error(duesErr.message);
  } else if (prevStatus === "irregular" && nextStatus === "regular") {
    const { data: openPeriod, error: openErr } = await supabase
      .from("member_away_periods")
      .select("id")
      .eq("member_id", memberId)
      .eq("chapter_id", chapterId)
      .is("ended_on", null)
      .maybeSingle();
    if (openErr) throw new Error(openErr.message);

    if (openPeriod) {
      const { error: closeErr } = await supabase
        .from("member_away_periods")
        .update({ ended_on: effectiveOn })
        .eq("id", openPeriod.id);
      if (closeErr) throw new Error(closeErr.message);
    }
  }
}

export const createMemberChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        requestingChapterId: z.string().uuid(),
        changes: z.array(changeItemSchema).min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    for (const c of data.changes) {
      if (!MASTER_FIELDS.has(c.field)) {
        throw new Error(`Campo não permitido na solicitação: ${c.field}`);
      }
    }

    const { data: member, error: mErr } = await context.supabase
      .from("members")
      .select("id, chapter_id")
      .eq("id", data.memberId)
      .single();
    if (mErr) throw new Error(mErr.message);

    if (member.chapter_id === data.requestingChapterId) {
      throw new Error(
        "Este capítulo é o originário do cadastro — edite os dados diretamente.",
      );
    }

    const { data: pending, error: pendingErr } = await context.supabase
      .from("member_change_requests" as "members")
      .select("id")
      .eq("member_id" as never, data.memberId)
      .eq("requesting_chapter_id" as never, data.requestingChapterId)
      .eq("status" as never, "pending")
      .maybeSingle();
    if (pendingErr) throw new Error(pendingErr.message);
    if (pending) {
      throw new Error("Já existe uma solicitação pendente deste capítulo para este membro.");
    }

    const { data: row, error } = await context.supabase
      .from("member_change_requests" as "members")
      .insert({
        member_id: data.memberId,
        requesting_chapter_id: data.requestingChapterId,
        origin_chapter_id: member.chapter_id,
        requested_by: context.userId,
        status: "pending",
        changes: data.changes,
      } as never)
      .select("id")
      .single();
    if (error) {
      // Unique violation = race com outra solicitação pendente
      if ((error as { code?: string }).code === "23505") {
        throw new Error(
          "Já existe uma solicitação pendente deste capítulo para este membro.",
        );
      }
      throw new Error(error.message);
    }
    return { id: (row as { id: string }).id };
  });

export const listPendingChangeRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ originChapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("member_change_requests" as "members")
      .select(
        `id, member_id, requesting_chapter_id, origin_chapter_id, status, changes, created_at,
         member:members(id, full_name, demolay_id),
         requesting_chapter:chapters!member_change_requests_requesting_chapter_id_fkey(id, name, number, city)`,
      )
      .eq("origin_chapter_id" as never, data.originChapterId)
      .eq("status" as never, "pending")
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const countPendingChangeRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ originChapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("member_change_requests" as "members")
      .select("id", { count: "exact", head: true })
      .eq("origin_chapter_id" as never, data.originChapterId)
      .eq("status" as never, "pending");
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const reviewMemberChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        reviewNote: z.string().optional().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: req, error: rErr } = await context.supabase
      .from("member_change_requests" as "members")
      .select("id, member_id, origin_chapter_id, status, changes")
      .eq("id" as never, data.requestId)
      .single();
    if (rErr) throw new Error(rErr.message);

    const request = req as unknown as {
      id: string;
      member_id: string;
      origin_chapter_id: string;
      status: string;
      changes: { field: string; before: string | null; after: string | null }[];
    };

    if (request.status !== "pending") {
      throw new Error("Esta solicitação já foi analisada.");
    }

    // Consome a solicitação primeiro (evita estado inconsistente se side effects falharem depois).
    const { data: claimed, error: claimErr } = await context.supabase
      .from("member_change_requests" as "members")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.reviewNote || null,
      } as never)
      .eq("id" as never, data.requestId)
      .eq("status" as never, "pending")
      .select("id")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) {
      throw new Error("Esta solicitação já foi analisada.");
    }

    if (data.decision === "approved") {
      const { data: member, error: mErr } = await context.supabase
        .from("members")
        .select(
          "id, chapter_id, full_name, birth_date, phone, email, address, status, kind, demolay_id, masonic_id, iniciacao_ordem, exam_grau_iniciatico, iniciacao_grau_demolay, exam_grau_demolay, initiation_chapter_id",
        )
        .eq("id", request.member_id)
        .single();
      if (mErr) throw new Error(mErr.message);

      const addr = (member.address ?? {}) as Record<string, string | null>;
      const patch: Record<string, unknown> = {};
      const addressPatch = { ...addr };

      for (const change of request.changes ?? []) {
        const f = change.field;
        if (!MASTER_FIELDS.has(f)) {
          throw new Error(`Campo não permitido na aprovação: ${f}`);
        }
        if (f === "status") {
          if (change.after == null || !STATUS_VALUES.has(change.after)) {
            throw new Error(`Status inválido na solicitação: ${change.after}`);
          }
          patch[f] = change.after;
        } else if (f === "kind") {
          if (change.after == null || !KIND_VALUES.has(change.after)) {
            throw new Error(`Tipo inválido na solicitação: ${change.after}`);
          }
          patch[f] = change.after;
        } else if (f.startsWith("address_")) {
          const key = f.replace(/^address_/, "");
          addressPatch[key] = change.after;
        } else {
          patch[f] = change.after;
        }
      }

      const prevStatus = member.status as string;
      const nextStatus = pickPatched(patch, "status", member.status) as string;

      const args = {
        _member_id: member.id,
        _full_name: pickPatched(patch, "full_name", member.full_name),
        _birth_date: pickPatched(patch, "birth_date", member.birth_date),
        _cpf: "",
        _rg: "",
        _phone: pickPatched(patch, "phone", member.phone ?? ""),
        _email: pickPatched(patch, "email", member.email ?? ""),
        _address: addressPatch,
        _status: nextStatus,
        _kind: pickPatched(patch, "kind", member.kind),
        _exam_grau_iniciatico: pickPatched(
          patch,
          "exam_grau_iniciatico",
          member.exam_grau_iniciatico,
        ),
        _exam_grau_demolay: pickPatched(
          patch,
          "exam_grau_demolay",
          member.exam_grau_demolay,
        ),
        _iniciacao_ordem: pickPatched(patch, "iniciacao_ordem", member.iniciacao_ordem),
        _iniciacao_grau_demolay: pickPatched(
          patch,
          "iniciacao_grau_demolay",
          member.iniciacao_grau_demolay,
        ),
        _demolay_id: pickPatched(patch, "demolay_id", member.demolay_id),
        _masonic_id: pickPatched(patch, "masonic_id", member.masonic_id),
        _guardians: null,
        _initiation_chapter_id: pickPatched(
          patch,
          "initiation_chapter_id",
          (member as { initiation_chapter_id?: string | null }).initiation_chapter_id ??
            null,
        ),
      };

      const { error: updErr } = await context.supabase.rpc(
        "update_member_with_pii",
        args as never,
      );
      if (updErr) throw new Error(updErr.message);

      await applyStatusSideEffects(context.supabase as never, {
        memberId: member.id,
        chapterId: member.chapter_id,
        userId: context.userId,
        prevStatus,
        nextStatus,
      });
    }

    return { ok: true };
  });

/** Solicita vínculo do membro a outro capítulo (aprovação do originário). */
export const createMemberAffiliationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        requestingChapterId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: mErr } = await context.supabase
      .from("members")
      .select("id, chapter_id")
      .eq("id", data.memberId)
      .single();
    if (mErr) throw new Error(mErr.message);

    if (member.chapter_id === data.requestingChapterId) {
      throw new Error("Este capítulo já é o originário do cadastro.");
    }

    const { data: existingAff, error: affErr } = await context.supabase
      .from("member_chapter_affiliations" as "members")
      .select("id")
      .eq("member_id" as never, data.memberId)
      .eq("chapter_id" as never, data.requestingChapterId)
      .eq("active" as never, true)
      .maybeSingle();
    if (affErr) throw new Error(affErr.message);
    if (existingAff) {
      throw new Error("Este membro já está vinculado a este capítulo.");
    }

    const { data: pending, error: pendingErr } = await context.supabase
      .from("member_affiliation_requests" as "members")
      .select("id")
      .eq("member_id" as never, data.memberId)
      .eq("requesting_chapter_id" as never, data.requestingChapterId)
      .eq("status" as never, "pending")
      .maybeSingle();
    if (pendingErr) throw new Error(pendingErr.message);
    if (pending) {
      throw new Error(
        "Já existe uma solicitação de vínculo pendente deste capítulo para este membro.",
      );
    }

    const { data: row, error } = await context.supabase
      .from("member_affiliation_requests" as "members")
      .insert({
        member_id: data.memberId,
        requesting_chapter_id: data.requestingChapterId,
        origin_chapter_id: member.chapter_id,
        requested_by: context.userId,
        status: "pending",
      } as never)
      .select("id")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error(
          "Já existe uma solicitação de vínculo pendente deste capítulo para este membro.",
        );
      }
      throw new Error(error.message);
    }
    return { id: (row as { id: string }).id };
  });

export const listPendingAffiliationRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ originChapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("member_affiliation_requests" as "members")
      .select(
        `id, member_id, requesting_chapter_id, origin_chapter_id, status, created_at,
         member:members(id, full_name, demolay_id),
         requesting_chapter:chapters!member_affiliation_requests_requesting_chapter_id_fkey(id, name, number, city)`,
      )
      .eq("origin_chapter_id" as never, data.originChapterId)
      .eq("status" as never, "pending")
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const reviewMemberAffiliationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        reviewNote: z.string().optional().default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: req, error: rErr } = await context.supabase
      .from("member_affiliation_requests" as "members")
      .select("id, member_id, requesting_chapter_id, origin_chapter_id, status")
      .eq("id" as never, data.requestId)
      .single();
    if (rErr) throw new Error(rErr.message);

    const request = req as unknown as {
      id: string;
      member_id: string;
      requesting_chapter_id: string;
      origin_chapter_id: string;
      status: string;
    };

    if (request.status !== "pending") {
      throw new Error("Esta solicitação já foi analisada.");
    }

    const { error: upErr } = await context.supabase.rpc(
      "review_member_affiliation_request" as never,
      {
        _request_id: data.requestId,
        _decision: data.decision,
        _review_note: data.reviewNote || null,
      } as never,
    );
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

export const countPendingMemberRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ originChapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const [changes, affiliations] = await Promise.all([
      context.supabase
        .from("member_change_requests" as "members")
        .select("id", { count: "exact", head: true })
        .eq("origin_chapter_id" as never, data.originChapterId)
        .eq("status" as never, "pending"),
      context.supabase
        .from("member_affiliation_requests" as "members")
        .select("id", { count: "exact", head: true })
        .eq("origin_chapter_id" as never, data.originChapterId)
        .eq("status" as never, "pending"),
    ]);
    if (changes.error) throw new Error(changes.error.message);
    if (affiliations.error) throw new Error(affiliations.error.message);
    return {
      count: (changes.count ?? 0) + (affiliations.count ?? 0),
      changes: changes.count ?? 0,
      affiliations: affiliations.count ?? 0,
    };
  });
