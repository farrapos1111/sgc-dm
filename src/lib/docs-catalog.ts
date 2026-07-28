import type { ComponentType } from "react";
import { BookOpen, Code2, HeartHandshake } from "lucide-react";

import tecnicoMd from "../../docs/TECNICO.md?raw";
import guiaMd from "../../docs/GUIA-DO-USUARIO.md?raw";
import openSourceMd from "../../docs/OPEN-SOURCE.md?raw";

export type DocsCategorySlug = "tecnica" | "guia" | "open-source";

export type DocsCategory = {
  slug: DocsCategorySlug;
  to: `/documentacao/${DocsCategorySlug}`;
  label: string;
  shortLabel: string;
  audience: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  content: string;
  title: string;
};

export const DOCS_CATEGORIES: DocsCategory[] = [
  {
    slug: "tecnica",
    to: "/documentacao/tecnica",
    label: "Documentação técnica",
    shortLabel: "Técnica",
    audience: "Desenvolvedores e operadores",
    description:
      "Stack, arquitetura, modelo de dados, permissões, variáveis de ambiente, build e deploy.",
    icon: Code2,
    content: tecnicoMd,
    title: "Documentação técnica — SG-CDM",
  },
  {
    slug: "guia",
    to: "/documentacao/guia",
    label: "Guia do usuário",
    shortLabel: "Guia",
    audience: "Membros do capítulo",
    description:
      "O que o sistema faz, tela por tela, em linguagem simples — ideal para apresentar o SG-CDM.",
    icon: BookOpen,
    content: guiaMd,
    title: "Guia do Usuário — SG-CDM",
  },
  {
    slug: "open-source",
    to: "/documentacao/open-source",
    label: "Open source e contribuição",
    shortLabel: "Contribuir",
    audience: "Quem quer contribuir",
    description:
      "Setup local, tutorial passo a passo de fork e pull request, padrões de código e segurança.",
    icon: HeartHandshake,
    content: openSourceMd,
    title: "Projeto aberto e contribuição — SG-CDM",
  },
];

export function getDocsCategory(slug: DocsCategorySlug): DocsCategory {
  const found = DOCS_CATEGORIES.find((c) => c.slug === slug);
  if (!found) throw new Error(`Categoria de documentação desconhecida: ${slug}`);
  return found;
}

/** Reescreve links relativos entre os .md para as rotas do visualizador. */
export function rewriteDocsHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#") || href.startsWith("mailto:")) {
    return href;
  }

  const fileMap: Record<string, string> = {
    "./TECNICO.md": "/documentacao/tecnica",
    "TECNICO.md": "/documentacao/tecnica",
    "./GUIA-DO-USUARIO.md": "/documentacao/guia",
    "GUIA-DO-USUARIO.md": "/documentacao/guia",
    "./OPEN-SOURCE.md": "/documentacao/open-source",
    "OPEN-SOURCE.md": "/documentacao/open-source",
    "./README.md": "/documentacao",
    "README.md": "/documentacao",
  };

  const [pathPart, hash = ""] = href.split("#");
  const mapped = fileMap[pathPart];
  if (mapped) return hash ? `${mapped}#${hash}` : mapped;

  // Links para arquivos do repo (../src/..., ../LICENSE, etc.) — manter como GitHub quando possível
  if (pathPart.startsWith("../") || pathPart.startsWith("./")) {
    const cleaned = pathPart.replace(/^\.\.\//, "").replace(/^\.\//, "");
    return `https://github.com/farrapos1111/sgc-dm/blob/main/${cleaned}${hash ? `#${hash}` : ""}`;
  }

  return href;
}

/** Alinha com âncoras tipicamente usadas nos .md (ex.: #roadmap--onde-ajudar). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[—–]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

export type TocItem = { id: string; text: string; level: 2 | 3 };

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();

  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/[*_`#\[\]]/g, "").trim();
    let id = slugifyHeading(text);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    items.push({ id, text, level });
  }

  return items;
}

/** Seções h2 de uma categoria — usadas na sidebar esquerda. */
export function getCategoryToc(slug: DocsCategorySlug): TocItem[] {
  return extractToc(getDocsCategory(slug).content).filter((item) => item.level === 2);
}

export type DocsSidebarNav = {
  category: DocsCategory;
  sections: TocItem[];
};

export const DOCS_SIDEBAR_NAV: DocsSidebarNav[] = DOCS_CATEGORIES.map((category) => ({
  category,
  sections: extractToc(category.content).filter((item) => item.level === 2),
}));

