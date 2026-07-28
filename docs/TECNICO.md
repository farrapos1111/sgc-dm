# Documentação técnica — SG-CDM

Documento para quem vai desenvolver, revisar ou operar o sistema. Para a visão de produto, veja o [Guia do Usuário](./GUIA-DO-USUARIO.md); para contribuir, veja [OPEN-SOURCE.md](./OPEN-SOURCE.md).

---

## 1. Visão geral

O SG-CDM é uma aplicação full-stack **TanStack Start** (React + SSR) com **Supabase** (Postgres, Auth, Storage) como backend. Não existe servidor de API separado: a camada de servidor são *server functions* do TanStack Start, e a autorização real mora em políticas RLS no Postgres.

A aplicação é **multi-inquilino por capítulo**: quase toda tabela carrega `chapter_id`, e a associação usuário↔capítulo↔cargo vive em `chapter_members`. Acima disso há um escopo **regional/estadual**, somente leitura, para lideranças (`org_leaderships`).

### Stack

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| Framework | TanStack Start | `^1.168.26` |
| Roteamento | TanStack Router (file-based) | `^1.170.16` |
| UI | React / React DOM | `^19.2.0` |
| Build | Vite | `^8.0.16` |
| Preset de build | `@lovable.dev/vite-tanstack-config` | `^2.7.7` |
| Servidor | Nitro (preset `cloudflare-module`) | `3.0.260603-beta` |
| Linguagem | TypeScript (`strict`, ES2022) | `^5.8.3` |
| Estilo | Tailwind CSS v4 + shadcn/ui (new-york) + Radix | `^4.2.1` |
| Estado de servidor | TanStack Query | `^5.101.1` |
| Banco / Auth / Storage | `@supabase/supabase-js` | `^2.110.8` |
| Validação | Zod | `^3.24.2` |
| Formulários | react-hook-form + `@hookform/resolvers` | `^7.71.2` |
| IA | Vercel AI SDK (`ai`) via Lovable AI Gateway | `^7.0.37` |
| Documentos | jspdf, xlsx, qrcode, html5-qrcode | — |
| Gráficos | recharts | `^2.15.4` |
| Lint/format | ESLint 9 (flat config) + Prettier | — |

Gerenciador de pacotes: **Bun** (`bun.lock`, `bunfig.toml`). Existe um `package-lock.json` como alternativa com npm.

> `bunfig.toml` define `minimumReleaseAge = 86400` — pacotes publicados há menos de 24h são bloqueados, como proteção contra ataques de cadeia de suprimentos. Há uma lista de exceções para `@lovable.dev/*`.

---

## 2. Estrutura de diretórios

```
.lovable/            metadados do template + plan.md (spec da camada regional, pt-BR)
public/              favicon, robots.txt
supabase/
  config.toml        project ref
  migrations/        26 arquivos .sql — a única fonte de verdade do schema
src/
  server.ts          handler de fetch do SSR (normaliza erros 500 engolidos pelo h3)
  start.ts           createStart(): middlewares globais de auth, CSRF e erro
  router.tsx         cria router + QueryClient (staleTime 60s)
  routeTree.gen.ts   GERADO — não editar
  styles.css         tema Tailwind v4 e design tokens
  routes/            telas (roteamento por arquivo — ver src/routes/README.md)
  components/
    ui/              52 primitivos shadcn/ui — não editar à mão
    shell/           AppShell (sidebar desktop, abas mobile, troca de escopo)
    members/ minutes/ settings/   componentes de feature
    *.tsx            EmptyState, PageHeader, PageSkeleton, QrScanner, ThemeToggle…
  context/           ActiveChapterContext, OrgScopeContext, ThemeContext
  hooks/             use-mobile, useCommissionAccess
  integrations/supabase/
    client.ts        cliente do browser (chave anônima)
    client.server.ts cliente service-role — ignora RLS, uso restrito
    auth-attacher.ts middleware de cliente: anexa o Bearer token
    auth-middleware.ts middleware de servidor: valida o JWT
    types.ts         GERADO do schema — não editar
  lib/
    *.functions.ts   server functions (camada de serviço)
    *.server.ts      código exclusivo de servidor
    *.ts             helpers puros (permissions, nav, format, terms, ics…)
```

