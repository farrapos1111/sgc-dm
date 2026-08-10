/**
 * Resolve o(s) member_id(s) do usuário autenticado visíveis em um capítulo.
 * Usado em caminhos de RBAC (cargos, comissões, votos) — sem match por nome.
 */

type SupabaseLike = {
  from: (t: string) => any;
};

async function filterMembersVisibleInChapter(
  supabase: SupabaseLike,
  memberIds: string[],
  chapterId: string,
): Promise<string[]> {
  if (memberIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("members")
    .select("id, chapter_id")
    .in("id", memberIds);
  if (error) throw new Error(error.message);

  const candidates = (rows ?? []) as { id: string; chapter_id: string }[];
  if (candidates.length === 0) return [];

  const originHits = candidates
    .filter((m) => m.chapter_id === chapterId)
    .map((m) => m.id);
  const needAff = candidates
    .filter((m) => m.chapter_id !== chapterId)
    .map((m) => m.id);

  if (needAff.length === 0) return [...new Set(originHits)];

  const { data: affs, error: affErr } = await supabase
    .from("member_chapter_affiliations")
    .select("member_id")
    .eq("chapter_id", chapterId)
    .eq("active", true)
    .is("left_at", null)
    .in("member_id", needAff);
  if (affErr) throw new Error(affErr.message);

  const affHits = (affs ?? []).map(
    (a: { member_id: string }) => a.member_id as string,
  );
  return [...new Set([...originHits, ...affHits])];
}

/**
 * IDs de membros vinculados ao usuário e visíveis no capítulo informado.
 * 1) members.user_id = userId
 * 2) fallback: members.email = email (exato), sem full_name
 * 3) filtra por originário OU afiliação ativa no chapterId
 */
export async function resolveLinkedMemberIdsForChapter(
  supabase: SupabaseLike,
  opts: {
    userId: string;
    chapterId: string;
    email?: string | null;
  },
): Promise<string[]> {
  const { userId, chapterId, email } = opts;

  const { data: byUser, error: userErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId);
  if (userErr) throw new Error(userErr.message);

  let ids = (byUser ?? []).map((m: { id: string }) => m.id as string);

  if (ids.length === 0 && email) {
    const normalized = email.trim().toLowerCase();
    if (normalized) {
      const { data: byEmail, error: emailErr } = await supabase
        .from("members")
        .select("id")
        .eq("email", normalized);
      if (emailErr) throw new Error(emailErr.message);
      ids = (byEmail ?? []).map((m: { id: string }) => m.id as string);
    }
  }

  return filterMembersVisibleInChapter(supabase, ids, chapterId);
}

/**
 * Todos os member_ids ligados ao user (sem filtro de capítulo).
 * Preferir user_id; fallback só por e-mail (sem nome).
 */
export async function resolveLinkedMemberIdsGlobal(
  supabase: SupabaseLike,
  opts: { userId: string; email?: string | null },
): Promise<string[]> {
  const { data: byUser, error: userErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", opts.userId);
  if (userErr) throw new Error(userErr.message);

  let ids = (byUser ?? []).map((m: { id: string }) => m.id as string);
  if (ids.length > 0) return [...new Set(ids)];

  const email = opts.email?.trim().toLowerCase();
  if (!email) return [];

  const { data: byEmail, error: emailErr } = await supabase
    .from("members")
    .select("id")
    .eq("email", email);
  if (emailErr) throw new Error(emailErr.message);
  return [...new Set((byEmail ?? []).map((m: { id: string }) => m.id as string))];
}
