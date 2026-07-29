/** Chaves compartilhadas entre rotas para reaproveitar cache do React Query. */
export const membersListKey = (
  chapterId: string,
  search = "",
  status = "all",
  kind = "all",
) => ["members", chapterId, search, status, kind] as const;

export const attendanceOverviewKey = (chapterId: string) =>
  ["attendance-overview", chapterId] as const;
