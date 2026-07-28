import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as Card } from "./card-CzXpCsbD.mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
import { i as useQuery, o as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { t as PageHeader } from "./PageHeader-IXKcvjWe.mjs";
import { B as KeyRound, D as Palette, H as ImagePlus, O as Moon, P as LoaderCircle, b as RotateCcw, d as Sun, k as MonitorSmartphone, l as Trash2, mt as Building2, rt as CirclePlus, ut as Check, y as Save, z as Landmark } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as updateChapterProfile, i as updateChapterAccentColor, n as listLodges, o as updateChaveTemplate, r as saveLodge, t as deleteLodge } from "./chapter.functions-DdatMChF.mjs";
import { t as Label } from "./label-DBD1bRRP.mjs";
import { a as chaveValues, i as chavePreviewItem, n as DEFAULT_CHAVE_TEMPLATE, o as renderChaveTemplate, t as CHAVE_VARIABLES } from "./chave-do-dia-DmSt55yO.mjs";
import { t as Switch } from "./switch-Cn1w-cIH.mjs";
import { r as useChapterLogo, t as LOGO_BUCKET } from "./chapter-logo-BLyNpzNr.mjs";
import { r as useTheme } from "./ThemeContext-NlVC_MCf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/configuracoes-BwV1NlVx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Editor do modelo padrão da "chave do dia", com variáveis dinâmicas. */
function ChaveTemplateCard() {
	const { active, refetch } = useActiveChapter();
	const isAdmin = can(active?.role.name, "admin") || can(active?.role.name, "secretaria");
	const saved = (active?.chapter)?.settings?.chave_template ?? DEFAULT_CHAVE_TEMPLATE;
	const [template, setTemplate] = (0, import_react.useState)(saved);
	const areaRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		setTemplate(saved);
	}, [saved]);
	const preview = (0, import_react.useMemo)(() => {
		const item = chavePreviewItem();
		return renderChaveTemplate(template, chaveValues(item, { chapterName: active?.chapter.name ?? "" }));
	}, [template, active?.chapter.name]);
	function insertVar(key) {
		if (!isAdmin) return;
		const el = areaRef.current;
		const token = `[${key}]`;
		if (!el) {
			setTemplate((t) => `${t}${token}`);
			return;
		}
		const start = el.selectionStart ?? template.length;
		const end = el.selectionEnd ?? template.length;
		const next = template.slice(0, start) + token + template.slice(end);
		setTemplate(next);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + token.length, start + token.length);
		});
	}
	const save = useMutation({
		mutationFn: () => updateChaveTemplate({ data: {
			chapter_id: active.chapter_id,
			template: template.trim() || null
		} }),
		onSuccess: () => {
			toast.success("Modelo da chave do dia salvo");
			refetch();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar o modelo")
	});
	const dirty = template.trim() !== saved.trim();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-5 w-5" }), " Chave do dia"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-4 text-sm text-muted-foreground",
				children: "Modelo usado ao copiar a chave do dia no calendário e na tela inicial. Use as variáveis entre colchetes — elas são substituídas pelos dados do compromisso."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-3 flex flex-wrap gap-2",
				children: CHAVE_VARIABLES.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					title: v.label,
					disabled: !isAdmin,
					onClick: () => insertVar(v.key),
					className: "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
					children: [
						"[",
						v.key,
						"]"
					]
				}, v.key))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				ref: areaRef,
				value: template,
				onChange: (e) => setTemplate(e.target.value),
				rows: 16,
				disabled: !isAdmin,
				className: "font-mono text-xs"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-1 text-xs font-medium text-muted-foreground",
					children: "Pré-visualização"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-muted/40 p-3 text-xs",
					children: preview
				})]
			}),
			isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					style: { backgroundColor: "var(--chapter-primary)" },
					disabled: !dirty || save.isPending,
					onClick: () => save.mutate(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "mr-2 h-4 w-4" }), save.isPending ? "Salvando…" : "Salvar modelo"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					disabled: save.isPending,
					onClick: () => setTemplate(DEFAULT_CHAVE_TEMPLATE),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "mr-2 h-4 w-4" }), " Restaurar padrão"]
				})]
			})
		]
	});
}
var THEME_OPTIONS = [
	{
		value: "light",
		label: "Claro",
		icon: Sun
	},
	{
		value: "dark",
		label: "Escuro",
		icon: Moon
	},
	{
		value: "system",
		label: "Sistema",
		icon: MonitorSmartphone
	}
];
var DEFAULT_ACCENT = "#9E1B32";
var ACCENT_PRESETS = [
	{
		value: "#9E1B32",
		label: "Vinho DeMolay"
	},
	{
		value: "#1D4ED8",
		label: "Azul"
	},
	{
		value: "#0F766E",
		label: "Verde"
	},
	{
		value: "#B45309",
		label: "Dourado"
	},
	{
		value: "#6D28D9",
		label: "Roxo"
	},
	{
		value: "#374151",
		label: "Grafite"
	}
];
function isValidHex(v) {
	return /^#[0-9a-fA-F]{6}$/.test(v);
}
/** Texto legível sobre a cor escolhida (luminância relativa). */
function readableOn(hex) {
	if (!isValidHex(hex)) return "#FFFFFF";
	const lin = [
		1,
		3,
		5
	].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
	return .2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2] > .55 ? "#1A1A1A" : "#FFFFFF";
}
function applyAccentPreview(hex) {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty("--chapter-primary", hex);
}
function AccentColorSection() {
	const { active, refetch } = useActiveChapter();
	const isAdmin = can(active?.role.name, "admin");
	const saved = active?.chapter.primary_color || DEFAULT_ACCENT;
	const [color, setColor] = (0, import_react.useState)(saved);
	const [text, setText] = (0, import_react.useState)(saved);
	(0, import_react.useEffect)(() => {
		setColor(saved);
		setText(saved);
	}, [saved]);
	(0, import_react.useEffect)(() => {
		return () => {
			if (typeof document !== "undefined") document.documentElement.style.removeProperty("--chapter-primary");
		};
	}, []);
	function pick(hex) {
		if (!isAdmin) return;
		setColor(hex);
		setText(hex.toUpperCase());
		applyAccentPreview(hex);
	}
	const save = useMutation({
		mutationFn: () => updateChapterAccentColor({ data: {
			chapter_id: active.chapter_id,
			primary_color: color
		} }),
		onSuccess: () => {
			toast.success("Cor de destaque atualizada");
			refetch();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar a cor")
	});
	const dirty = color.toUpperCase() !== saved.toUpperCase();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 border-t border-border pt-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "h-5 w-5" }), " Cor de destaque"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-sm text-muted-foreground",
				children: "Define a cor usada em botões, destaques e etiquetas do capítulo. Vale para todos os membros deste capítulo."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: ACCENT_PRESETS.map((p) => {
					const selected = color.toUpperCase() === p.value.toUpperCase();
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						title: p.label,
						"aria-label": p.label,
						"aria-pressed": selected,
						disabled: !isAdmin,
						onClick: () => pick(p.value),
						className: "grid h-11 w-11 place-items-center rounded-full border-2 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50",
						style: {
							backgroundColor: p.value,
							borderColor: selected ? "var(--foreground)" : "transparent"
						},
						children: selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
							className: "h-4 w-4",
							style: { color: readableOn(p.value) }
						})
					}, p.value);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-end gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1 block text-xs",
						children: "Cor personalizada"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "color",
						value: isValidHex(color) ? color : DEFAULT_ACCENT,
						disabled: !isAdmin,
						onChange: (e) => pick(e.target.value.toUpperCase()),
						className: "h-11 w-16 cursor-pointer rounded-[8px] border border-border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50",
						"aria-label": "Escolher cor personalizada"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-36",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1 block text-xs",
							children: "Hex"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: text,
							disabled: !isAdmin,
							placeholder: "#9E1B32",
							onChange: (e) => {
								const v = e.target.value.toUpperCase();
								setText(v);
								if (isValidHex(v)) {
									setColor(v);
									applyAccentPreview(v);
								}
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-11 min-w-[7rem] place-items-center rounded-[8px] px-4 text-sm font-medium",
						style: {
							backgroundColor: color,
							color: readableOn(color)
						},
						children: "Pré-visualização"
					})
				]
			}),
			isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					onClick: () => pick(DEFAULT_ACCENT),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "mr-2 h-4 w-4" }), " Restaurar padrão"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					style: {
						backgroundColor: color,
						color: readableOn(color)
					},
					disabled: save.isPending || !isValidHex(color) || !dirty,
					onClick: () => save.mutate(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "mr-2 h-4 w-4" }),
						" ",
						save.isPending ? "Salvando…" : "Salvar cor"
					]
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-muted-foreground",
				children: "Somente administradores podem alterar a cor do capítulo."
			})
		]
	});
}
function AppearanceCard() {
	const { mode, setMode } = useTheme();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "h-5 w-5" }), " Aparência"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-sm text-muted-foreground",
				children: "Escolha o tema da interface. A opção “Sistema” segue a preferência do seu dispositivo."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-2 sm:grid-cols-3",
				children: THEME_OPTIONS.map((opt) => {
					const Icon = opt.icon;
					const selected = mode === opt.value;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setMode(opt.value),
						"aria-pressed": selected,
						className: `flex min-h-[44px] items-center gap-3 rounded-[8px] border px-4 py-2.5 text-sm font-medium transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/60"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" }), opt.label]
					}, opt.value);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccentColorSection, {})
		]
	});
}
var MAX_BYTES = 2 * 1024 * 1024;
function ConfiguracoesPage() {
	const { active, refetch } = useActiveChapter();
	const chapterId = active?.chapter_id ?? "";
	const logoPath = (active?.chapter)?.logo_url;
	const logoUrl = useChapterLogo(logoPath);
	const allowed = can(active?.role.name, "admin") || can(active?.role.name, "secretaria") || can(active?.role.name, "conselho");
	const inputRef = (0, import_react.useRef)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onFile(file) {
		if (!file.type.startsWith("image/")) {
			toast.error("Envie um arquivo de imagem (PNG, JPG ou WEBP).");
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error("A imagem deve ter no máximo 2 MB. Recomendado: 512×512 px.");
			return;
		}
		setBusy(true);
		try {
			const ext = file.name.split(".").pop()?.toLowerCase() || "png";
			const path = `${chapterId}/logo-${Date.now()}.${ext}`;
			const up = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
				upsert: true,
				contentType: file.type
			});
			if (up.error) throw up.error;
			const { error } = await supabase.from("chapters").update({ logo_url: path }).eq("id", chapterId);
			if (error) throw error;
			if (logoPath) await supabase.storage.from(LOGO_BUCKET).remove([logoPath]);
			toast.success("Logo atualizada");
			refetch();
		} catch (e) {
			toast.error(e?.message ?? "Erro ao enviar a logo");
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}
	async function removeLogo() {
		setBusy(true);
		try {
			const { error } = await supabase.from("chapters").update({ logo_url: null }).eq("id", chapterId);
			if (error) throw error;
			if (logoPath) await supabase.storage.from(LOGO_BUCKET).remove([logoPath]);
			toast.success("Logo removida");
			refetch();
		} catch (e) {
			toast.error(e?.message ?? "Erro ao remover a logo");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				title: "Configurações",
				subtitle: "Identidade visual e dados do capítulo ativo."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceCard, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChapterProfileCard, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LodgesCard, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChaveTemplateCard, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "rounded-[12px] p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "h-5 w-5" }), " Logo do capítulo"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-5 sm:flex-row sm:items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40",
						children: logoUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: logoUrl,
							alt: `Logo do ${active?.chapter.name ?? "capítulo"}`,
							className: "h-full w-full object-contain p-2"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "px-3 text-center text-xs text-muted-foreground",
							children: "Nenhuma logo definida"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Usada no topo das atas exportadas em PDF. Envie uma imagem quadrada, preferencialmente 512×512 px, em PNG com fundo transparente. Tamanho máximo: 2 MB."
						}), allowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: inputRef,
									type: "file",
									accept: "image/png,image/jpeg,image/webp",
									className: "hidden",
									onChange: (e) => {
										const f = e.target.files?.[0];
										if (f) onFile(f);
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									style: { backgroundColor: "var(--chapter-primary)" },
									disabled: busy,
									onClick: () => inputRef.current?.click(),
									children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, { className: "mr-2 h-4 w-4" }), logoPath ? "Trocar logo" : "Enviar logo"]
								}),
								logoPath && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "outline",
									disabled: busy,
									onClick: () => void removeLogo(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-2 h-4 w-4" }), " Remover"]
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-xs text-muted-foreground",
							children: "Somente a administração do capítulo pode alterar a logo."
						})]
					})]
				})]
			})
		]
	});
}
function ChapterProfileCard() {
	const { active, refetch } = useActiveChapter();
	const isAdmin = can(active?.role.name, "admin");
	const [name, setName] = (0, import_react.useState)("");
	const [number, setNumber] = (0, import_react.useState)("");
	const [city, setCity] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setName(active?.chapter.name ?? "");
		setNumber(active?.chapter.number ?? "");
		setCity(active?.chapter.city ?? "");
	}, [
		active?.chapter.name,
		active?.chapter.number,
		active?.chapter.city
	]);
	const save = useMutation({
		mutationFn: () => updateChapterProfile({ data: {
			chapter_id: active.chapter_id,
			name: name.trim(),
			number: number.trim(),
			city: city.trim() || null
		} }),
		onSuccess: () => {
			toast.success("Dados do capítulo atualizados");
			refetch();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "h-5 w-5" }), " Perfil do capítulo"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1 block text-xs",
							children: "Nome do capítulo"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: name,
							onChange: (e) => setName(e.target.value),
							disabled: !isAdmin
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1 block text-xs",
						children: "Número"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: number,
						onChange: (e) => setNumber(e.target.value),
						disabled: !isAdmin
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							className: "mb-1 block text-xs",
							children: "Cidade sede"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: city,
							onChange: (e) => setCity(e.target.value),
							disabled: !isAdmin
						})]
					})
				]
			}),
			isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					style: { backgroundColor: "var(--chapter-primary)" },
					disabled: save.isPending || !name.trim() || !number.trim(),
					onClick: () => save.mutate(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "mr-2 h-4 w-4" }),
						" ",
						save.isPending ? "Salvando…" : "Salvar"
					]
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-muted-foreground",
				children: "Somente administradores podem editar os dados do capítulo."
			})
		]
	});
}
function LodgesCard() {
	const { active } = useActiveChapter();
	const chapterId = active?.chapter_id ?? "";
	const isAdmin = can(active?.role.name, "admin");
	const qc = useQueryClient();
	const [name, setName] = (0, import_react.useState)("");
	const [address, setAddress] = (0, import_react.useState)("");
	const [isPrimary, setIsPrimary] = (0, import_react.useState)(false);
	const lodges = useQuery({
		queryKey: ["chapter-lodges", chapterId],
		queryFn: () => listLodges({ data: { chapterId } }),
		enabled: Boolean(chapterId)
	});
	const invalidate = () => qc.invalidateQueries({ queryKey: ["chapter-lodges", chapterId] });
	const add = useMutation({
		mutationFn: () => saveLodge({ data: {
			chapter_id: chapterId,
			name: name.trim(),
			address: address.trim() || null,
			is_primary: isPrimary
		} }),
		onSuccess: () => {
			toast.success("Loja patrocinadora adicionada");
			setName("");
			setAddress("");
			setIsPrimary(false);
			invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao salvar loja")
	});
	const setPrimary = useMutation({
		mutationFn: (l) => saveLodge({ data: {
			id: l.id,
			chapter_id: chapterId,
			name: l.name,
			address: l.address,
			is_primary: true
		} }),
		onSuccess: () => invalidate(),
		onError: (e) => toast.error(e?.message ?? "Erro")
	});
	const remove = useMutation({
		mutationFn: (id) => deleteLodge({ data: { id } }),
		onSuccess: () => {
			toast.success("Loja removida");
			invalidate();
		},
		onError: (e) => toast.error(e?.message ?? "Erro ao remover")
	});
	const list = lodges.data ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "rounded-[12px] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "h-5 w-5" }), " Lojas patrocinadoras"]
			}),
			list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Nenhuma loja cadastrada. As lojas ficam disponíveis ao criar sessões no calendário."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border rounded-[8px] border border-border",
				children: list.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center gap-3 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-sm font-medium",
							children: [l.name, l.is_primary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full px-2 py-0.5 text-[10px] font-medium",
								style: {
									backgroundColor: "var(--muted)",
									color: "var(--chapter-primary)"
								},
								children: "Principal"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: l.address || "Sem endereço informado"
						})]
					}), isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1",
						children: [!l.is_primary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => setPrimary.mutate(l),
							children: "Tornar principal"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "icon",
							variant: "ghost",
							className: "text-destructive",
							onClick: () => remove.mutate(l.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
						})]
					})]
				}, l.id))
			}),
			isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 space-y-3 rounded-[8px] border border-dashed border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1 block text-xs",
						children: "Nome da loja"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Loja Maçônica…"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						className: "mb-1 block text-xs",
						children: "Endereço"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: address,
						onChange: (e) => setAddress(e.target.value),
						placeholder: "Rua, número, bairro, cidade"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-xs text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: isPrimary,
							onCheckedChange: setIsPrimary
						}), " Definir como loja principal"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						style: { backgroundColor: "var(--chapter-primary)" },
						disabled: add.isPending || !name.trim(),
						onClick: () => add.mutate(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlus, { className: "mr-2 h-4 w-4" }), add.isPending ? "Salvando…" : "Adicionar loja patrocinadora"]
					})]
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-muted-foreground",
				children: "Somente administradores podem gerenciar as lojas patrocinadoras."
			})
		]
	});
}
//#endregion
export { ConfiguracoesPage as component };
