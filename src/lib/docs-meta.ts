/**
 * Títulos e descrições da documentação, sem o conteúdo Markdown.
 * Usado no <head> das rotas: o texto completo (docs-catalog) só carrega na página.
 */
export const DOCS_META = {
  tecnica: {
    label: "Documentação técnica",
    description:
      "Stack, arquitetura, modelo de dados, permissões, variáveis de ambiente, build e deploy.",
  },
  guia: {
    label: "Guia do usuário",
    description:
      "O que o sistema faz, tela por tela, em linguagem simples — ideal para apresentar o Templo Virtual.",
  },
  "open-source": {
    label: "Open source e contribuição",
    description:
      "Setup local, tutorial passo a passo de fork e pull request, padrões de código e segurança.",
  },
} as const;