### Arquivos gerados — nunca editar à mão

- `src/routeTree.gen.ts` — regenerado pelo plugin do TanStack Router a cada `dev`/`build`.
- `src/integrations/supabase/types.ts` — regenerado a partir do schema do Supabase. Depois de criar uma migration, este arquivo precisa ser regerado, senão o TypeScript não conhece a tabela nova.

---

## 3. Arquitetura e fluxo de dados

### Pontos de entrada

| Arquivo | Papel |
| --- | --- |
| [src/server.ts](../src/server.ts) | Envolve o `server-entry` do TanStack Start e converte erros 500 engolidos pelo h3 em uma página de erro legível |
| [src/start.ts](../src/start.ts) | `createStart()` — registra `functionMiddleware: [attachSupabaseAuth]` e `requestMiddleware: [errorMiddleware, csrfMiddleware]` |
| [src/router.tsx](../src/router.tsx) | Cria o router e o `QueryClient` (`staleTime` 60s, sem refetch ao focar a janela), passado como contexto do router |
| [src/routes/\_\_root.tsx](../src/routes/__root.tsx) | Shell HTML, `<head>`, script inline anti-flash de tema, providers, toaster, boundaries de 404 e erro |

### Camadas

1. **UI** — `src/routes/**` (telas) sobre `src/components/ui/**` (shadcn/ui) e o `AppShell`.
2. **Estado de cliente** — React Context para o que é transversal à sessão (`ActiveChapterContext`, `OrgScopeContext`, `ThemeContext`). Não há Redux, Zustand ou Jotai.
3. **Estado de servidor** — TanStack Query para tudo que vem do banco.
4. **Camada de serviço** — `src/lib/*.functions.ts`. Cada export é um `createServerFn({ method: "POST" })` com `inputValidator` Zod e `.middleware([requireSupabaseAuth])`. São endpoints RPC que rodam no servidor mas se importam e chamam como funções assíncronas comuns.
5. **Dados** — Supabase Postgres. O `context.supabase` recebido pelo handler é um cliente **vinculado ao JWT de quem chamou**, então toda query continua sujeita a RLS.

### Caminho completo de uma requisição

```
componente
  └─ useQuery / useMutation           chave ex.: ["cash-entries", chapterId, year, month]
       └─ serverFn({ data })          src/lib/*.functions.ts
            └─ attachSupabaseAuth     middleware de cliente — anexa Authorization: Bearer <access_token>
                 └─ requireSupabaseAuth   middleware de servidor — valida o JWT via getClaims()
                                          e monta context.supabase + context.userId
                      └─ inputValidator (Zod)
                           └─ supabase-js
                                └─ Postgres + políticas RLS
  ◀── dados ── cache do Query ── render
onSuccess da mutation → qc.invalidateQueries([...]) → refetch
```

### Exceções ao caminho acima

- **Leituras diretas do browser para o Supabase**, sem passar por *server function* — por exemplo o `ActiveChapterContext` consultando `chapter_members`/`profiles`, e todas as chamadas de `supabase.auth`. Nesses casos **a RLS é a única barreira**; não existe validação intermediária.
- **Escritas sensíveis passam por RPC do Postgres**, não por escrita direta em tabela: `create_member_with_pii`, `update_member_with_pii`, `add_member_guardian`, `reveal_member_pii`.

---

## 4. Convenções de arquivo (importante)

O sufixo do arquivo carrega significado semântico e há lint reforçando isso.

