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
 * Vínculo usuário → membro via user_id (ou e-mail) + afiliação no capítulo.
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
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const { resolveLinkedMemberIdsForChapter } = await import(
      "@/lib/resolve-linked-members"
    );
    const ids = await resolveLinkedMemberIdsForChapter(context.supabase, {
      userId: context.userId,
      chapterId: data.chapterId,
      email,
    });
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
