import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRealmForOrgType, type Realm } from "@/lib/realm";

export type CrossRealmFicha = {
  id: string;
  realm: Realm;
  chapterId: string;
  chapterName: string;
  chapterNumber: string;
  fullName: string;
  status: string;
  extra: string | null;
};

type ChapterJoin = {
  name?: string | null;
  number?: string | null;
  org_type?: string | null;
};

function mapRow(
  row: {
    id: string;
    chapter_id: string;
    full_name: string;
    status: string;
    chapter: ChapterJoin | ChapterJoin[] | null;
  },
  extra: string | null,
): CrossRealmFicha | null {
  const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
  const realm = getRealmForOrgType(chapter?.org_type);
  if (!realm) return null;
  return {
    id: row.id,
    realm,
    chapterId: row.chapter_id,
    chapterName: chapter?.name ?? "—",
    chapterNumber: chapter?.number ?? "—",
    fullName: row.full_name,
    status: row.status,
    extra,
  };
}

/** Histórico somente-leitura de fichas FDJ/Loja da mesma pessoa (não usa `members`). */
export const getMyCrossRealmFichas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ fichas: CrossRealmFicha[] }> => {
    const [fdj, loja] = await Promise.all([
      context.supabase
        .from("fdj_members")
        .select(
          "id, chapter_id, full_name, status, fdj_id, chapter:chapters(name, number, org_type)",
        )
        .eq("user_id", context.userId),
      context.supabase
        .from("loja_members")
        .select(
          "id, chapter_id, full_name, status, masonic_id, grau, chapter:chapters(name, number, org_type)",
        )
        .eq("user_id", context.userId),
    ]);
    if (fdj.error) throw new Error(fdj.error.message);
    if (loja.error) throw new Error(loja.error.message);

    const fichas: CrossRealmFicha[] = [];
    for (const row of fdj.data ?? []) {
      const mapped = mapRow(row, row.fdj_id ?? null);
      if (mapped) fichas.push(mapped);
    }
    for (const row of loja.data ?? []) {
      const extra = [row.grau, row.masonic_id].filter(Boolean).join(" · ") || null;
      const mapped = mapRow(row, extra);
      if (mapped) fichas.push(mapped);
    }
    return { fichas };
  });