| Sufixo | Significado | Como importar |
| --- | --- | --- |
| `*.functions.ts` | *Server functions*. O corpo roda no servidor, mas o módulo é importável do cliente — o bundler substitui pela chamada RPC. | `import { listCashEntries } from "@/lib/finance.functions"` — normal, no topo |
| `*.server.ts` | Código **exclusivo de servidor**. Nunca pode entrar no bundle do cliente. | `await import("@/lib/cash-validation.server")` — **dinâmico, dentro do handler** |

Exemplos reais de `*.server.ts`: [src/lib/cash-validation.server.ts](../src/lib/cash-validation.server.ts), [src/lib/ai-gateway.server.ts](../src/lib/ai-gateway.server.ts), [src/integrations/supabase/client.server.ts](../src/integrations/supabase/client.server.ts).

O [eslint.config.js](../eslint.config.js) proíbe importar o pacote `server-only` (padrão do Next.js) com uma mensagem explicando essa convenção — o TanStack Start usa `*.server.ts` ou `@tanstack/react-start/server-only`.

Outras convenções:

- **Idioma:** strings da UI, segmentos de rota e comentários em português; identificadores de código em inglês. `<html lang="pt-BR">`.
- **Imports:** alias `@/` → `./src/` (configurado no `tsconfig.json`).
- **Bibliotecas pesadas são carregadas sob demanda** (`jspdf`, `xlsx`, `qrcode`, `html5-qrcode` todas atrás de `await import()`), para não inflar o bundle inicial.
- **`src/components/ui/` é território do shadcn/ui** — são primitivos gerados; alterações vão em componentes de feature, não neles.

---

## 5. Camada de serviço

Os 14 arquivos em `src/lib/*.functions.ts`:

| Arquivo | Cobre |
| --- | --- |
| `ai.functions.ts` | `improveText`, `composeEventDescription` (via Lovable AI Gateway) |
| `attendance.functions.ts` | Chamada e registros de presença por evento de calendário |
| `calendar.functions.ts` | CRUD de `calendar_events`, sessões em andamento |
| `cash-subcategories.functions.ts` | Configuração de subcategorias de caixa por comissão |
| `chapter.functions.ts` | Dados, configurações e identidade do capítulo |
| `commissions.functions.ts` | Comissões e seus membros por termo |
| `events.functions.ts` | Eventos de arrecadação: ingressos, mesas, assentos, check-ins |
| `finance.functions.ts` | Fluxo de caixa, categorias, mensalidades, assinantes do relatório |
| `hospitality.functions.ts` | Cardápios e escala de serviço |
| `investigations.functions.ts` | Fichas e processos de sindicância |
| `members.functions.ts` | Membros, responsáveis, PII (`revealMemberPii`), histórico |
| `minutes.functions.ts` | Atas, modelos e aprovações/assinaturas |
| `org.functions.ts` | Escopo regional/estadual: panorama, calendário e membros consolidados |
| `organization.functions.ts` | Administração de estados, regiões e capítulos (GME) |

Helpers puros relevantes em `src/lib/`: `permissions.ts` (matriz de acesso), `nav.ts` (árvores de navegação), `terms.ts` (ano/semestre), `format.ts` (BRL, datas, máscaras de PII), `cash-categories.ts`, `chave-do-dia.ts`, `minute-vars.ts` (interpolação de variáveis em modelos de ata), `ics.ts`, `finance-pdf.ts`, `finance-xlsx.ts`, `minute-pdf.ts`, `chapter-logo.ts` (URLs assinadas do bucket privado), `query-keys.ts`, `error-capture.ts`, `error-page.ts`.

---

## 6. Modelo de dados

Schema definido pelas 26 migrations em [supabase/migrations/](../supabase/migrations/); tipos gerados em [src/integrations/supabase/types.ts](../src/integrations/supabase/types.ts). São 35 tabelas.

### Identidade e multi-inquilino
`states` → `regions` → `chapters` (nome, número, cidade, `primary_color`, `logo_url`, `settings` JSONB, campos do encarregado LGPD) · `profiles` (1:1 com `auth.users`, guarda `active_chapter_id`; criado pelo trigger `handle_new_user`) · `roles` (catálogo) · **`chapter_members`** (usuário + capítulo + cargo + ativo — é o que concede todo o acesso ao capítulo) · `org_leaderships` (usuário + `org_role` + estado **ou** região + termo) · `audit_logs`.

