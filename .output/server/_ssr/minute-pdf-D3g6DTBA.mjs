import { i as formatDateTimeBR } from "./format-BWFXNFqE.mjs";
import { n as loadLogoDataUrl } from "./chapter-logo-BLyNpzNr.mjs";
import { t as E } from "../_libs/jspdf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/minute-pdf-D3g6DTBA.js
var MARGIN = 18;
var LOGO_MAX = 26;
function fileSafe(text) {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
/** Gera e baixa o PDF da ata: logo centralizada no topo e rodapé "Capítulo — cidade". */
async function exportMinutePdf(input) {
	const doc = new E({
		unit: "mm",
		format: "a4"
	});
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const contentW = pageW - MARGIN * 2;
	const logo = await loadLogoDataUrl(input.logoPath);
	let logoH = 0;
	if (logo) try {
		const props = doc.getImageProperties(logo);
		const ratio = props.width / props.height;
		logoH = ratio >= 1 ? LOGO_MAX / ratio : LOGO_MAX;
		const logoW = logoH * ratio;
		doc.addImage(logo, (pageW - logoW) / 2, MARGIN - 6, logoW, logoH);
	} catch {
		logoH = 0;
	}
	let y = MARGIN + (logoH ? logoH : 0) + 4;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(14);
	doc.text(input.title, pageW / 2, y, {
		align: "center",
		maxWidth: contentW
	});
	y += 7;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(107, 107, 107);
	const sub = [input.dateISO ? formatDateTimeBR(input.dateISO) : null, input.status ?? null].filter(Boolean).join(" · ");
	if (sub) {
		doc.text(sub, pageW / 2, y, { align: "center" });
		y += 8;
	}
	doc.setTextColor(26, 26, 26);
	doc.setFontSize(11);
	const footerText = `${input.chapterName}${input.chapterCity ? ` — ${input.chapterCity}` : ""}`;
	const bottomLimit = pageH - MARGIN - 8;
	const paragraphs = (input.content || "").split(/\n/);
	for (const paragraph of paragraphs) {
		const lines = doc.splitTextToSize(paragraph || " ", contentW);
		for (const line of lines) {
			if (y > bottomLimit) {
				doc.addPage();
				y = MARGIN;
			}
			doc.text(line, MARGIN, y, {
				align: "justify",
				maxWidth: contentW
			});
			y += 6;
		}
	}
	if (input.signatures?.length) {
		if (y > bottomLimit - 30) {
			doc.addPage();
			y = MARGIN;
		}
		y += 10;
		doc.setFont("helvetica", "bold");
		doc.text("Assinaturas", MARGIN, y);
		doc.setFont("helvetica", "normal");
		y += 8;
		for (const s of input.signatures) {
			if (y > bottomLimit) {
				doc.addPage();
				y = MARGIN;
			}
			doc.line(MARGIN, y, 88, y);
			doc.text(s, MARGIN, y + 5);
			y += 16;
		}
	}
	const pages = doc.getNumberOfPages();
	for (let i = 1; i <= pages; i++) {
		doc.setPage(i);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(107, 107, 107);
		doc.text(footerText, pageW / 2, pageH - 10, { align: "center" });
		doc.text(`${i}/${pages}`, pageW - MARGIN, pageH - 10, { align: "right" });
	}
	doc.save(`ata-${fileSafe(input.title) || "sessao"}.pdf`);
}
//#endregion
export { exportMinutePdf };
