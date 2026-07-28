import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listLodges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ chapterId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chapter_lodges")
      .select("id, chapter_id, name, address, is_primary, created_at")
      .eq("chapter_id", data.chapterId)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveLodge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        chapter_id: z.string().uuid(),
        name: z.string().min(1),
        address: z.string().nullable().optional(),
        is_primary: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      chapter_id: data.chapter_id,
      name: data.name.trim(),
      address: data.address?.trim() || null,
      is_primary: data.is_primary ?? false,
    };

    let row: any;
    if (data.id) {
      const { data: r, error } = await context.supabase
        .from("chapter_lodges")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      row = r;
    } else {
      const { data: r, error } = await context.supabase
        .from("chapter_lodges")
        .insert({ ...payload, created_by: context.userId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      row = r;
    }

    if (payload.is_primary) {
      const { error } = await context.supabase
        .from("chapter_lodges")
        .update({ is_primary: false })
        .eq("chapter_id", data.chapter_id)
        .neq("id", row.id);
      if (error) throw new Error(error.message);
    }

    return row;
  });

export const deleteLodge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chapter_lodges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateChapterProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        name: z.string().min(1),
        number: z.string().min(1),
        city: z.string().nullable().optional(),
        founded_at: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
          .nullable()
          .optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readErr } = await context.supabase
      .from("chapters")
      .select("settings")
      .eq("id", data.chapter_id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const settings: Record<string, unknown> = {
      ...(((current?.settings as Record<string, unknown> | null) ?? {}) as Record<string, unknown>),
    };
    if (data.founded_at) settings.founded_at = data.founded_at;
    else delete settings.founded_at;

    const { data: row, error } = await context.supabase
      .from("chapters")
      .update({
        name: data.name.trim(),
        number: data.number.trim(),
        city: data.city?.trim() || null,
        settings: settings as any,
      })
      .eq("id", data.chapter_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateChapterAccentColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chapters")
      .update({ primary_color: data.primary_color.toUpperCase() })
      .eq("id", data.chapter_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Salva o modelo da "chave do dia" dentro de chapters.settings. */
export const updateChaveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        template: z.string().max(5000).nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readErr } = await context.supabase
      .from("chapters")
      .select("settings")
      .eq("id", data.chapter_id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const settings: Record<string, any> = { ...(((current?.settings as any) ?? {}) as Record<string, any>) };
    const value = data.template?.trim();
    if (value) settings.chave_template = value;
    else delete settings.chave_template;

    const { data: row, error } = await context.supabase
      .from("chapters")
      .update({ settings: settings as any })
      .eq("id", data.chapter_id)
      .select("id, settings")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
