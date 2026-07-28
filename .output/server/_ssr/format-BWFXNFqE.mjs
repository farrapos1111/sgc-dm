//#region node_modules/.nitro/vite/services/ssr/assets/format-BWFXNFqE.js
function formatCpfMask(last2) {
	if (!last2) return "***.***.***-**";
	return `***.***.***-${last2}`;
}
function formatRgMask(last2) {
	if (!last2) return "**.***.**-*";
	return `**.***.***-${last2}`;
}
function formatBRL(value) {
	return (typeof value === "number" ? value : 0).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL"
	});
}
function formatDateBR(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString("pt-BR");
}
function formatDateTimeBR(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleString("pt-BR", {
		dateStyle: "short",
		timeStyle: "short"
	});
}
function digitsOnly(s) {
	return (s ?? "").replace(/\D/g, "");
}
function maskCpfInput(v) {
	return digitsOnly(v).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function maskPhoneInput(v) {
	const d = digitsOnly(v).slice(0, 11);
	if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
	return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
var STATUS_LABELS = {
	ativo: "Ativo",
	inativo: "Inativo",
	senior: "Senior DeMolay",
	macom: "Maçom"
};
function statusLabel(status) {
	if (!status) return "—";
	return STATUS_LABELS[status] ?? status;
}
function ageFrom(birthDate) {
	if (!birthDate) return null;
	const bd = new Date(birthDate);
	const now = /* @__PURE__ */ new Date();
	return now.getFullYear() - bd.getFullYear() - (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
}
function isUnder21(birthDate) {
	const age = ageFrom(birthDate);
	return age !== null && age < 21;
}
function is21OrOlder(birthDate) {
	const age = ageFrom(birthDate);
	return age !== null && age >= 21;
}
/** Grau atual do membro a partir das datas de iniciação/exame. */
function grauOf(m) {
	if (m.iniciacao_grau_demolay || m.exam_grau_demolay) return {
		code: "DM",
		label: "DM — DeMolay"
	};
	if (m.iniciacao_ordem || m.exam_grau_iniciatico) return {
		code: "GI",
		label: "GI — Grau Iniciático"
	};
	return {
		code: null,
		label: "Sem grau"
	};
}
/** Fez o exame de grau iniciático mas ainda não foi iniciado no Grau DeMolay. */
function isAptoGrauDemolay(m) {
	return Boolean(m.exam_grau_iniciatico) && !m.iniciacao_grau_demolay;
}
//#endregion
export { formatRgMask as a, isAptoGrauDemolay as c, maskPhoneInput as d, statusLabel as f, formatDateTimeBR as i, isUnder21 as l, formatCpfMask as n, grauOf as o, formatDateBR as r, is21OrOlder as s, formatBRL as t, maskCpfInput as u };
