import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chapterInput = z.object({ chapterId: z.string().uuid() });
const statusEnum = z.enum(["aberta", "em_andamento", "aprovada", "reprovada", "arquivada"]);

export const listFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("investigation_files")
      .select(
        "id, candidate_name, candidate_birth_date, candidate_phone, candidate_email, guardian_name, referred_by, notes, status, created_at",
      )
      .eq("chapter_id", data.chapterId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        candidate_name: z.string().min(1, "Informe o nome do candidato"),
        candidate_birth_date: z.string().nullable().optional(),
        candidate_phone: z.string().nullable().optional(),
        candidate_email: z.string().nullable().optional(),
        guardian_name: z.string().nullable().optional(),
        referred_by: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { chapterId, ...rest } = data;
    const { error } = await context.supabase.from("investigation_files").insert({
      chapter_id: chapterId,
      ...rest,
      candidate_birth_date: rest.candidate_birth_date || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid(), status: statusEnum }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("investigation_files")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("investigation_files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProcesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("investigation_processes")
      .select(
        "id, title, status, opened_at, closed_at, opinion, file_id, file:investigation_files(id, candidate_name), responsible:members(id, full_name)",
      )
      .eq("chapter_id", data.chapterId)
      .order("opened_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        title: z.string().min(1, "Informe o título"),
        file_id: z.string().uuid().nullable().optional(),
        responsible_member_id: z.string().uuid().nullable().optional(),
        opened_at: z.string().min(1),
        opinion: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { chapterId, ...rest } = data;
    const { error } = await context.supabase.from("investigation_processes").insert({
      chapter_id: chapterId,
      ...rest,
      file_id: rest.file_id || null,
      responsible_member_id: rest.responsible_member_id || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        status: statusEnum.optional(),
        opinion: z.string().nullable().optional(),
        closed_at: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("investigation_processes")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("investigation_processes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
