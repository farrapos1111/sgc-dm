import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const termInput = z.object({
  chapterId: z.string().uuid(),
  year: z.number().int().min(1900).max(2200),
  semester: z.union([z.literal(1), z.literal(2)]),
});

export const listCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [pos, com] = await Promise.all([
      context.supabase
        .from("positions")
        .select("id, code, label, scope, sort_order")
        .order("sort_order"),
      context.supabase.from("commissions").select("id, code, label, sort_order").order("sort_order"),
    ]);
    if (pos.error) throw new Error(pos.error.message);
    if (com.error) throw new Error(com.error.message);
    return { positions: pos.data ?? [], commissions: com.data ?? [] };
  });

export const listChapterPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => termInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("member_positions")
      .select(
        "id, position_id, member_id, term_year, term_semester, position:positions(id, code, label, scope, sort_order), member:members(id, full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const assignPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    termInput.extend({ memberId: z.string().uuid(), positionId: z.number().int() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const MULTI_SEAT_POSITIONS = [25]; // Conselheiro Consultor: vários titulares por vigência
    if (!MULTI_SEAT_POSITIONS.includes(data.positionId)) {
      // cargo de titular único: libera a vaga da vigência antes de atribuir
      const { error: delErr } = await context.supabase
        .from("member_positions")
        .delete()
        .eq("chapter_id", data.chapterId)
        .eq("position_id", data.positionId)
        .eq("term_year", data.year)
        .eq("term_semester", data.semester);
      if (delErr) throw new Error(delErr.message);
    }
    const { error } = await context.supabase.from("member_positions").upsert(
      {
        chapter_id: data.chapterId,
        member_id: data.memberId,
        position_id: data.positionId,
        term_year: data.year,
        term_semester: data.semester,
      },
      { onConflict: "chapter_id,position_id,member_id,term_year,term_semester" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const removePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("member_positions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCommissionMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => termInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("commission_members")
      .select(
        "id, commission_id, member_id, role, term_year, term_semester, commission:commissions(id, code, label, sort_order), member:members(id, full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const assignCommissionMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    termInput
      .extend({
        memberId: z.string().uuid(),
        commissionId: z.number().int(),
        role: z.enum(["presidente", "vice", "membro", "auxiliar_senior"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("commission_members").upsert(
      {
        chapter_id: data.chapterId,
        commission_id: data.commissionId,
        member_id: data.memberId,
        role: data.role,
        term_year: data.year,
        term_semester: data.semester,
      },
      { onConflict: "chapter_id,commission_id,member_id,term_year,term_semester" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCommissionMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("commission_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Histórico completo de cargos e comissões de um membro. */
export const getMemberOrgHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const [pos, com] = await Promise.all([
      context.supabase
        .from("member_positions")
        .select("id, term_year, term_semester, position:positions(id, label, scope)")
        .eq("member_id", data.memberId)
        .order("term_year", { ascending: false })
        .order("term_semester", { ascending: false }),
      context.supabase
        .from("commission_members")
        .select("id, role, term_year, term_semester, commission:commissions(id, label)")
        .eq("member_id", data.memberId)
        .order("term_year", { ascending: false })
        .order("term_semester", { ascending: false }),
    ]);
    if (pos.error) throw new Error(pos.error.message);
    if (com.error) throw new Error(com.error.message);
    return { positions: pos.data ?? [], commissions: com.data ?? [] };
  });
