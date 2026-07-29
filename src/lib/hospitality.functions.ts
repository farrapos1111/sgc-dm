import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chapterInput = z.object({ chapterId: z.string().uuid() });

export const listMenus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("hospitality_menus")
      .select("id, title, menu_date, items, estimated_cost, notes")
      .eq("chapter_id", data.chapterId)
      .order("menu_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        title: z.string().min(1, "Informe o título"),
        menu_date: z.string().min(1),
        items: z.string().nullable().optional(),
        estimated_cost: z.number().nonnegative().default(0),
        notes: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { chapterId, ...rest } = data;
    const { error } = await context.supabase
      .from("hospitality_menus")
      .insert({ chapter_id: chapterId, ...rest, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hospitality_menus").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDuties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const [duties, members] = await Promise.all([
      context.supabase
        .from("hospitality_duties")
        .select("id, duty_date, role_label, notes, member:members(id, full_name)")
        .eq("chapter_id", data.chapterId)
        .order("duty_date", { ascending: false }),
      context.supabase
        .from("members")
        .select("id, full_name")
        .eq("chapter_id", data.chapterId)
        .eq("status", "regular")
        .in("kind", ["demolay_ativo", "senior"])
        .order("full_name"),
    ]);
    if (duties.error) throw new Error(duties.error.message);
    if (members.error) throw new Error(members.error.message);
    return { duties: duties.data ?? [], members: members.data ?? [] };
  });

export const createDuty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        member_id: z.string().uuid(),
        duty_date: z.string().min(1),
        role_label: z.string().min(1).default("Serviço"),
        notes: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { chapterId, ...rest } = data;
    const { error } = await context.supabase
      .from("hospitality_duties")
      .insert({ chapter_id: chapterId, ...rest, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDuty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hospitality_duties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: events, error: eErr } = await context.supabase
      .from("events")
      .select("id, name, starts_at")
      .eq("chapter_id", data.chapterId)
      .order("starts_at", { ascending: false });
    if (eErr) throw new Error(eErr.message);
    const ids = (events ?? []).map((e) => e.id);
    if (ids.length === 0) return { events: [], checkins: [] };
    const { data: checkins, error } = await context.supabase
      .from("checkins")
      .select("id, event_id, checked_in_at, method, ticket:tickets(id, buyer_name)")
      .in("event_id", ids)
      .order("checked_in_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { events: events ?? [], checkins: checkins ?? [] };
  });
