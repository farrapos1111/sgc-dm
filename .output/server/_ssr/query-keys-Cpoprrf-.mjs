//#region node_modules/.nitro/vite/services/ssr/assets/query-keys-Cpoprrf-.js
/** Chaves compartilhadas entre rotas para reaproveitar cache do React Query. */
var membersListKey = (chapterId, search = "", status = "all") => [
	"members",
	chapterId,
	search,
	status
];
var attendanceOverviewKey = (chapterId) => ["attendance-overview", chapterId];
//#endregion
export { membersListKey as n, attendanceOverviewKey as t };
