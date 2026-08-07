# Templo Virtual — Hub de gerenciamento das ordens paramaçônicas

Aplicação web para a gestão das ordens paramaçônicas (capítulos DeMolay e demais corpos): membros, atas, presenças, tesouraria, calendário e comissões — com controle de acesso por cargo e uma camada de acompanhamento regional/estadual.

> Nome anterior do projeto: **SG-CDM** (Sistema Gerenciador de Capítulos DeMolay). O repositório permanece `sgc-dm`.

## O que faz

- **Secretaria** — cadastro de membros (com responsáveis para menores e consentimento LGPD), atas com fluxo de rascunho → revisão → aprovação e três assinaturas, presenças e frequência
- **Tesouraria** — fluxo de caixa com categorias e subcategorias por comissão, mensalidades que viram lançamento de caixa automaticamente, cobrança de atrasados por membro (WhatsApp), importação/exportação em XLSX e relatório em PDF
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

Toda a documentação vive em [`docs/`](./docs/) e também no visualizador do app em **`/documentacao`**:

| Documento | Leia se você é… |
| --- | --- |
| [Documentação técnica](./docs/TECNICO.md) · `/documentacao/tecnica` | desenvolvedor(a) — arquitetura, modelo de dados, permissões, variáveis de ambiente, deploy |
| [Guia do Usuário](./docs/GUIA-DO-USUARIO.md) · `/documentacao/guia` | membro do capítulo, ou vai apresentar o sistema |
| [Projeto aberto e contribuição](./docs/OPEN-SOURCE.md) · `/documentacao/open-source` | quer contribuir — setup, tutorial de PR, padrões, segurança |

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

Este projeto é licenciado sob a **[GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE)**.

Em resumo: você pode usar, modificar e redistribuir o código; se hospedar uma versão modificada como serviço na rede, precisa publicar o código-fonte dessa versão sob a mesma licença.

## Contribuindo

Nunca contribuiu em open source? O fluxo é o mesmo de sempre — fork, branch, commit, pull request. Resumo:

1. **Fork** [farrapos1111/sgc-dm](https://github.com/farrapos1111/sgc-dm) no GitHub
2. **Clone** o seu fork
3. Crie um **branch** (`feat/…`, `fix/…` ou `docs/…`)
4. Faça a alteração (e atualize a documentação no mesmo PR)
5. `git add` → `git commit`
6. `git push` para o seu fork
7. Abra o **Pull Request** no repositório original

Tutorial completo (comandos, setup local e regras do projeto): [docs/OPEN-SOURCE.md](./docs/OPEN-SOURCE.md) ou `/documentacao/open-source`.

Dois pontos que valem destaque:

- Não reescreva histórico já publicado (`push --force`, `rebase`, `amend`, `squash`). O repositório é sincronizado com o editor Lovable e isso quebra o histórico do projeto.
- Toda alteração atualiza a documentação correspondente no mesmo PR. Documentação adiada é documentação nunca escrita.
