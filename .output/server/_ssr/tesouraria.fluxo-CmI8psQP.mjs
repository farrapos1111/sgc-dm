import { a as __toESM } from "../_runtime.mjs";
import { r as formatDateBR, t as formatBRL } from "./format-BWFXNFqE.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { $ as Download, E as Pencil, J as FileSpreadsheet, T as Plus, c as TrendingDown, g as Settings2, l as Trash2, n as Wallet, o as Upload, q as FileText, s as TrendingUp, z as Landmark } from "../_libs/lucide-react.mjs";
import { t as EmptyState } from "./EmptyState-gSTkJtPq.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { a as SelectLabel, i as SelectItem, n as SelectContent, o as SelectTrigger, r as SelectGroup, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, r as DialogDescription, t as Dialog } from "./dialog-DIo89e4g.mjs";
import { i as scopeOfCategory, r as duesDescription, t as FIXED_CATEGORIES } from "./cash-categories-CWWVJoRh.mjs";
import { n as loadLogoDataUrl } from "./chapter-logo-BLyNpzNr.mjs";
import { t as Badge } from "./badge-D1Dupn2y.mjs";
import { t as E } from "../_libs/jspdf.mjs";
import { c as listActiveMembers, f as updateCashEntry, i as deleteCashEntry, l as listCashCategories, n as createManualDuesEntry, o as getFinanceSigners, p as upsertCashCategory, r as deleteCashCategory, s as importCashEntries, t as createCashEntry, u as listCashEntries } from "./finance.functions-CIZoOWjJ.mjs";
import { i as writeFileSync, n as readSync, r as utils, t as SSF } from "../_libs/xlsx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tesouraria.fluxo-CmI8psQP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function toISODate(value) {
	if (value == null || value === "") return null;
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === "number") {
		const d = SSF.parse_date_code(value);
		if (!d) return null;
		return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
	}
	const text = String(value).trim();
	const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (br) return `${br[3]}-${br[2]}-${br[1]}`;
	const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
	return null;
}
function toAmount(value) {
	if (typeof value === "number") return Number.isFinite(value) ? Math.abs(value) : null;
	if (value == null) return null;
	const text = String(value).replace(/[R$\s]/gi, "").replace(/\./g, "").replace(",", ".");
	const n = Number(text);
	return Number.isFinite(n) ? Math.abs(n) : null;
}
function pick(row, keys) {
	for (const key of Object.keys(row)) {
		const norm = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
		if (keys.includes(norm)) return row[key];
	}
}
/** Lê a planilha (Data | Tipo | Valor | Categoria | Descrição) e valida linha a linha. */
async function parseCashSheet(file) {
	const wb = readSync(await file.arrayBuffer(), {
		type: "array",
		cellDates: true
	});
	const sheet = wb.Sheets[wb.SheetNames[0]];
	return utils.sheet_to_json(sheet, { defval: "" }).map((row, index) => {
		const line = index + 2;
		const date = toISODate(pick(row, ["data", "date"]));
		const rawKind = String(pick(row, ["tipo", "kind"]) ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
		const kind = rawKind.startsWith("e") ? "entrada" : rawKind.startsWith("s") ? "saida" : null;
		const amount = toAmount(pick(row, ["valor", "amount"]));
		const category = String(pick(row, ["categoria", "category"]) ?? "").trim() || "Outras";
		const description = String(pick(row, ["descricao", "description"]) ?? "").trim();
		const errors = [];
		if (!date) errors.push("data inválida");
		if (!kind) errors.push("tipo deve ser Entrada ou Saída");
		if (amount == null) errors.push("valor inválido");
		if (!description) errors.push("descrição vazia");
		return {
			line,
			entry_date: date ?? "",
			kind: kind ?? "entrada",
			amount: amount ?? 0,
			category,
			description,
			error: errors.length ? errors.join(", ") : void 0
		};
	});
}
/** Modelo de planilha para importação. */
function downloadCashTemplate() {
	const ws = utils.aoa_to_sheet([
		[
			"Data",
			"Tipo",
			"Valor",
			"Categoria",
			"Descrição"
		],
		[
			"01/01/2026",
			"Entrada",
			50,
			"Mensalidades",
			"Mensalidade - Exemplo - Janeiro/2026"
		],
		[
			"05/01/2026",
			"Saída",
			120.5,
			"Hospitalaria",
			"Compra de insumos"
		]
	]);
	const wb = utils.book_new();
	utils.book_append_sheet(wb, ws, "Modelo");
	writeFileSync(wb, "modelo-fluxo-de-caixa.xlsx");
}
function exportCashXlsx(entries, fileName) {
	const rows = entries.map((e) => ({
		Data: e.entry_date.split("-").reverse().join("/"),
		Tipo: e.kind === "entrada" ? "Entrada" : "Saída",
		Categoria: e.category,
		Descrição: e.description,
		Valor: Number(e.amount)
	}));
	const ws = utils.json_to_sheet(rows, { header: [
		"Data",
		"Tipo",
		"Categoria",
		"Descrição",
		"Valor"
	] });
	ws["!cols"] = [
		{ wch: 12 },
		{ wch: 10 },
		{ wch: 22 },
		{ wch: 48 },
		{ wch: 14 }
	];
	const wb = utils.book_new();
	utils.book_append_sheet(wb, ws, "Fluxo de caixa");
	writeFileSync(wb, fileName);
}
var MARGIN = 15;
var LOGO_MAX = 24;
function fileSafe(text) {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
/** Relatório de fluxo de caixa: logo, período, tabela, totais e assinaturas. */
async function exportCashPdf(input) {
	const doc = new E({
		unit: "mm",
		format: "a4"
	});
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const contentW = pageW - MARGIN * 2;
	const logo = await loadLogoDataUrl(input.logoPath);
	let y = MARGIN;
	if (logo) try {
		const props = doc.getImageProperties(logo);
		const ratio = props.width / props.height;
		const h = ratio >= 1 ? LOGO_MAX / ratio : LOGO_MAX;
		doc.addImage(logo, (pageW - h * ratio) / 2, y, h * ratio, h);
		y += h + 4;
	} catch {}
	doc.setFont("helvetica", "bold");
	doc.setFontSize(14);
	doc.text(input.chapterName, pageW / 2, y, {
		align: "center",
		maxWidth: contentW
	});
	y += 6;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(11);
	doc.text("Relatório de Fluxo de Caixa", pageW / 2, y, { align: "center" });
	y += 5;
	doc.setFontSize(10);
	doc.setTextColor(107, 107, 107);
	doc.text(input.periodLabel, pageW / 2, y, { align: "center" });
	y += 8;
	doc.setTextColor(26, 26, 26);
	const cols = [
		{
			label: "Data",
			x: MARGIN,
			w: 22
		},
		{
			label: "Tipo",
			x: 37,
			w: 18
		},
		{
			label: "Categoria",
			x: 55,
			w: 38
		},
		{
			label: "Descrição",
			x: 93,
			w: 72
		},
		{
			label: "Valor",
			x: pageW - MARGIN,
			w: 0
		}
	];
	const drawHeader = () => {
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.setFillColor(240, 240, 238);
		doc.rect(MARGIN, y - 4.5, contentW, 7, "F");
		doc.text("Data", cols[0].x + 1, y);
		doc.text("Tipo", cols[1].x + 1, y);
		doc.text("Categoria", cols[2].x + 1, y);
		doc.text("Descrição", cols[3].x + 1, y);
		doc.text("Valor", cols[4].x - 1, y, { align: "right" });
		y += 6;
		doc.setFont("helvetica", "normal");
	};
	drawHeader();
	doc.setFontSize(9);
	for (const e of input.entries) {
		if (y > pageH - 30) {
			doc.addPage();
			y = 19;
			drawHeader();
		}
		const desc = doc.splitTextToSize(e.description, cols[3].w - 2);
		doc.text(formatDateBR(e.entry_date), cols[0].x + 1, y);
		doc.text(e.kind === "entrada" ? "Entrada" : "Saída", cols[1].x + 1, y);
		doc.text(doc.splitTextToSize(e.category, cols[2].w - 2)[0], cols[2].x + 1, y);
		doc.text(desc[0] ?? "", cols[3].x + 1, y);
		doc.text(`${e.kind === "entrada" ? "+" : "-"} ${formatBRL(Number(e.amount))}`, cols[4].x - 1, y, { align: "right" });
		y += desc.length > 1 ? 5 + (desc.length - 1) * 4 : 5;
		for (let i = 1; i < desc.length; i++) doc.text(desc[i], cols[3].x + 1, y - (desc.length - i) * 4);
		doc.setDrawColor(230, 230, 228);
		doc.line(MARGIN, y - 3.2, pageW - MARGIN, y - 3.2);
	}
	if (input.entries.length === 0) {
		doc.setTextColor(107, 107, 107);
		doc.text("Nenhuma movimentação no período.", 16, y);
		doc.setTextColor(26, 26, 26);
		y += 6;
	}
	if (y > pageH - 45) {
		doc.addPage();
		y = 19;
	}
	y += 4;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(10);
	const totalLine = (label, value) => {
		doc.text(label, pageW - MARGIN - 45, y, { align: "right" });
		doc.text(value, pageW - MARGIN, y, { align: "right" });
		y += 5.5;
	};
	totalLine("Total de entradas:", formatBRL(input.totals.income));
	totalLine("Total de saídas:", formatBRL(input.totals.expense));
	totalLine("Saldo:", formatBRL(input.totals.balance));
	doc.addPage();
	let sy = 25;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(12);
	doc.text("Assinaturas", pageW / 2, sy, { align: "center" });
	sy += 6;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(9);
	doc.setTextColor(107, 107, 107);
	doc.text(`${input.chapterName} · ${input.periodLabel}`, pageW / 2, sy, { align: "center" });
	doc.setTextColor(26, 26, 26);
	sy += 22;
	for (const signer of input.signers) {
		doc.setDrawColor(120, 120, 120);
		doc.line(35, sy, pageW - MARGIN - 20, sy);
		sy += 5;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(10);
		doc.text(signer.name || "____________________", pageW / 2, sy, { align: "center" });
		sy += 5;
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(107, 107, 107);
		doc.text(signer.role, pageW / 2, sy, { align: "center" });
		doc.setTextColor(26, 26, 26);
		sy += 26;
	}
	const pages = doc.getNumberOfPages();
	for (let p = 1; p <= pages; p++) {
		doc.setPage(p);
		doc.setFontSize(8);
		doc.setTextColor(140, 140, 140);
		const footer = [input.chapterName, input.chapterCity].filter(Boolean).join(" — ");
		doc.text(footer, MARGIN, pageH - 8);
		doc.text(`${p}/${pages}`, pageW - MARGIN, pageH - 8, { align: "right" });
	}
	doc.save(`fluxo-de-caixa-${fileSafe(input.periodLabel)}.pdf`);
}
var MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
var monthName = (m) => new Date(2e3, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
var emptyForm = () => ({
	kind: "entrada",
	category: "Outras",
	eventId: "",
	subcategoryId: "",
	description: "",
	amount: "",
	entry_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
});
function FluxoCaixa() {
	const { active } = useActiveChapter();
	const qc = useQueryClient();
	const now = /* @__PURE__ */ new Date();
	const [year, setYear] = (0, import_react.useState)(now.getFullYear());
	const [month, setMonth] = (0, import_react.useState)(now.getMonth() + 1);
	const writable = can(active?.role.name, "tesouraria");
	const [form, setForm] = (0, import_react.useState)(emptyForm());
	const [entryOpen, setEntryOpen] = (0, import_react.useState)(false);
	const [catsOpen, setCatsOpen] = (0, import_react.useState)(false);
	const [importRows, setImportRows] = (0, import_react.useState)(null);
	const fileRef = (0, import_react.useRef)(null);
	const { data, isLoading } = useQuery({
		queryKey: [
			"cash-entries",
			active?.chapter_id,
			year,
			month
		],
		enabled: !!active,
		queryFn: () => listCashEntries({ data: {
			chapterId: active.chapter_id,
			year,
			month
		} })
	});
	const entries = data?.entries ?? [];
	const bank = data?.bank ?? {
		income: 0,
		expense: 0,
		balance: 0
	};
	const { data: catData } = useQuery({
		queryKey: ["cash-categories", active?.chapter_id],
		enabled: !!active,
		queryFn: () => listCashCategories({ data: { chapterId: active.chapter_id } })
	});
	const categories = catData?.categories ?? [];
	const eventOptions = catData?.events ?? [];
	const subcategories = catData?.subcategories ?? [];
	const scope = scopeOfCategory(form.category);
	const scopedSubs = subcategories.filter((s) => scope === "eventos" ? s.scope === "eventos" && s.calendar_event_id === form.eventId : s.scope === scope);
	const eventsWithItems = eventOptions.filter((e) => subcategories.some((s) => s.scope === "eventos" && s.calendar_event_id === e.id));
	const isManualDues = form.category === "Mensalidades" && !form.id;
	const categoryNames = (0, import_react.useMemo)(() => {
		const names = new Set(FIXED_CATEGORIES);
		for (const c of categories) names.add(c.name);
		if (form.category) names.add(form.category);
		return [...names];
	}, [categories, form.category]);
	const [duesMemberId, setDuesMemberId] = (0, import_react.useState)("");
	const [duesYear, setDuesYear] = (0, import_react.useState)(now.getFullYear());
	const [duesMonths, setDuesMonths] = (0, import_react.useState)([]);
	const { data: activeMembers = [] } = useQuery({
		queryKey: ["cash-active-members", active?.chapter_id],
		enabled: !!active && isManualDues,
		queryFn: () => listActiveMembers({ data: { chapterId: active.chapter_id } })
	});
	const duesCompetences = (0, import_react.useMemo)(() => duesMonths.map((k) => {
		const [y, m] = k.split("-").map(Number);
		return {
			year: y,
			month: m
		};
	}).sort((a, b) => a.year - b.year || a.month - b.month), [duesMonths]);
	const duesPreview = duesMemberId && duesCompetences.length ? duesDescription(activeMembers.find((m) => m.id === duesMemberId)?.full_name ?? "", duesCompetences) : "";
	const periodTotals = (0, import_react.useMemo)(() => {
		let income = 0;
		let expense = 0;
		for (const e of entries) if (e.kind === "entrada") income += Number(e.amount);
		else expense += Number(e.amount);
		return {
			income,
			expense,
			balance: income - expense
		};
	}, [entries]);
	const periodLabel = month ? `${monthName(month)} de ${year}` : "Período completo";
	const invalidate = async () => {
		await qc.invalidateQueries({ queryKey: ["cash-entries"] });
	};
	const save = useMutation({
		mutationFn: async () => {
			if (isManualDues) return createManualDuesEntry({ data: {
				chapterId: active.chapter_id,
				memberId: duesMemberId,
				competences: duesCompetences,
				amount: Number(String(form.amount).replace(",", ".")) || 0,
				entry_date: form.entry_date
			} });
			const payload = {
				kind: form.kind,
				category: form.category,
				subcategoryId: form.subcategoryId || null,
				description: form.description.trim(),
				amount: Number(String(form.amount).replace(",", ".")) || 0,
				entry_date: form.entry_date
			};
			if (form.id) return updateCashEntry({ data: {
				id: form.id,
				...payload
			} });
			return createCashEntry({ data: {
				chapterId: active.chapter_id,
				...payload
			} });
		},
		onSuccess: async () => {
			toast.success(form.id ? "Lançamento atualizado" : "Lançamento registrado");
			setEntryOpen(false);
			setForm(emptyForm());
			setDuesMemberId("");
			setDuesMonths([]);
			await invalidate();
			await qc.invalidateQueries({ queryKey: ["dues"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteCashEntry({ data: { id } }),
		onSuccess: async () => {
			toast.success("Lançamento excluído");
			await invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir")
	});
	const runImport = useMutation({
		mutationFn: () => {
			const valid = (importRows ?? []).filter((r) => !r.error);
			return importCashEntries({ data: {
				chapterId: active.chapter_id,
				rows: valid.map(({ line, error, ...r }) => r)
			} });
		},
		onSuccess: async (r) => {
			toast.success(`${r.imported} lançamentos importados`);
			setImportRows(null);
			await invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao importar")
	});
	const exportPdf = useMutation({
		mutationFn: async () => {
			const signers = await getFinanceSigners({ data: { chapterId: active.chapter_id } });
			await exportCashPdf({
				chapterName: `${active.chapter.name} nº ${active.chapter.number}`,
				chapterCity: active.chapter.city,
				logoPath: active.chapter.logo_url ?? null,
				periodLabel,
				entries: [...entries].reverse(),
				totals: periodTotals,
				signers
			});
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao gerar PDF")
	});
	async function handleFile(file) {
		try {
			const rows = await parseCashSheet(file);
			if (rows.length === 0) {
				toast.error("A planilha está vazia");
				return;
			}
			setImportRows(rows);
		} catch {
			toast.error("Não foi possível ler a planilha");
		}
		if (fileRef.current) fileRef.current.value = "";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Fluxo de Caixa",
			subtitle: "Entradas, saídas e relatórios financeiros do capítulo.",
			actions: writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => {
					setForm(emptyForm());
					setEntryOpen(true);
				},
				style: { backgroundColor: active?.chapter.primary_color },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-2 h-4 w-4" }), " Novo lançamento"]
			}) : null
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: month === null ? "all" : String(month),
					onValueChange: (v) => setMonth(v === "all" ? null : Number(v)),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "w-44",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: "all",
						children: "Geral (todos)"
					}), MONTHS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: String(m),
						children: monthName(m)
					}, m))] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: String(year),
					onValueChange: (v) => setYear(Number(v)),
					disabled: month === null,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
						className: "w-28",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: [
						now.getFullYear() + 1,
						now.getFullYear(),
						now.getFullYear() - 1,
						now.getFullYear() - 2
					].map((y) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: String(y),
						children: y
					}, y)) })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							onClick: () => exportCashXlsx(entries, `fluxo-de-caixa-${month ? `${year}-${month}` : "geral"}.xlsx`),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSpreadsheet, { className: "mr-2 h-4 w-4" }), " Excel"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							onClick: () => exportPdf.mutate(),
							disabled: exportPdf.isPending,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "mr-2 h-4 w-4" }),
								" ",
								exportPdf.isPending ? "Gerando…" : "PDF"
							]
						}),
						writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							onClick: () => fileRef.current?.click(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mr-2 h-4 w-4" }), " Importar"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							onClick: () => setCatsOpen(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "mr-2 h-4 w-4" }), " Categorias"]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: fileRef,
							type: "file",
							accept: ".xlsx,.xls,.csv",
							className: "hidden",
							onChange: (e) => {
								const f = e.target.files?.[0];
								if (f) handleFile(f);
							}
						})
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Total de entradas",
					value: formatBRL(periodTotals.income),
					tone: "text-emerald-600 dark:text-emerald-400",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-5 w-5 text-emerald-600 dark:text-emerald-400" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Total de saídas",
					value: formatBRL(periodTotals.expense),
					tone: "text-rose-600 dark:text-rose-400",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingDown, { className: "h-5 w-5 text-rose-600 dark:text-rose-400" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Saldo do banco",
					value: formatBRL(bank.balance),
					hint: "Acumulado de todos os períodos",
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "h-5 w-5 text-muted-foreground" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
					label: "Resultado do mês",
					value: formatBRL(periodTotals.balance),
					hint: periodLabel,
					tone: periodTotals.balance < 0 ? "text-rose-600 dark:text-rose-400" : void 0,
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "h-5 w-5 text-muted-foreground" })
				})
			]
		}),
		isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		}) : entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "h-7 w-7" }),
			title: "Nenhum lançamento no período",
			description: "Registre entradas e saídas ou importe uma planilha para acompanhar o caixa.",
			action: writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				onClick: () => {
					setForm(emptyForm());
					setEntryOpen(true);
				},
				style: { backgroundColor: active?.chapter.primary_color },
				children: "Fazer primeiro lançamento"
			}) : void 0
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "divide-y divide-border overflow-hidden rounded-[12px]",
			children: entries.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm font-medium",
							children: e.description
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs text-muted-foreground",
							children: [
								formatDateBR(e.entry_date),
								" · ",
								e.category,
								e.subcategory ? ` · ${e.subcategory}` : ""
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `whitespace-nowrap text-sm font-semibold ${e.kind === "entrada" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`,
						children: [
							e.kind === "entrada" ? "+" : "−",
							" ",
							formatBRL(Number(e.amount))
						]
					}),
					writable && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "Editar lançamento",
							onClick: () => {
								setForm({
									id: e.id,
									kind: e.kind,
									category: e.category,
									eventId: "",
									subcategoryId: "",
									description: e.description,
									amount: String(e.amount),
									entry_date: e.entry_date
								});
								setEntryOpen(true);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-4 w-4 text-muted-foreground" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							"aria-label": "Excluir lançamento",
							onClick: () => remove.mutate(e.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4 text-muted-foreground" })
						})]
					})
				]
			}, e.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: entryOpen,
			onOpenChange: setEntryOpen,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: form.id ? "Editar lançamento" : "Novo lançamento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Movimentação do caixa do capítulo." })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 gap-4 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								className: "mb-1.5 block text-sm",
								children: "Tipo"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: form.kind,
								onValueChange: (v) => setForm((f) => ({
									...f,
									kind: v
								})),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: "entrada",
									children: "Entrada"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: "saida",
									children: "Saída"
								})] })]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								className: "mb-1.5 block text-sm",
								children: "Categoria"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: form.category,
								onValueChange: (v) => setForm((f) => ({
									...f,
									category: v,
									eventId: "",
									subcategoryId: ""
								})),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectGroup, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectLabel, { children: "Categorias" }), categoryNames.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: c,
									children: c
								}, c))] }) })]
							})] }),
							scope === "eventos" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										className: "mb-1.5 block text-sm",
										children: "Evento *"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
										value: form.eventId,
										onValueChange: (v) => setForm((f) => ({
											...f,
											eventId: v,
											subcategoryId: ""
										})),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione o evento" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: eventsWithItems.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
											value: e.id,
											children: e.title
										}, e.id)) })]
									}),
									eventsWithItems.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-muted-foreground",
										children: "Nenhum evento configurado pela Comissão de Eventos. Configure em “Categorias e itens”."
									})
								]
							}),
							scope && (scope === "hospitalaria" || form.eventId) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										className: "mb-1.5 block text-sm",
										children: scope === "eventos" ? "Tipo de movimentação *" : "Item da hospitalaria *"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
										value: form.subcategoryId,
										onValueChange: (v) => setForm((f) => ({
											...f,
											subcategoryId: v
										})),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: scopedSubs.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
											value: s.id,
											children: s.name
										}, s.id)) })]
									}),
									scopedSubs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-muted-foreground",
										children: "A comissão ainda não liberou itens para esta categoria."
									})
								]
							}),
							isManualDues && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									className: "mb-1.5 block text-sm",
									children: "Membro *"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
									value: duesMemberId,
									onValueChange: setDuesMemberId,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Selecione o membro" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: activeMembers.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: m.id,
										children: m.full_name
									}, m.id)) })]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										className: "mb-1.5 block text-sm",
										children: "Competências *"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-2 flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
											value: String(duesYear),
											onValueChange: (v) => setDuesYear(Number(v)),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
												className: "w-32",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: [
												year - 1,
												year,
												year + 1
											].map((y) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
												value: String(y),
												children: y
											}, y)) })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs text-muted-foreground",
											children: "Selecione um ou mais meses"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-1.5",
										children: MONTHS.map((m) => {
											const key = `${duesYear}-${m}`;
											const on = duesMonths.includes(key);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setDuesMonths((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]),
												className: `rounded-full border px-3 py-1 text-xs capitalize transition ${on ? "border-transparent text-white" : "border-border text-muted-foreground"}`,
												style: on ? { backgroundColor: active?.chapter.primary_color } : void 0,
												children: monthName(m).slice(0, 3)
											}, key);
										})
									})
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									className: "mb-1.5 block text-sm",
									children: "Descrição *"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: isManualDues ? duesPreview : form.description,
									disabled: isManualDues,
									onChange: (e) => setForm((f) => ({
										...f,
										description: e.target.value
									})),
									placeholder: "Ex.: Compra de insumos para a hospitalaria"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								className: "mb-1.5 block text-sm",
								children: "Valor (R$)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 0,
								step: "0.01",
								value: form.amount,
								onChange: (e) => setForm((f) => ({
									...f,
									amount: e.target.value
								}))
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								className: "mb-1.5 block text-sm",
								children: "Data"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "date",
								value: form.entry_date,
								onChange: (e) => setForm((f) => ({
									...f,
									entry_date: e.target.value
								}))
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setEntryOpen(false),
						children: "Cancelar"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => save.mutate(),
						disabled: save.isPending || !form.entry_date || (isManualDues ? !duesMemberId || duesCompetences.length === 0 : !form.description.trim() || !!scope && !form.subcategoryId),
						style: { backgroundColor: active?.chapter.primary_color },
						children: save.isPending ? "Salvando…" : "Salvar"
					})] })
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!importRows,
			onOpenChange: (o) => !o && setImportRows(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-3xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Revisar importação" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Confira as linhas antes de confirmar. Linhas com erro são ignoradas." })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "max-h-[50vh] overflow-auto rounded-[10px] border border-border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2",
										children: "Data"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2",
										children: "Tipo"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2",
										children: "Categoria"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2",
										children: "Descrição"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-3 py-2 text-right",
										children: "Valor"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: (importRows ?? []).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: `border-t border-border ${r.error ? "bg-destructive/10" : ""}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-3 py-2",
										children: r.entry_date ? formatDateBR(r.entry_date) : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-3 py-2",
										children: r.kind === "entrada" ? "Entrada" : "Saída"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-3 py-2",
										children: r.category
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "px-3 py-2",
										children: [r.description || "—", r.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xs text-destructive",
											children: [
												"Linha ",
												r.line,
												": ",
												r.error
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-3 py-2 text-right",
										children: formatBRL(r.amount)
									})
								]
							}, r.line)) })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
						className: "flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							onClick: downloadCashTemplate,
							className: "sm:mr-auto",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-2 h-4 w-4" }), " Baixar modelo"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: () => setImportRows(null),
								children: "Cancelar"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: () => runImport.mutate(),
								disabled: runImport.isPending || !(importRows ?? []).some((r) => !r.error),
								style: { backgroundColor: active?.chapter.primary_color },
								children: runImport.isPending ? "Importando…" : `Importar ${(importRows ?? []).filter((r) => !r.error).length}`
							})]
						})]
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategoriesDialog, {
			open: catsOpen,
			onOpenChange: setCatsOpen
		})
	] });
}
function CategoriesDialog({ open, onOpenChange }) {
	const { active } = useActiveChapter();
	const qc = useQueryClient();
	const [name, setName] = (0, import_react.useState)("");
	const [editing, setEditing] = (0, import_react.useState)(null);
	const { data } = useQuery({
		queryKey: ["cash-categories", active?.chapter_id],
		enabled: !!active && open,
		queryFn: () => listCashCategories({ data: { chapterId: active.chapter_id } })
	});
	const categories = data?.categories ?? [];
	const save = useMutation({
		mutationFn: () => upsertCashCategory({ data: {
			chapterId: active.chapter_id,
			id: editing?.id,
			name: editing ? editing.name.trim() : name.trim(),
			sort_order: 100
		} }),
		onSuccess: async () => {
			toast.success("Categoria salva");
			setName("");
			setEditing(null);
			await qc.invalidateQueries({ queryKey: ["cash-categories"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar categoria")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteCashCategory({ data: { id } }),
		onSuccess: async () => {
			toast.success("Categoria excluída");
			await qc.invalidateQueries({ queryKey: ["cash-categories"] });
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao excluir categoria")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-lg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Categorias do fluxo de caixa" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Categorias padrão do capítulo. Subcategorias de eventos são geradas automaticamente." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "Nova categoria",
							value: editing ? editing.name : name,
							onChange: (e) => editing ? setEditing({
								...editing,
								name: e.target.value
							}) : setName(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => save.mutate(),
							disabled: save.isPending || !(editing ? editing.name.trim() : name.trim()),
							style: { backgroundColor: active?.chapter.primary_color },
							children: editing ? "Atualizar" : "Adicionar"
						}),
						editing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setEditing(null),
							children: "Cancelar"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "max-h-[40vh] divide-y divide-border overflow-auto rounded-[10px] border border-border",
					children: categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 px-3 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-1 text-sm",
								children: c.name
							}),
							c.is_system && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "secondary",
								className: "text-xs",
								children: "padrão"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon",
								"aria-label": "Renomear categoria",
								onClick: () => setEditing({
									id: c.id,
									name: c.name
								}),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-4 w-4 text-muted-foreground" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon",
								"aria-label": "Excluir categoria",
								onClick: () => remove.mutate(c.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4 text-muted-foreground" })
							})
						]
					}, c.id))
				})
			]
		})
	});
}
function MetricCard({ label, value, icon, hint, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm text-muted-foreground",
					children: label
				}), icon]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `text-xl font-bold ${tone ?? ""}`,
				children: value
			}),
			hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
//#endregion
export { FluxoCaixa as component };