### Pessoas
`members` (escopo de capítulo; `status` ativo|inativo|senior|macom; `cpf_encrypted`/`cpf_last2`, `rg_encrypted`/`rg_last2`, endereço JSONB, datas de graus e exames) · `guardians` (até 2 por membro, um principal via índice único parcial) · `lgpd_consents`.

### Governança
`positions` (25 cargos semeados, de Mestre Conselheiro a Sentinela, mais cargos consultivos) ↔ `member_positions` (membro + cargo + `term_year`/`term_semester`) · `commissions` (9 semeadas: midia, novos_membros, manutencao, eventos, entretenimento, hospitalaria, auditoria, financas, sindicancias) ↔ `commission_members` (+ `commission_role` + termo) · `chapter_lodges`.

### Calendário, presenças e atas
`calendar_events` (5 tipos, obrigatoriedade, aberto ao público, traje, local, `lodge_id` e `related_event_id` opcionais) · `attendance_records` (único por evento+membro; presente|ausente + justificativa) · `session_minutes` (1:1 com o evento de calendário; rascunho|em_revisao|aprovada) · `minute_approvals` (por papel signatário) · `minute_templates`.

### Finanças
`cash_entries` (kind, `category` texto, `subcategory` texto — *snapshot*, `calendar_event_id`, valor, data, comprovante) · `cash_categories` (por capítulo, `is_system`, único por capítulo+nome) · `cash_subcategories` (por capítulo, escopo eventos|hospitalaria, `calendar_event_id` opcional, ativo; índice único em capítulo+escopo+coalesce(evento)+lower(nome)) · `member_dues` (único por capítulo+membro+`competence_year`+`competence_month`; status em_aberto|pago|isento; `cash_entry_id` apontando de volta para `cash_entries`).

### Eventos de arrecadação (distintos de `calendar_events`)
`events` → `ticket_types` → `tickets` (com `qr_code`; valido|cancelado|usado) → `checkins` (qr|nome) · `event_tables` (capacidade, `pos_x`/`pos_y` para o mapa) → `seats`.

### Comissões
`investigation_files` → `investigation_processes` (aberta|em_andamento|aprovada|reprovada|arquivada) · `hospitality_menus` (opcionalmente ligado a um evento de calendário, com custo estimado) · `hospitality_duties`.

### Convenções do schema
Quase toda tabela de conteúdo carrega `chapter_id` (a chave de inquilino), `created_by`, `created_at` e `updated_at` — este último mantido pelo trigger `tg_set_updated_at()`.

**Enums** (`types.ts`): `attendance_status`, `calendar_event_type`, `cash_entry_kind`, `checkin_method`, `commission_role`, `due_status`, `event_status`, `investigation_status`, `member_status`, `minute_signer_role`, `minute_status`, `org_role` (`gme`/`mce`/`mcr`/`oe`), `ticket_status`.

---

## 7. Autenticação e autorização

### Fluxo de autenticação

1. `/auth` ([src/routes/auth.tsx](../src/routes/auth.tsx), `ssr: false`) — e-mail e senha via `supabase.auth.signInWithPassword`.
2. `_authenticated/route.tsx` — o `beforeLoad` chama `supabase.auth.getUser()` e redireciona para `/auth` se não houver sessão; monta `ActiveChapterProvider` e `OrgScopeProvider`.
3. `_authenticated/index.tsx` redireciona `/` → `/inicio`.
4. `_shell/route.tsx` resolve o escopo de trabalho:
   - 0 vínculos de capítulo + ≥1 liderança → entra direto no escopo regional
   - >1 vínculo e nenhum escolhido → `/selecionar-capitulo`
   - 0 de ambos → mensagem de conta não vinculada
