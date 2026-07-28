//#region node_modules/.nitro/vite/services/ssr/assets/terms-DRv0pA-p.js
function currentTerm() {
	const now = /* @__PURE__ */ new Date();
	return {
		year: now.getFullYear(),
		semester: now.getMonth() < 6 ? 1 : 2
	};
}
function termLabel(year, semester) {
	return `${semester}º semestre de ${year}`;
}
function termOptions(span = 4) {
	const { year } = currentTerm();
	const out = [];
	for (let y = year + 1; y >= year - span; y--) {
		out.push({
			year: y,
			semester: 2
		});
		out.push({
			year: y,
			semester: 1
		});
	}
	return out;
}
//#endregion
export { termLabel as n, termOptions as r, currentTerm as t };
