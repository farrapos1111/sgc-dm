# SG-CDM — Sistema Gerenciador de Capítulos DeMolay

Aplicação web para a gestão de capítulos da Ordem DeMolay: membros, atas, presenças, tesouraria, calendário e comissões — com controle de acesso por cargo e uma camada de acompanhamento regional/estadual.

## O que faz

- **Secretaria** — cadastro de membros (com responsáveis para menores e consentimento LGPD), atas com fluxo de rascunho → revisão → aprovação e três assinaturas, presenças e frequência
- **Tesouraria** — fluxo de caixa com categorias e subcategorias por comissão, mensalidades que viram lançamento de caixa automaticamente, importação/exportação em XLSX e relatório em PDF
- **Gestão** — calendário com exportação `.ics`/Google/Outlook, cargos e comissões por semestre, identidade do capítulo
- **Comissão de Eventos** — ingressos, mapa de mesas e assentos, QR Code e check-in pela câmera
- **Comissão de Sindicâncias** — fichas de candidatos e processos com parecer
- **Hospitalaria** — cardápios com custo estimado e escala de serviço
- **Regional/Estadual** — panorama dos capítulos, calendário unificado e busca de membros entre capítulos, somente leitura
- **Proteção de dados** — CPF e RG cifrados no banco, mascarados na interface e reveláveis apenas por ação registrada

## Stack

TanStack Start (React 19 + SSR) · TypeScript · Vite 8 · Tailwind CSS v4 + shadcn/ui · TanStack Query · Supabase (Postgres + Auth + Storage, com RLS) · Nitro/Cloudflare Workers

## Início rápido

```bash
bun install          # ou: npm install
# crie o .env — modelo em docs/OPEN-SOURCE.md
bun run dev          # http://localhost:3000
```

O schema do banco está em `supabase/migrations/`, aplicável em qualquer projeto Supabase.

## Documentação

Toda a documentação vive em [`docs/`](./docs/):

| Documento | Leia se você é… |
| --- | --- |
| [Documentação técnica](./docs/TECNICO.md) | desenvolvedor(a) — arquitetura, modelo de dados, permissões, variáveis de ambiente, deploy |
| [Guia do Usuário](./docs/GUIA-DO-USUARIO.md) | membro do capítulo, ou vai apresentar o sistema |
| [Projeto aberto e contribuição](./docs/OPEN-SOURCE.md) | quer contribuir — setup, padrões de código, fluxo de PR, segurança |

## Scripts

| Comando | O que faz |
| --- | --- |
| `bun run dev` | ambiente de desenvolvimento |
| `bun run build` | build de produção (bundle Nitro para Cloudflare) |
| `bun run preview` | serve o build localmente |
| `bun run lint` | ESLint + Prettier |
| `bun run format` | formata o código |

> Não há testes automatizados nem CI, e o `lint` acusa erros pré-existentes no código herdado — **rode lint e format apenas nos arquivos que você editar**. As lacunas conhecidas estão em [docs/TECNICO.md](./docs/TECNICO.md#12-estado-atual-e-lacunas-conhecidas) e o que fazer a respeito, no [roadmap](./docs/OPEN-SOURCE.md#roadmap--onde-ajudar).

## Licença

**Ainda não definida.** Sem um arquivo `LICENSE`, o código é proprietário por padrão. As opções em discussão (MIT e AGPL-3.0) estão em [docs/OPEN-SOURCE.md](./docs/OPEN-SOURCE.md#licença--decisão-pendente).

## Contribuindo

Leia [docs/OPEN-SOURCE.md](./docs/OPEN-SOURCE.md) antes de abrir um PR. Dois pontos que valem destaque:

- ⛔ **Não reescreva histórico já publicado** (`push --force`, `rebase`, `amend`, `squash`). O repositório é sincronizado com o editor Lovable e isso quebra o histórico do projeto.
- 📄 **Toda alteração atualiza a documentação correspondente no mesmo PR.** Documentação adiada é documentação nunca escrita.