5. O capítulo ativo é persistido em `localStorage` (`sgcdm.activeChapterId`) **e** espelhado em `profiles.active_chapter_id` para continuidade entre dispositivos. O escopo org fica em `sgcdm.activeOrgScope`.
6. Toda chamada de *server function* leva `Authorization: Bearer <access_token>` e é verificada no servidor com `supabase.auth.getClaims(token)`. Um middleware de CSRF protege essas requisições.
7. O logout limpa o `localStorage`, chama `supabase.auth.signOut()` e navega com recarga completa para `/auth`.

### Autorização em duas camadas

**Camada 1 — UI/cliente:** matriz em [src/lib/permissions.ts](../src/lib/permissions.ts), 8 cargos × 6 permissões.

| Cargo (`RoleName`) | Rótulo | Permissões |
| --- | --- | --- |
| `admin_total` | Administrador Total | admin, secretaria, tesouraria, comissoes, conselho, visualizar |
| `mestre_conselheiro` | Mestre Conselheiro | admin, secretaria, tesouraria, comissoes, conselho, visualizar |
| `consultor` | Consultor | conselho, visualizar |
| `presidente_conselho` | Presidente do Conselho | conselho, visualizar |
| `escrivao` | Escrivão | secretaria, comissoes, visualizar |
| `tesoureiro` | Tesoureiro | tesouraria, visualizar |
| `presidente_comissao` | Presidente de Comissão | comissoes, visualizar |
| `membro` | Membro | visualizar |

`can(roleName, perm)` é o predicado usado na UI; `canManageAttendance()` é um atalho para secretaria ∪ conselho ∪ admin. Cargo desconhecido cai em `["visualizar"]`.

**Camada 2 — banco:** RLS em todas as tabelas, apoiada em funções `SECURITY DEFINER`: `is_chapter_member`, `has_role`, `has_any_role`, **`has_permission`** (espelha a matriz TypeScript), `can_read_chapter`, `is_state_leader`, `is_region_leader`, `is_gme`, `can_lead_chapter`, `is_commission_member`, `is_commission_president`, `can_manage_commission`.

As políticas de leitura foram ampliadas para `can_read_chapter`, de modo que lideranças regionais/estaduais enxerguem os capítulos sob sua jurisdição. As políticas de escrita continuam locais ao capítulo.

> ⚠️ **A matriz existe duplicada: em TypeScript e em SQL.** Alterar `MATRIX` em `permissions.ts` sem alterar `has_permission` na migration correspondente cria divergência silenciosa — a UI esconde o botão mas o banco continua aceitando a escrita (ou o contrário, e o usuário vê um erro sem explicação). **Toda mudança de permissão precisa das duas pontas, no mesmo PR.**

### Visibilidade por comissão

Os setores de Eventos, Sindicâncias e Hospitalaria só aparecem para quem é membro da comissão correspondente (ou admin do capítulo). A regra fica em [src/hooks/useCommissionAccess.ts](../src/hooks/useCommissionAccess.ts) e é aplicada por `visibleGroups()` em [src/lib/nav.ts](../src/lib/nav.ts).

---

## 8. PII e LGPD

O sistema lida com dados pessoais de menores de idade, o que eleva o rigor exigido.

- **CPF e RG são cifrados no Postgres** pelas funções `encrypt_pii`/`decrypt_pii`. As colunas `*_encrypted` guardam o valor cifrado; as colunas `*_last2` guardam apenas os dois últimos dígitos, para exibição.
- **A leitura em claro só existe pela RPC `reveal_member_pii`**, exposta por `revealMemberPii` em [src/lib/members.functions.ts](../src/lib/members.functions.ts) e restrita a cargos de dentro do capítulo. Não há SELECT direto que devolva o valor.
- **A UI mascara por padrão** com `formatCpfMask`/`formatRgMask` ([src/lib/format.ts](../src/lib/format.ts)).
- `lgpd_consents` registra os consentimentos coletados no cadastro; `audit_logs` registra acessos e alterações sensíveis.
- No escopo regional/estadual, PII **não** é exposta — a busca de membros entre capítulos devolve dados mascarados.
- **Storage:** bucket privado `chapter-logos`, com políticas exigindo que o primeiro segmento do caminho seja o UUID do capítulo. O acesso é por URL assinada ([src/lib/chapter-logo.ts](../src/lib/chapter-logo.ts)).

