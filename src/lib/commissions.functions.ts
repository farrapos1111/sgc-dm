import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADVISORY_COUNCIL_ACCOUNT_ROLES,
  ADVISORY_COUNCIL_POSITION_CODES,
} from "@/lib/permissions";

export type MyCommission = {
  code: string;
  label: string;
  role: string;
  isPresident: boolean;
  moduleKey: string | null;
};

/**
 * Comissões do usuário logado no capítulo/vigência informados.
 * Vínculo usuário → membro via user_id (ou e-mail) + afiliação no capítulo.
 * Conselho Consultivo (Capítulo DeMolay): entra em todas com papel "conselho".
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
      .select("role, commission:commissions(code, label, module_key)")
      .eq("chapter_id", data.chapterId)
      .eq("term_year", data.year)
      .eq("term_semester", data.semester)
      .in("member_id", ids);
    if (error) throw new Error(error.message);

    const ROLE_RANK: Record<string, number> = {
      presidente: 0,
      vice: 1,
      conselho: 2,
      membro: 3,
      auxiliar_senior: 4,
    };

    const byCode = new Map<string, MyCommission>();
    for (const r of rows ?? []) {
      const c = r.commission as unknown as {
        code: string;
        label: string;
        module_key?: string | null;
      } | null;
      const code = c?.code ?? "";
      if (!code) continue;
      const next: MyCommission = {
        code,
        label: c?.label ?? "",
        role: r.role as string,
        isPresident: r.role === "presidente" || r.role === "vice",
        moduleKey: c?.module_key ?? null,
      };
      const prev = byCode.get(code);
      if (
        !prev ||
        (ROLE_RANK[next.role] ?? 99) < (ROLE_RANK[prev.role] ?? 99)
      ) {
        byCode.set(code, next);
      }
    }

    const isCouncil = await isLinkedAdvisoryCouncil(
      context.supabase,
      data.chapterId,
      data.year,
      data.semester,
      ids,
      context.userId,
    );

    if (isCouncil) {
      const { data: commissions, error: comErr } = await context.supabase
        .from("commissions")
        .select("code, label, module_key")
        .eq("chapter_id", data.chapterId)
        .order("sort_order");
      if (comErr) throw new Error(comErr.message);

      for (const raw of commissions ?? []) {
        const c = raw as {
          code: string;
          label: string;
          module_key?: string | null;
        };
        if (byCode.has(c.code)) continue;
        byCode.set(c.code, {
          code: c.code,
          label: c.label,
          role: "conselho",
          isPresident: false,
          moduleKey: c.module_key ?? null,
        });
      }
    }

    return [...byCode.values()];
  });

async function isLinkedAdvisoryCouncil(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  chapterId: string,
  year: number,
  semester: 1 | 2,
  memberIds: string[],
  userId: string,
): Promise<boolean> {

  const { data: chapter } = await sb
    .from("chapters")
    .select("org_type")
    .eq("id", chapterId)
    .maybeSingle();
  if ((chapter?.org_type as string | null) !== "capitulo") return false;

  const { data: membership } = await sb
    .from("chapter_members")
    .select("role:roles(name)")
    .eq("chapter_id", chapterId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  const roleRel = membership?.role as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const roleName = Array.isArray(roleRel) ? roleRel[0]?.name : roleRel?.name;
  if (
    roleName &&
    (ADVISORY_COUNCIL_ACCOUNT_ROLES as readonly string[]).includes(roleName)
  ) {
    return true;
  }

  const { data: positions, error } = await sb
    .from("member_positions")
    .select("position:positions(code)")
    .eq("chapter_id", chapterId)
    .eq("term_year", year)
    .eq("term_semester", semester)
    .in("member_id", memberIds);
  if (error) throw new Error(error.message);

  return (positions ?? []).some((p: {
    position: { code?: string } | { code?: string }[] | null;
  }) => {
    const pos = p.position;
    const row = Array.isArray(pos) ? pos[0] : pos;
    const code = row?.code ?? "";
    return (ADVISORY_COUNCIL_POSITION_CODES as readonly string[]).includes(
      code,
    );
  });
}
