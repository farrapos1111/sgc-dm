import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyCommission = {
  code: string;
  label: string;
  role: string;
  isPresident: boolean;
};

/**
 * Comissões do usuário logado no capítulo/vigência informados.
 * O vínculo usuário → membro é feito por e-mail ou nome completo do perfil.
 */
export const listMyCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        year: z.number().int(),
        semester: z.union([z.literal(1), z.literal(2)]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<MyCommission[]> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const fullName = profile?.full_name ?? null;
    if (!email && !fullName) return [];

    const filters: string[] = [];
    if (email) filters.push(`email.eq.${email}`);
    if (fullName) filters.push(`full_name.eq.${fullName}`);

    const { data: members } = await context.supabase
      .from("members")
      .select("id")
      .eq("chapter_id", data.chapterId)
      .or(filters.join(","));

    const ids = (members ?? []).map((m) => m.id);
    if (ids.length === 0) return [];

    const { data: rows, error } = await context.supabase
      .from("commission_members")
      .select("role, commission:commissions(code, label)")
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester)
      .in("member_id", ids);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const c = r.commission as unknown as { code: string; label: string } | null;
      return {
        code: c?.code ?? "",
        label: c?.label ?? "",
        role: r.role as string,
        isPresident: r.role === "presidente" || r.role === "vice",
      };
    });
  });