---

## 9. Módulo Financeiro

O módulo mais recente e o de acoplamento mais alto — vale ler antes de mexer.

Telas: `/tesouraria/fluxo` ([tesouraria.fluxo.tsx](../src/routes/_authenticated/_shell/tesouraria.fluxo.tsx)) e `/tesouraria/mensalidades`. `/financeiro` é um redirecionamento legado para `/tesouraria/fluxo`.

### Categorias em dois níveis

**Categorias fixas** são semeadas por capítulo pelo trigger `tg_seed_cash_categories` no insert de `chapters` — Eventos, Hospitalaria, Mensalidades, SCDB / GCE, Entretenimento, Outras ([src/lib/cash-categories.ts](../src/lib/cash-categories.ts)). O capítulo pode criar categorias próprias pelo diálogo "Categorias".

**Subcategorias dinâmicas** existem só para as duas categorias que pertencem a comissões: Eventos (escopo `eventos`) e Hospitalaria (escopo `hospitalaria`). Só a comissão dona (ou admin/tesoureiro) define as subcategorias; o tesoureiro então **precisa** escolher uma ao lançar. A validação é server-side em [src/lib/cash-validation.server.ts](../src/lib/cash-validation.server.ts): `resolveSubcategory` confere que a subcategoria pertence ao capítulo, bate com o escopo e está ativa, e grava o **nome como snapshot de texto** em `cash_entries.subcategory` mais o `calendar_event_id` vinculado. Subcategorias de Eventos penduram em um evento de calendário real.

> O snapshot de texto é intencional: renomear ou apagar uma subcategoria não reescreve o histórico contábil já lançado.

### Acoplamento mensalidade ↔ caixa

Esta é a parte que quebra se mexida sem cuidado ([src/lib/finance.functions.ts](../src/lib/finance.functions.ts)):

- `listDues` só devolve membros com status `ativo` — Sênior DeMolay e Maçom são isentos por definição.
- `generateDues` cria em lote as cobranças `em_aberto` de uma competência (ano+mês), com `ignoreDuplicates`.
- **`upsertDue` é bidirecional:** marcar como **pago** insere automaticamente uma linha em `cash_entries` na categoria "Mensalidades", com descrição padronizada (`duesDescription`), e guarda o id em `member_dues.cash_entry_id`. Mudar o status para algo diferente de pago **apaga** essa entrada de caixa.
- `createManualDuesEntry` cobre pagamentos negociados ou de vários meses: cria uma entrada de caixa e rateia o valor igualmente entre até 24 competências, marcando todas como pagas e ligando-as à mesma entrada.
- A UI invalida as chaves `["dues"]` **e** `["cash-entries"]` dos dois lados, para as duas telas não divergirem.

### Importação, exportação e relatório

- **Import XLSX** com diálogo de conferência: `parseCashSheet` lê `Data | Tipo | Valor | Categoria | Descrição`, converte datas `dd/mm/aaaa` e moeda `R$ 1.234,56`, e marca erro por linha; só as linhas válidas são enviadas. `importCashEntries` limita a 1000 linhas ([src/lib/finance-xlsx.ts](../src/lib/finance-xlsx.ts)).
- **Export XLSX** e download de modelo em branco (`downloadCashTemplate`).
- **Relatório PDF** ([src/lib/finance-pdf.ts](../src/lib/finance-pdf.ts), jsPDF): logo do capítulo, rótulo do período, tabela paginada, totais e uma página de assinaturas cujos nomes vêm de `getFinanceSigners` — que resolve PCC, MC, Tesoureiro e Consultor da Tesouraria do termo corrente (ano/semestre, ver [src/lib/terms.ts](../src/lib/terms.ts)).

