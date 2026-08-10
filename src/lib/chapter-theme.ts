/** Tema visual por capítulo (chapters.settings.theme). */

export type ChapterTheme = {
  background: string;
  accent: string;
  accentDark: string;
  highlight: string;
  font: string;
  sidebar: string;
};

const DEFAULT_ACCENT = "#9E1B32";
const DEFAULT_BG = "#FAFAF8";
const DEFAULT_FONT = "#1A1A1A";
const DEFAULT_SIDEBAR = "#FFFFFF";

/** Tema institucional (telas fora de organização): azul escuro + branco. */
export const PLATFORM_DEFAULT_THEME: ChapterTheme = {
  background: "#FFFFFF",
  accent: "#072D5A",
  accentDark: "#051E3E",
  highlight: "#D6E4F0",
  font: "#1A1A1A",
  sidebar: "#FFFFFF",
};

const CORE_THEME_KEYS = [
  "background",
  "accent",
  "accentDark",
  "highlight",
  "font",
] as const;

export function isThemeHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function parseRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** Escurece a cor (amount 0–1). */
export function darkenHex(hex: string, amount = 0.28): string {
  const [r, g, b] = parseRgb(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Mistura `a` com `b` (t = peso de b, 0–1). */
export function mixHex(a: string, b: string, t = 0.82): string {
  const [r1, g1, b1] = parseRgb(a);
  const [r2, g2, b2] = parseRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Deriva tema completo a partir da cor primária do capítulo. */
export function deriveThemeFromPrimary(primaryColor: string): ChapterTheme {
  const accent = isThemeHex(primaryColor)
    ? primaryColor.toUpperCase()
    : DEFAULT_ACCENT;
  return {
    background: DEFAULT_BG,
    accent,
    accentDark: darkenHex(accent),
    highlight: mixHex(accent, "#FFFFFF", 0.82),
    font: DEFAULT_FONT,
    sidebar: DEFAULT_SIDEBAR,
  };
}

/**
 * Resolve o tema do capítulo: usa `settings.theme` se completo;
 * senão deriva de `primary_color` (migração suave).
 * Temas antigos sem `sidebar` recebem o padrão branco.
 */
export function resolveChapterTheme(
  settings: Record<string, unknown> | null | undefined,
  primaryColor: string | null | undefined,
): ChapterTheme {
  const raw = settings?.theme;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const t = raw as Record<string, unknown>;
    const ok = CORE_THEME_KEYS.every(
      (k) => typeof t[k] === "string" && isThemeHex(t[k] as string),
    );
    if (ok) {
      const sidebarRaw = t.sidebar;
      const sidebar =
        typeof sidebarRaw === "string" && isThemeHex(sidebarRaw)
          ? sidebarRaw.toUpperCase()
          : DEFAULT_SIDEBAR;
      return {
        background: (t.background as string).toUpperCase(),
        accent: (t.accent as string).toUpperCase(),
        accentDark: (t.accentDark as string).toUpperCase(),
        highlight: (t.highlight as string).toUpperCase(),
        font: (t.font as string).toUpperCase(),
        sidebar,
      };
    }
  }
  return deriveThemeFromPrimary(primaryColor || DEFAULT_ACCENT);
}

/** Aplica variáveis CSS do tema no elemento (compat: --chapter-primary = accent).
 * Fundo/texto/sidebar ligam aos tokens via styles.css (:root); .dark sobrescreve.
 */
export function applyChapterThemeVars(
  el: HTMLElement | null | undefined,
  theme: ChapterTheme,
): void {
  if (!el) return;
  el.style.setProperty("--chapter-bg", theme.background);
  el.style.setProperty("--chapter-accent", theme.accent);
  el.style.setProperty("--chapter-accent-dark", theme.accentDark);
  el.style.setProperty("--chapter-highlight", theme.highlight);
  el.style.setProperty("--chapter-font", theme.font);
  el.style.setProperty("--chapter-sidebar", theme.sidebar);
  el.style.setProperty("--chapter-primary", theme.accent);
}

/** Restaura o tema institucional (azul escuro + branco) fora de organização. */
export function applyPlatformDefaultThemeVars(
  el: HTMLElement | null | undefined = typeof document !== "undefined"
    ? document.documentElement
    : null,
): void {
  applyChapterThemeVars(el, PLATFORM_DEFAULT_THEME);
}

export function clearChapterThemeVars(el: HTMLElement | null | undefined): void {
  if (!el) return;
  for (const key of [
    "--chapter-bg",
    "--chapter-accent",
    "--chapter-accent-dark",
    "--chapter-highlight",
    "--chapter-font",
    "--chapter-sidebar",
    "--chapter-primary",
  ]) {
    el.style.removeProperty(key);
  }
}

/** Objeto de estilo React com as variáveis do tema. */
export function chapterThemeStyle(
  theme: ChapterTheme,
): Record<string, string> {
  return {
    "--chapter-bg": theme.background,
    "--chapter-accent": theme.accent,
    "--chapter-accent-dark": theme.accentDark,
    "--chapter-highlight": theme.highlight,
    "--chapter-font": theme.font,
    "--chapter-sidebar": theme.sidebar,
    "--chapter-primary": theme.accent,
  };
}
