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

/** Salva a chave Pix e/ou o path da imagem QR em chapters.settings. */
export const updateChapterPixKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        pix_key: z.string().max(200).nullable().optional(),
        pix_qr_path: z.string().max(500).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc(
      "has_any_role",
      {
        _chapter_id: data.chapter_id,
        _role_names: ["admin_total", "mestre_conselheiro", "tesoureiro"],
      },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) {
      throw new Error(
        "Apenas administração ou tesouraria podem alterar a chave Pix",
      );
    }

    const patch: Record<string, string | null> = {};
    if (data.pix_key !== undefined) {
      const value = data.pix_key?.trim();
      patch.pix_key = value || null;
    }
    if (data.pix_qr_path !== undefined) {
      const path = data.pix_qr_path?.trim();
      patch.pix_qr_path = path || null;
    }
    if (Object.keys(patch).length === 0) {
      throw new Error("Nenhuma alteração informada");
    }

    const { data: settings, error } = await context.supabase.rpc(
      "patch_chapter_settings",
      { _chapter_id: data.chapter_id, _patch: patch },
    );
    if (error) throw new Error(error.message);
    return { id: data.chapter_id, settings };
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
    const value = data.template?.trim() || null;
    const { data: settings, error } = await context.supabase.rpc(
      "patch_chapter_settings",
      {
        _chapter_id: data.chapter_id,
        _patch: { chave_template: value },
      },
    );
    if (error) throw new Error(error.message);
    return { id: data.chapter_id, settings };
  });

/** Senhas do link público por tipo de ata (settings.minute_passwords). */
export const updateMinutePasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapter_id: z.string().uuid(),
        passwords: z.object({
          publica: z.string().max(64),
          grau_iniciatico: z.string().max(64),
          grau_demolay: z.string().max(64),
        }),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc(
      "has_any_role",
      {
        _chapter_id: data.chapter_id,
        _role_names: [
          "escrivao",
          "presidente_conselho",
          "mestre_conselheiro",
          "admin_total",
        ],
      },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) {
      throw new Error(
        "Apenas Escrivão, Presidente do Conselho ou Mestre Conselheiro podem alterar as senhas das atas",
      );
    }

    const settingsPatch = {
      minute_passwords: {
        publica: data.passwords.publica.trim(),
        grau_iniciatico: data.passwords.grau_iniciatico.trim(),
        grau_demolay: data.passwords.grau_demolay.trim(),
      },
    };

    const { data: settings, error } = await context.supabase.rpc(
      "patch_chapter_settings",
      { _chapter_id: data.chapter_id, _patch: settingsPatch },
    );
    if (error) throw new Error(error.message);
    return { id: data.chapter_id, settings };
  });