### Controle de acesso do módulo

- UI: `can(active?.role.name, "tesouraria")` habilita as ações de escrita.
- Banco: políticas `cash_write` / `dues_write` usam `public.has_permission(chapter_id, 'tesouraria')` → `admin_total`, `mestre_conselheiro`, `tesoureiro`. As leituras usam `can_read_chapter` / `is_chapter_member`.

---

## 10. Ambiente e configuração

### Variáveis de ambiente

| Variável | Consumidor | Obrigatória | Observação |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | [client.ts](../src/integrations/supabase/client.ts) | sim | cliente do browser; embutida no build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | [client.ts](../src/integrations/supabase/client.ts) | sim | chave anônima, pública por design |
| `SUPABASE_URL` | [auth-middleware.ts](../src/integrations/supabase/auth-middleware.ts) | sim | cliente por requisição no SSR |
| `SUPABASE_PUBLISHABLE_KEY` | [auth-middleware.ts](../src/integrations/supabase/auth-middleware.ts) | sim | idem |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | `.env`, `supabase/config.toml` | sim | referência do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | [client.server.ts](../src/integrations/supabase/client.server.ts) | **não está no `.env`** | **ignora RLS** — injetar apenas no ambiente de deploy, jamais no cliente ou no repositório |
| `LOVABLE_API_KEY` | [ai.functions.ts](../src/lib/ai.functions.ts) | **não está no `.env`** | sem ela, as funções de IA lançam `"IA indisponível: LOVABLE_API_KEY não configurada."` |

> ⚠️ O arquivo `.env` **está versionado no git** e não consta no `.gitignore`. Ele contém apenas a URL e a chave publicável (públicas por design), mas versionar `.env` é uma prática que convida ao vazamento na primeira vez que alguém colocar um segredo real ali. A correção pendente é adicionar `.env` ao `.gitignore` e publicar um `.env.example` — ver [OPEN-SOURCE.md](./OPEN-SOURCE.md#roadmap--onde-ajudar).

### Arquivos de configuração

| Arquivo | Papel |
| --- | --- |
| [vite.config.ts](../vite.config.ts) | Invólucro fino sobre `@lovable.dev/vite-tanstack-config`. O preset **já injeta** devtools, tanstackStart, viteReact, tailwind, tsconfigPaths, nitro, injeção de `VITE_*` e o alias `@`. Adicionar esses plugins manualmente quebra a aplicação. |
| `tsconfig.json` | strict, ES2022, `@/*` → `./src/*`, `noEmit` |
| `components.json` | configuração do shadcn/ui (estilo new-york, base slate) |
| [eslint.config.js](../eslint.config.js) | flat config; proíbe `server-only`; Prettier como regra |
| `.prettierrc` | `printWidth: 100`, aspas duplas, vírgula final |
| `bunfig.toml` | `minimumReleaseAge` de 24h com exceções para `@lovable.dev/*` |
| `supabase/config.toml` | referência do projeto Supabase |

---

## 11. Scripts, build e deploy

| Script | Comando | Uso |
| --- | --- | --- |
| `dev` | `vite dev` | desenvolvimento local |
| `build` | `vite build` | build de produção |
| `build:dev` | `vite build --mode development` | build com sourcemaps/modo dev |
| `preview` | `vite preview` | serve o build local |
| `lint` | `eslint .` | lint + Prettier |
| `format` | `prettier --write .` | formata |

**Build:** gera um bundle Nitro com preset `cloudflare-module` (`nodeCompat: true`) em `.output/`.

**Deploy:** Cloudflare Workers, via `npx wrangler deploy` (e `npx wrangler dev` para preview). Não há `wrangler.toml` versionado — ele é gerado em `.output/server/wrangler.json` durante o build. Lembre de configurar `SUPABASE_SERVICE_ROLE_KEY` e `LOVABLE_API_KEY` como *secrets* do Worker, não em arquivo.

**Banco:** mudanças de schema sempre por migration em `supabase/migrations/`, aplicadas via Supabase CLI ou Lovable Cloud. Depois de aplicar, regenere `src/integrations/supabase/types.ts`.

---

## 12. Estado atual e lacunas conhecidas

Registrado aqui de propósito, para ninguém descobrir do jeito difícil:

- **Não há testes.** Nenhum framework instalado (sem vitest, jest ou playwright), nenhum arquivo `*.test.*` ou `*.spec.*`.
- **Não há CI.** Não existe `.github/`, Makefile nem Dockerfile.
- **Não há script de `typecheck`.** Com `noEmit` no tsconfig e sem script dedicado, erros de tipo só aparecem no editor ou no build.
- **O lint não passa hoje.** `eslint .` reporta ~2.535 erros em 70 arquivos:

  | Regra | Ocorrências | Natureza |
  | --- | --- | --- |
  | `prettier/prettier` | 2.377 | só formatação — o Prettier nunca foi aplicado ao código gerado |
  | `@typescript-eslint/no-explicit-any` | 149 | tipagem frouxa |
  | `react-hooks/exhaustive-deps` | 12 | possíveis bugs de dependência de efeito |
  | `react-refresh/only-export-components` | 12 | atrapalha o hot reload |
  | `react-hooks/rules-of-hooks` | 9 | **bug real em potencial** — hook chamado condicionalmente |

  Consequência prática: **o lint não funciona como barreira de qualidade**, já que ninguém consegue distinguir o erro novo do ruído de fundo. E rodar `prettier --write .` de uma vez reformataria 70 arquivos — ver o aviso em [OPEN-SOURCE.md](./OPEN-SOURCE.md#padrões-de-código) antes de fazer isso. Os 9 `rules-of-hooks` merecem investigação individual: são os únicos que apontam para defeito de execução, não de estilo.
- `improveText` em [src/lib/ai.functions.ts](../src/lib/ai.functions.ts) está exportada mas nenhuma tela a chama.
- `supabaseAdmin` em [src/integrations/supabase/client.server.ts](../src/integrations/supabase/client.server.ts) está definida mas nunca importada — daí `SUPABASE_SERVICE_ROLE_KEY` ainda não ser necessária na prática.
- **A tela de login exibe credenciais de teste** ([src/routes/auth.tsx](../src/routes/auth.tsx)). Precisa sair antes de qualquer uso real.
- `.env` versionado (ver seção 10).
- `package.json.name` ainda é `tanstack_start_ts`, herdado do template.
- O histórico de commits não serve como documentação: a maioria são commits automáticos com a mensagem "Changes", vindos da sincronização com o editor Lovable.

---

## 13. Manutenção desta documentação

> Toda alteração no projeto deve atualizar a documentação correspondente **no mesmo commit/PR**. Ver a tabela de roteamento em [docs/README.md](./README.md#regra-de-manutenção-da-documentação).

Checklist específico deste documento:

| Se você… | Atualize |
| --- | --- |
| Adicionou uma rota | seção 2 (estrutura) e a lista de telas do [Guia do Usuário](./GUIA-DO-USUARIO.md) |
| Criou um `*.functions.ts` | a tabela da seção 5 |
| Escreveu uma migration | seção 6 (modelo de dados); regenere `types.ts` |
| Mudou cargo ou permissão | seção 7 — **nas duas pontas, TS e SQL** — e o Guia do Usuário |
| Adicionou variável de ambiente | a tabela da seção 10 **e** o bloco `.env.example` em [OPEN-SOURCE.md](./OPEN-SOURCE.md) |
| Adicionou dependência relevante | a tabela de stack da seção 1 |
| Mudou build ou deploy | seção 11 |
| Fechou uma das lacunas da seção 12 | remova o item de lá e do roadmap em [OPEN-SOURCE.md](./OPEN-SOURCE.md) |
