import{r as e}from"./utils-DQu4C-Cs.js";import{t}from"./book-open-DOg7LwWX.js";var n=e(`code-xml`,[[`path`,{d:`m18 16 4-4-4-4`,key:`1inbqp`}],[`path`,{d:`m6 8-4 4 4 4`,key:`15zrgr`}],[`path`,{d:`m14.5 4-5 16`,key:`e7oirm`}]]),r=e(`heart-handshake`,[[`path`,{d:`M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762`,key:`17lmqv`}]]),i=[{slug:`tecnica`,to:`/documentacao/tecnica`,label:`Documentação técnica`,shortLabel:`Técnica`,audience:`Desenvolvedores e operadores`,description:`Stack, arquitetura, modelo de dados, permissões, variáveis de ambiente, build e deploy.`,icon:n,content:'# Documentação técnica — SG-CDM\n\nDocumento para quem vai desenvolver, revisar ou operar o sistema. Para a visão de produto, veja o [Guia do Usuário](./GUIA-DO-USUARIO.md); para contribuir, veja [OPEN-SOURCE.md](./OPEN-SOURCE.md).\n\n---\n\n## 1. Visão geral\n\nO SG-CDM é uma aplicação full-stack **TanStack Start** (React + SSR) com **Supabase** (Postgres, Auth, Storage) como backend. Não existe servidor de API separado: a camada de servidor são *server functions* do TanStack Start, e a autorização real mora em políticas RLS no Postgres.\n\nA aplicação é **multi-inquilino por capítulo**: quase toda tabela carrega `chapter_id`, e a associação usuário↔capítulo↔cargo vive em `chapter_members`. Acima disso há um escopo **regional/estadual**, somente leitura, para lideranças (`org_leaderships`).\n\n### Stack\n\n| Camada | Tecnologia | Versão |\n| --- | --- | --- |\n| Framework | TanStack Start | `^1.168.26` |\n| Roteamento | TanStack Router (file-based) | `^1.170.16` |\n| UI | React / React DOM | `^19.2.0` |\n| Build | Vite | `^8.0.16` |\n| Preset de build | `@lovable.dev/vite-tanstack-config` | `^2.7.7` |\n| Servidor | Nitro (preset `cloudflare-module`) | `3.0.260603-beta` |\n| Linguagem | TypeScript (`strict`, ES2022) | `^5.8.3` |\n| Estilo | Tailwind CSS v4 + shadcn/ui (new-york) + Radix | `^4.2.1` |\n| Estado de servidor | TanStack Query | `^5.101.1` |\n| Banco / Auth / Storage | `@supabase/supabase-js` | `^2.110.8` |\n| Validação | Zod | `^3.24.2` |\n| Formulários | react-hook-form + `@hookform/resolvers` | `^7.71.2` |\n| IA | Vercel AI SDK (`ai`) via Lovable AI Gateway | `^7.0.37` |\n| Documentos | jspdf, xlsx, qrcode, html5-qrcode | — |\n| Markdown (docs no app) | react-markdown + remark-gfm | — |\n| Gráficos | recharts | `^2.15.4` |\n| Lint/format | ESLint 9 (flat config) + Prettier | — |\n\nGerenciador de pacotes: **Bun** (`bun.lock`, `bunfig.toml`). Existe um `package-lock.json` como alternativa com npm.\n\n> `bunfig.toml` define `minimumReleaseAge = 86400` — pacotes publicados há menos de 24h são bloqueados, como proteção contra ataques de cadeia de suprimentos. Há uma lista de exceções para `@lovable.dev/*`.\n\n---\n\n## 2. Estrutura de diretórios\n\n```\n.lovable/            metadados do template + plan.md (spec da camada regional, pt-BR)\npublic/              favicon, robots.txt\nsupabase/\n  config.toml        project ref\n  migrations/        26 arquivos .sql — a única fonte de verdade do schema\nsrc/\n  server.ts          handler de fetch do SSR (normaliza erros 500 engolidos pelo h3)\n  start.ts           createStart(): middlewares globais de auth, CSRF e erro\n  router.tsx         cria router + QueryClient (staleTime 60s)\n  routeTree.gen.ts   GERADO — não editar\n  styles.css         tema Tailwind v4 e design tokens\n  routes/            telas (roteamento por arquivo — ver src/routes/README.md)\n  components/\n    ui/              52 primitivos shadcn/ui — não editar à mão\n    shell/           AppShell (sidebar desktop, abas mobile, troca de escopo)\n    docs/            visualizador público de documentação (Markdown)\n    members/ minutes/ settings/   componentes de feature\n    *.tsx            EmptyState, PageHeader, PageSkeleton, QrScanner, ThemeToggle…\n  context/           ActiveChapterContext, OrgScopeContext, ThemeContext\n  hooks/             use-mobile, useCommissionAccess\n  integrations/supabase/\n    client.ts        cliente do browser (chave anônima)\n    client.server.ts cliente service-role — ignora RLS, uso restrito\n    auth-attacher.ts middleware de cliente: anexa o Bearer token\n    auth-middleware.ts middleware de servidor: valida o JWT\n    types.ts         GERADO do schema — não editar\n  lib/\n    *.functions.ts   server functions (camada de serviço)\n    *.server.ts      código exclusivo de servidor\n    *.ts             helpers puros (permissions, nav, format, terms, ics…)\n```\n\n### Arquivos gerados — nunca editar à mão\n\n- `src/routeTree.gen.ts` — regenerado pelo plugin do TanStack Router a cada `dev`/`build`.\n- `src/integrations/supabase/types.ts` — regenerado a partir do schema do Supabase. Depois de criar uma migration, este arquivo precisa ser regerado, senão o TypeScript não conhece a tabela nova.\n\n---\n\n## 3. Arquitetura e fluxo de dados\n\n### Pontos de entrada\n\n| Arquivo | Papel |\n| --- | --- |\n| [src/server.ts](../src/server.ts) | Envolve o `server-entry` do TanStack Start e converte erros 500 engolidos pelo h3 em uma página de erro legível |\n| [src/start.ts](../src/start.ts) | `createStart()` — registra `functionMiddleware: [attachSupabaseAuth]` e `requestMiddleware: [errorMiddleware, csrfMiddleware]` |\n| [src/router.tsx](../src/router.tsx) | Cria o router e o `QueryClient` (`staleTime` 60s, sem refetch ao focar a janela), passado como contexto do router |\n| [src/routes/\\_\\_root.tsx](../src/routes/__root.tsx) | Shell HTML, `<head>`, script inline anti-flash de tema, providers, toaster, boundaries de 404 e erro |\n\n### Camadas\n\n1. **UI** — `src/routes/**` (telas) sobre `src/components/ui/**` (shadcn/ui) e o `AppShell`.\n2. **Estado de cliente** — React Context para o que é transversal à sessão (`ActiveChapterContext`, `OrgScopeContext`, `ThemeContext`). Não há Redux, Zustand ou Jotai.\n3. **Estado de servidor** — TanStack Query para tudo que vem do banco.\n4. **Camada de serviço** — `src/lib/*.functions.ts`. Cada export é um `createServerFn({ method: "POST" })` com `inputValidator` Zod e `.middleware([requireSupabaseAuth])`. São endpoints RPC que rodam no servidor mas se importam e chamam como funções assíncronas comuns.\n5. **Dados** — Supabase Postgres. O `context.supabase` recebido pelo handler é um cliente **vinculado ao JWT de quem chamou**, então toda query continua sujeita a RLS.\n\n### Caminho completo de uma requisição\n\n```\ncomponente\n  └─ useQuery / useMutation           chave ex.: ["cash-entries", chapterId, year, month]\n       └─ serverFn({ data })          src/lib/*.functions.ts\n            └─ attachSupabaseAuth     middleware de cliente — anexa Authorization: Bearer <access_token>\n                 └─ requireSupabaseAuth   middleware de servidor — valida o JWT via getClaims()\n                                          e monta context.supabase + context.userId\n                      └─ inputValidator (Zod)\n                           └─ supabase-js\n                                └─ Postgres + políticas RLS\n  ◀── dados ── cache do Query ── render\nonSuccess da mutation → qc.invalidateQueries([...]) → refetch\n```\n\n### Exceções ao caminho acima\n\n- **Leituras diretas do browser para o Supabase**, sem passar por *server function* — por exemplo o `ActiveChapterContext` consultando `chapter_members`/`profiles`, e todas as chamadas de `supabase.auth`. Nesses casos **a RLS é a única barreira**; não existe validação intermediária.\n- **Escritas sensíveis passam por RPC do Postgres**, não por escrita direta em tabela: `create_member_with_pii`, `update_member_with_pii`, `add_member_guardian`, `reveal_member_pii`.\n\n---\n\n## 4. Convenções de arquivo (importante)\n\nO sufixo do arquivo carrega significado semântico e há lint reforçando isso.\n\n| Sufixo | Significado | Como importar |\n| --- | --- | --- |\n| `*.functions.ts` | *Server functions*. O corpo roda no servidor, mas o módulo é importável do cliente — o bundler substitui pela chamada RPC. | `import { listCashEntries } from "@/lib/finance.functions"` — normal, no topo |\n| `*.server.ts` | Código **exclusivo de servidor**. Nunca pode entrar no bundle do cliente. | `await import("@/lib/cash-validation.server")` — **dinâmico, dentro do handler** |\n\nExemplos reais de `*.server.ts`: [src/lib/cash-validation.server.ts](../src/lib/cash-validation.server.ts), [src/lib/ai-gateway.server.ts](../src/lib/ai-gateway.server.ts), [src/integrations/supabase/client.server.ts](../src/integrations/supabase/client.server.ts).\n\nO [eslint.config.js](../eslint.config.js) proíbe importar o pacote `server-only` (padrão do Next.js) com uma mensagem explicando essa convenção — o TanStack Start usa `*.server.ts` ou `@tanstack/react-start/server-only`.\n\nOutras convenções:\n\n- **Idioma:** strings da UI, segmentos de rota e comentários em português; identificadores de código em inglês. `<html lang="pt-BR">`.\n- **Imports:** alias `@/` → `./src/` (configurado no `tsconfig.json`).\n- **Bibliotecas pesadas são carregadas sob demanda** (`jspdf`, `xlsx`, `qrcode`, `html5-qrcode` todas atrás de `await import()`), para não inflar o bundle inicial.\n- **`src/components/ui/` é território do shadcn/ui** — são primitivos gerados; alterações vão em componentes de feature, não neles.\n\n---\n\n## 5. Camada de serviço\n\nOs 14 arquivos em `src/lib/*.functions.ts`:\n\n| Arquivo | Cobre |\n| --- | --- |\n| `ai.functions.ts` | `improveText`, `composeEventDescription` (via Lovable AI Gateway) |\n| `attendance.functions.ts` | Chamada e registros de presença por evento de calendário |\n| `calendar.functions.ts` | CRUD de `calendar_events`, sessões em andamento |\n| `cash-subcategories.functions.ts` | Configuração de subcategorias de caixa por comissão |\n| `chapter.functions.ts` | Dados, configurações e identidade do capítulo |\n| `commissions.functions.ts` | Comissões e seus membros por termo |\n| `events.functions.ts` | Eventos de arrecadação: ingressos, mesas, assentos, check-ins |\n| `finance.functions.ts` | Fluxo de caixa, categorias, mensalidades, assinantes do relatório |\n| `hospitality.functions.ts` | Cardápios e escala de serviço |\n| `investigations.functions.ts` | Fichas e processos de sindicância |\n| `members.functions.ts` | Membros, responsáveis, PII (`revealMemberPii`), histórico |\n| `minutes.functions.ts` | Atas, modelos e aprovações/assinaturas |\n| `org.functions.ts` | Escopo regional/estadual: panorama, calendário e membros consolidados |\n| `organization.functions.ts` | Administração de estados, regiões e capítulos (GME) |\n\nHelpers puros relevantes em `src/lib/`: `permissions.ts` (matriz de acesso), `nav.ts` (árvores de navegação), `terms.ts` (ano/semestre), `format.ts` (BRL, datas, máscaras de PII), `cash-categories.ts`, `chave-do-dia.ts`, `minute-vars.ts` (interpolação de variáveis em modelos de ata), `ics.ts`, `finance-pdf.ts`, `finance-xlsx.ts`, `minute-pdf.ts`, `chapter-logo.ts` (URLs assinadas do bucket privado), `query-keys.ts`, `error-capture.ts`, `error-page.ts`.\n\n---\n\n## 6. Modelo de dados\n\nSchema definido pelas 26 migrations em [supabase/migrations/](../supabase/migrations/); tipos gerados em [src/integrations/supabase/types.ts](../src/integrations/supabase/types.ts). São 35 tabelas.\n\n### Identidade e multi-inquilino\n`states` → `regions` → `chapters` (nome, número, cidade, `primary_color`, `logo_url`, `settings` JSONB, campos do encarregado LGPD) · `profiles` (1:1 com `auth.users`, guarda `active_chapter_id`; criado pelo trigger `handle_new_user`) · `roles` (catálogo) · **`chapter_members`** (usuário + capítulo + cargo + ativo — é o que concede todo o acesso ao capítulo) · `org_leaderships` (usuário + `org_role` + estado **ou** região + termo) · `audit_logs`.\n\n### Pessoas\n`members` (escopo de capítulo; `status` ativo|inativo|senior|macom; `cpf_encrypted`/`cpf_last2`, `rg_encrypted`/`rg_last2`, endereço JSONB, datas de graus e exames) · `guardians` (até 2 por membro, um principal via índice único parcial) · `lgpd_consents`.\n\n### Governança\n`positions` (25 cargos semeados, de Mestre Conselheiro a Sentinela, mais cargos consultivos) ↔ `member_positions` (membro + cargo + `term_year`/`term_semester`) · `commissions` (9 semeadas: midia, novos_membros, manutencao, eventos, entretenimento, hospitalaria, auditoria, financas, sindicancias) ↔ `commission_members` (+ `commission_role` + termo) · `chapter_lodges`.\n\n### Calendário, presenças e atas\n`calendar_events` (5 tipos, obrigatoriedade, aberto ao público, traje, local, `lodge_id` e `related_event_id` opcionais) · `attendance_records` (único por evento+membro; presente|ausente + justificativa) · `session_minutes` (1:1 com o evento de calendário; rascunho|em_revisao|aprovada) · `minute_approvals` (por papel signatário) · `minute_templates`.\n\n### Finanças\n`cash_entries` (kind, `category` texto, `subcategory` texto — *snapshot*, `calendar_event_id`, valor, data, comprovante) · `cash_categories` (por capítulo, `is_system`, único por capítulo+nome) · `cash_subcategories` (por capítulo, escopo eventos|hospitalaria, `calendar_event_id` opcional, ativo; índice único em capítulo+escopo+coalesce(evento)+lower(nome)) · `member_dues` (único por capítulo+membro+`competence_year`+`competence_month`; status em_aberto|pago|isento; `cash_entry_id` apontando de volta para `cash_entries`).\n\n### Eventos de arrecadação (distintos de `calendar_events`)\n`events` → `ticket_types` → `tickets` (com `qr_code`; valido|cancelado|usado) → `checkins` (qr|nome) · `event_tables` (capacidade, `pos_x`/`pos_y` para o mapa) → `seats`.\n\n### Comissões\n`investigation_files` → `investigation_processes` (aberta|em_andamento|aprovada|reprovada|arquivada) · `hospitality_menus` (opcionalmente ligado a um evento de calendário, com custo estimado) · `hospitality_duties`.\n\n### Convenções do schema\nQuase toda tabela de conteúdo carrega `chapter_id` (a chave de inquilino), `created_by`, `created_at` e `updated_at` — este último mantido pelo trigger `tg_set_updated_at()`.\n\n**Enums** (`types.ts`): `attendance_status`, `calendar_event_type`, `cash_entry_kind`, `checkin_method`, `commission_role`, `due_status`, `event_status`, `investigation_status`, `member_status`, `minute_signer_role`, `minute_status`, `org_role` (`gme`/`mce`/`mcr`/`oe`), `ticket_status`.\n\n---\n\n## 7. Autenticação e autorização\n\n### Fluxo de autenticação\n\n1. `/auth` ([src/routes/auth.tsx](../src/routes/auth.tsx), `ssr: false`) — e-mail e senha via `supabase.auth.signInWithPassword`. Link para a documentação pública em `/documentacao`.\n2. **Rotas públicas de documentação** (fora de `_authenticated`): `/documentacao`, `/documentacao/tecnica`, `/documentacao/guia`, `/documentacao/open-source` — layout próprio em [src/routes/documentacao/](../src/routes/documentacao/), renderizam os Markdowns de `docs/` via `react-markdown` ([src/lib/docs-catalog.ts](../src/lib/docs-catalog.ts), [src/components/docs/](../src/components/docs/)).\n3. `_authenticated/route.tsx` — o `beforeLoad` chama `supabase.auth.getUser()` e redireciona para `/auth` se não houver sessão; monta `ActiveChapterProvider` e `OrgScopeProvider`.\n4. `_authenticated/index.tsx` redireciona `/` → `/inicio`.\n5. `_shell/route.tsx` resolve o escopo de trabalho:\n   - 0 vínculos de capítulo + ≥1 liderança → entra direto no escopo regional\n   - >1 vínculo e nenhum escolhido → `/selecionar-capitulo`\n   - 0 de ambos → mensagem de conta não vinculada\n6. O capítulo ativo é persistido em `localStorage` (`sgcdm.activeChapterId`) **e** espelhado em `profiles.active_chapter_id` para continuidade entre dispositivos. O escopo org fica em `sgcdm.activeOrgScope`.\n7. Toda chamada de *server function* leva `Authorization: Bearer <access_token>` e é verificada no servidor com `supabase.auth.getClaims(token)`. Um middleware de CSRF protege essas requisições.\n8. O logout limpa o `localStorage`, chama `supabase.auth.signOut()` e navega com recarga completa para `/auth`.\n\n### Autorização em duas camadas\n\n**Camada 1 — UI/cliente:** matriz em [src/lib/permissions.ts](../src/lib/permissions.ts), 8 cargos × 6 permissões.\n\n| Cargo (`RoleName`) | Rótulo | Permissões |\n| --- | --- | --- |\n| `admin_total` | Administrador Total | admin, secretaria, tesouraria, comissoes, conselho, visualizar |\n| `mestre_conselheiro` | Mestre Conselheiro | admin, secretaria, tesouraria, comissoes, conselho, visualizar |\n| `consultor` | Consultor | conselho, visualizar |\n| `presidente_conselho` | Presidente do Conselho | conselho, visualizar |\n| `escrivao` | Escrivão | secretaria, comissoes, visualizar |\n| `tesoureiro` | Tesoureiro | tesouraria, visualizar |\n| `presidente_comissao` | Presidente de Comissão | comissoes, visualizar |\n| `membro` | Membro | visualizar |\n\n`can(roleName, perm)` é o predicado usado na UI; `canManageAttendance()` é um atalho para secretaria ∪ conselho ∪ admin. Cargo desconhecido cai em `["visualizar"]`.\n\n**Camada 2 — banco:** RLS em todas as tabelas, apoiada em funções `SECURITY DEFINER`: `is_chapter_member`, `has_role`, `has_any_role`, **`has_permission`** (espelha a matriz TypeScript), `can_read_chapter`, `is_state_leader`, `is_region_leader`, `is_gme`, `can_lead_chapter`, `is_commission_member`, `is_commission_president`, `can_manage_commission`.\n\nAs políticas de leitura foram ampliadas para `can_read_chapter`, de modo que lideranças regionais/estaduais enxerguem os capítulos sob sua jurisdição. As políticas de escrita continuam locais ao capítulo.\n\n> ⚠️ **A matriz existe duplicada: em TypeScript e em SQL.** Alterar `MATRIX` em `permissions.ts` sem alterar `has_permission` na migration correspondente cria divergência silenciosa — a UI esconde o botão mas o banco continua aceitando a escrita (ou o contrário, e o usuário vê um erro sem explicação). **Toda mudança de permissão precisa das duas pontas, no mesmo PR.**\n\n### Visibilidade por comissão\n\nOs setores de Eventos, Sindicâncias e Hospitalaria só aparecem para quem é membro da comissão correspondente (ou admin do capítulo). A regra fica em [src/hooks/useCommissionAccess.ts](../src/hooks/useCommissionAccess.ts) e é aplicada por `visibleGroups()` em [src/lib/nav.ts](../src/lib/nav.ts).\n\n---\n\n## 8. PII e LGPD\n\nO sistema lida com dados pessoais de menores de idade, o que eleva o rigor exigido.\n\n- **CPF e RG são cifrados no Postgres** pelas funções `encrypt_pii`/`decrypt_pii`. As colunas `*_encrypted` guardam o valor cifrado; as colunas `*_last2` guardam apenas os dois últimos dígitos, para exibição.\n- **A leitura em claro só existe pela RPC `reveal_member_pii`**, exposta por `revealMemberPii` em [src/lib/members.functions.ts](../src/lib/members.functions.ts) e restrita a cargos de dentro do capítulo. Não há SELECT direto que devolva o valor.\n- **A UI mascara por padrão** com `formatCpfMask`/`formatRgMask` ([src/lib/format.ts](../src/lib/format.ts)).\n- `lgpd_consents` registra os consentimentos coletados no cadastro; `audit_logs` registra acessos e alterações sensíveis.\n- No escopo regional/estadual, PII **não** é exposta — a busca de membros entre capítulos devolve dados mascarados.\n- **Storage:** bucket privado `chapter-logos`, com políticas exigindo que o primeiro segmento do caminho seja o UUID do capítulo. O acesso é por URL assinada ([src/lib/chapter-logo.ts](../src/lib/chapter-logo.ts)).\n\n---\n\n## 9. Módulo Financeiro\n\nO módulo mais recente e o de acoplamento mais alto — vale ler antes de mexer.\n\nTelas: `/tesouraria/fluxo` ([tesouraria.fluxo.tsx](../src/routes/_authenticated/_shell/tesouraria.fluxo.tsx)) e `/tesouraria/mensalidades`. `/financeiro` é um redirecionamento legado para `/tesouraria/fluxo`.\n\n### Categorias em dois níveis\n\n**Categorias fixas** são semeadas por capítulo pelo trigger `tg_seed_cash_categories` no insert de `chapters` — Eventos, Hospitalaria, Mensalidades, SCDB / GCE, Entretenimento, Outras ([src/lib/cash-categories.ts](../src/lib/cash-categories.ts)). O capítulo pode criar categorias próprias pelo diálogo "Categorias".\n\n**Subcategorias dinâmicas** existem só para as duas categorias que pertencem a comissões: Eventos (escopo `eventos`) e Hospitalaria (escopo `hospitalaria`). Só a comissão dona (ou admin/tesoureiro) define as subcategorias; o tesoureiro então **precisa** escolher uma ao lançar. A validação é server-side em [src/lib/cash-validation.server.ts](../src/lib/cash-validation.server.ts): `resolveSubcategory` confere que a subcategoria pertence ao capítulo, bate com o escopo e está ativa, e grava o **nome como snapshot de texto** em `cash_entries.subcategory` mais o `calendar_event_id` vinculado. Subcategorias de Eventos penduram em um evento de calendário real.\n\n> O snapshot de texto é intencional: renomear ou apagar uma subcategoria não reescreve o histórico contábil já lançado.\n\n### Acoplamento mensalidade ↔ caixa\n\nEsta é a parte que quebra se mexida sem cuidado ([src/lib/finance.functions.ts](../src/lib/finance.functions.ts)):\n\n- `listDues` só devolve membros com status `ativo` — Sênior DeMolay e Maçom são isentos por definição.\n- `generateDues` cria em lote as cobranças `em_aberto` de uma competência (ano+mês), com `ignoreDuplicates`.\n- **`upsertDue` é bidirecional:** marcar como **pago** insere automaticamente uma linha em `cash_entries` na categoria "Mensalidades", com descrição padronizada (`duesDescription`), e guarda o id em `member_dues.cash_entry_id`. Mudar o status para algo diferente de pago **apaga** essa entrada de caixa.\n- `createManualDuesEntry` cobre pagamentos negociados ou de vários meses: cria uma entrada de caixa e rateia o valor igualmente entre até 24 competências, marcando todas como pagas e ligando-as à mesma entrada.\n- A UI invalida as chaves `["dues"]` **e** `["cash-entries"]` dos dois lados, para as duas telas não divergirem.\n\n### Importação, exportação e relatório\n\n- **Import XLSX** com diálogo de conferência: `parseCashSheet` lê `Data | Tipo | Valor | Categoria | Descrição`, converte datas `dd/mm/aaaa` e moeda `R$ 1.234,56`, e marca erro por linha; só as linhas válidas são enviadas. `importCashEntries` limita a 1000 linhas ([src/lib/finance-xlsx.ts](../src/lib/finance-xlsx.ts)).\n- **Export XLSX** e download de modelo em branco (`downloadCashTemplate`).\n- **Relatório PDF** ([src/lib/finance-pdf.ts](../src/lib/finance-pdf.ts), jsPDF): logo do capítulo, rótulo do período, tabela paginada, totais e uma página de assinaturas cujos nomes vêm de `getFinanceSigners` — que resolve PCC, MC, Tesoureiro e Consultor da Tesouraria do termo corrente (ano/semestre, ver [src/lib/terms.ts](../src/lib/terms.ts)).\n\n### Controle de acesso do módulo\n\n- UI: `can(active?.role.name, "tesouraria")` habilita as ações de escrita.\n- Banco: políticas `cash_write` / `dues_write` usam `public.has_permission(chapter_id, \'tesouraria\')` → `admin_total`, `mestre_conselheiro`, `tesoureiro`. As leituras usam `can_read_chapter` / `is_chapter_member`.\n\n---\n\n## 10. Ambiente e configuração\n\n### Variáveis de ambiente\n\n| Variável | Consumidor | Obrigatória | Observação |\n| --- | --- | --- | --- |\n| `VITE_SUPABASE_URL` | [client.ts](../src/integrations/supabase/client.ts) | sim | cliente do browser; embutida no build |\n| `VITE_SUPABASE_PUBLISHABLE_KEY` | [client.ts](../src/integrations/supabase/client.ts) | sim | chave anônima, pública por design |\n| `SUPABASE_URL` | [auth-middleware.ts](../src/integrations/supabase/auth-middleware.ts) | sim | cliente por requisição no SSR |\n| `SUPABASE_PUBLISHABLE_KEY` | [auth-middleware.ts](../src/integrations/supabase/auth-middleware.ts) | sim | idem |\n| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | `.env`, `supabase/config.toml` | sim | referência do projeto |\n| `SUPABASE_SERVICE_ROLE_KEY` | [client.server.ts](../src/integrations/supabase/client.server.ts) | **não está no `.env`** | **ignora RLS** — injetar apenas no ambiente de deploy, jamais no cliente ou no repositório |\n| `LOVABLE_API_KEY` | [ai.functions.ts](../src/lib/ai.functions.ts) | **não está no `.env`** | sem ela, as funções de IA lançam `"IA indisponível: LOVABLE_API_KEY não configurada."` |\n\n> ⚠️ O arquivo `.env` **está versionado no git** e não consta no `.gitignore`. Ele contém apenas a URL e a chave publicável (públicas por design), mas versionar `.env` é uma prática que convida ao vazamento na primeira vez que alguém colocar um segredo real ali. A correção pendente é adicionar `.env` ao `.gitignore` e publicar um `.env.example` — ver [OPEN-SOURCE.md](./OPEN-SOURCE.md#roadmap--onde-ajudar).\n\n### Arquivos de configuração\n\n| Arquivo | Papel |\n| --- | --- |\n| [vite.config.ts](../vite.config.ts) | Invólucro fino sobre `@lovable.dev/vite-tanstack-config`. O preset **já injeta** devtools, tanstackStart, viteReact, tailwind, tsconfigPaths, nitro, injeção de `VITE_*` e o alias `@`. Adicionar esses plugins manualmente quebra a aplicação. |\n| `tsconfig.json` | strict, ES2022, `@/*` → `./src/*`, `noEmit` |\n| `components.json` | configuração do shadcn/ui (estilo new-york, base slate) |\n| [eslint.config.js](../eslint.config.js) | flat config; proíbe `server-only`; Prettier como regra |\n| `.prettierrc` | `printWidth: 100`, aspas duplas, vírgula final |\n| `bunfig.toml` | `minimumReleaseAge` de 24h com exceções para `@lovable.dev/*` |\n| `supabase/config.toml` | referência do projeto Supabase |\n\n---\n\n## 11. Scripts, build e deploy\n\n| Script | Comando | Uso |\n| --- | --- | --- |\n| `dev` | `vite dev` | desenvolvimento local |\n| `build` | `vite build` | build de produção |\n| `build:dev` | `vite build --mode development` | build com sourcemaps/modo dev |\n| `preview` | `vite preview` | serve o build local |\n| `lint` | `eslint .` | lint + Prettier |\n| `format` | `prettier --write .` | formata |\n\n**Build:** gera um bundle Nitro com preset `cloudflare-module` (`nodeCompat: true`) em `.output/`.\n\n**Deploy:** Cloudflare Workers, via `npx wrangler deploy` (e `npx wrangler dev` para preview). Não há `wrangler.toml` versionado — ele é gerado em `.output/server/wrangler.json` durante o build. Lembre de configurar `SUPABASE_SERVICE_ROLE_KEY` e `LOVABLE_API_KEY` como *secrets* do Worker, não em arquivo.\n\n**Banco:** mudanças de schema sempre por migration em `supabase/migrations/`, aplicadas via Supabase CLI ou Lovable Cloud. Depois de aplicar, regenere `src/integrations/supabase/types.ts`.\n\n---\n\n## 12. Estado atual e lacunas conhecidas\n\nRegistrado aqui de propósito, para ninguém descobrir do jeito difícil:\n\n- **Não há testes.** Nenhum framework instalado (sem vitest, jest ou playwright), nenhum arquivo `*.test.*` ou `*.spec.*`.\n- **Não há CI.** Não existe `.github/`, Makefile nem Dockerfile.\n- **Não há script de `typecheck`.** Com `noEmit` no tsconfig e sem script dedicado, erros de tipo só aparecem no editor ou no build.\n- **O lint não passa hoje.** `eslint .` reporta ~2.535 erros em 70 arquivos:\n\n  | Regra | Ocorrências | Natureza |\n  | --- | --- | --- |\n  | `prettier/prettier` | 2.377 | só formatação — o Prettier nunca foi aplicado ao código gerado |\n  | `@typescript-eslint/no-explicit-any` | 149 | tipagem frouxa |\n  | `react-hooks/exhaustive-deps` | 12 | possíveis bugs de dependência de efeito |\n  | `react-refresh/only-export-components` | 12 | atrapalha o hot reload |\n  | `react-hooks/rules-of-hooks` | 9 | **bug real em potencial** — hook chamado condicionalmente |\n\n  Consequência prática: **o lint não funciona como barreira de qualidade**, já que ninguém consegue distinguir o erro novo do ruído de fundo. E rodar `prettier --write .` de uma vez reformataria 70 arquivos — ver o aviso em [OPEN-SOURCE.md](./OPEN-SOURCE.md#padrões-de-código) antes de fazer isso. Os 9 `rules-of-hooks` merecem investigação individual: são os únicos que apontam para defeito de execução, não de estilo.\n- `improveText` em [src/lib/ai.functions.ts](../src/lib/ai.functions.ts) está exportada mas nenhuma tela a chama.\n- `supabaseAdmin` em [src/integrations/supabase/client.server.ts](../src/integrations/supabase/client.server.ts) está definida mas nunca importada — daí `SUPABASE_SERVICE_ROLE_KEY` ainda não ser necessária na prática.\n- **A tela de login exibe credenciais de teste** ([src/routes/auth.tsx](../src/routes/auth.tsx)). Precisa sair antes de qualquer uso real.\n- `.env` versionado (ver seção 10).\n- `package.json.name` ainda é `tanstack_start_ts`, herdado do template.\n- O histórico de commits não serve como documentação: a maioria são commits automáticos com a mensagem "Changes", vindos da sincronização com o editor Lovable.\n\n---\n\n## 13. Manutenção desta documentação\n\n> Toda alteração no projeto deve atualizar a documentação correspondente **no mesmo commit/PR**. Ver a tabela de roteamento em [docs/README.md](./README.md#regra-de-manutenção-da-documentação).\n\nChecklist específico deste documento:\n\n| Se você… | Atualize |\n| --- | --- |\n| Adicionou uma rota | seção 2 (estrutura) e a lista de telas do [Guia do Usuário](./GUIA-DO-USUARIO.md) |\n| Criou um `*.functions.ts` | a tabela da seção 5 |\n| Escreveu uma migration | seção 6 (modelo de dados); regenere `types.ts` |\n| Mudou cargo ou permissão | seção 7 — **nas duas pontas, TS e SQL** — e o Guia do Usuário |\n| Adicionou variável de ambiente | a tabela da seção 10 **e** o bloco `.env.example` em [OPEN-SOURCE.md](./OPEN-SOURCE.md) |\n| Adicionou dependência relevante | a tabela de stack da seção 1 |\n| Mudou build ou deploy | seção 11 |\n| Fechou uma das lacunas da seção 12 | remova o item de lá e do roadmap em [OPEN-SOURCE.md](./OPEN-SOURCE.md) |\n',title:`Documentação técnica — SG-CDM`},{slug:`guia`,to:`/documentacao/guia`,label:`Guia do usuário`,shortLabel:`Guia`,audience:`Membros do capítulo`,description:`O que o sistema faz, tela por tela, em linguagem simples — ideal para apresentar o SG-CDM.`,icon:t,content:`# SG-CDM — Guia do Usuário

*Sistema Gerenciador de Capítulos DeMolay*

Este guia é para quem **usa** o sistema — Mestre Conselheiro, Tesoureiro, Escrivão, Consultor, membros do Conselho e das comissões — e para quem vai **apresentar** o SG-CDM a um capítulo. Não é preciso saber nada de tecnologia para ler.

---

## O que é o SG-CDM

Hoje, a maior parte dos capítulos DeMolay se organiza com o que tem à mão: uma planilha de caixa que só o Tesoureiro sabe abrir, atas em arquivos de texto espalhados, a lista de membros num grupo de WhatsApp, a chamada anotada num caderno. Funciona — até a gestão mudar de mãos. Aí o semestre começa com metade da informação perdida e a outra metade desatualizada.

O SG-CDM reúne tudo isso em um lugar só: **membros, atas, presenças, caixa, mensalidades, calendário e comissões**. Cada pessoa entra com sua conta e vê exatamente o que o cargo dela permite ver — o Tesoureiro mexe no caixa, o Escrivão nas atas, e o histórico do capítulo continua no lugar quando a gestão passa adiante.

O sistema funciona pelo navegador, no computador e no celular. Não é preciso instalar nada.

---

## Para quem é

**Para o capítulo** — a gestão do dia a dia: cadastrar membros, lançar o caixa, escrever a ata da sessão, fazer a chamada, organizar um evento.

**Para a regional e o estadual** — uma visão consolidada dos capítulos sob sua jurisdição: quantos membros ativos cada um tem, qual a próxima atividade, um calendário unificado. É uma visão **somente de consulta** — quem acompanha não altera dados do capítulo.

---

## Como funciona o acesso

Três ideias explicam todo o controle de acesso do sistema:

**Capítulo.** Toda informação pertence a um capítulo. Você só enxerga os dados dos capítulos aos quais está vinculado.

**Cargo.** Dentro do capítulo, seu cargo define o que você pode fazer. Um Tesoureiro não edita atas; um Escrivão não lança pagamentos.

**Escopo.** Se você pertence a mais de um capítulo, ou também tem um cargo regional/estadual, o sistema pergunta em qual "escopo" você quer trabalhar. Todo o menu muda de acordo com a escolha — e dá para trocar a qualquer momento.

### O que cada cargo pode fazer

| Cargo | O que consegue fazer |
| --- | --- |
| **Administrador Total** | Tudo: membros, atas, caixa, comissões, configurações do capítulo |
| **Mestre Conselheiro** | Tudo, igual ao Administrador Total |
| **Presidente do Conselho** | Acompanha tudo do Conselho e consulta o restante |
| **Consultor** | Acompanha tudo do Conselho e consulta o restante |
| **Escrivão** | Membros, atas, presenças e as comissões; consulta o restante |
| **Tesoureiro** | Caixa e mensalidades; consulta o restante |
| **Presidente de Comissão** | A área da sua comissão; consulta o restante |
| **Membro** | Consulta as informações do capítulo |

Além do cargo, as áreas das comissões (Eventos, Sindicâncias e Hospitalaria) só aparecem no menu de quem faz parte daquela comissão — ou de quem administra o capítulo.

---

## Passeando pelo sistema

### Início

O painel de abertura. Mostra, de relance:

- se há uma **sessão acontecendo agora** (com atalho direto para a chamada)
- o **próximo compromisso** do calendário
- o **saldo do mês** no caixa
- quantos **membros ativos** o capítulo tem
- os **aniversariantes**
- a **chave do dia** pronta para copiar e colar no grupo do capítulo

### Secretaria

**Membros.** O cadastro completo do capítulo. O formulário é um passo a passo — se o candidato for menor de idade, ele ganha uma etapa a mais para os dados dos responsáveis (até dois, com um definido como principal) e a coleta do consentimento de dados. Cada membro tem sua ficha com histórico de cargos, presenças e graus.

**Atas.** As atas seguem um fluxo em três estágios: **rascunho → em revisão → aprovada**. A ata aprovada leva três assinaturas — Presidente do Conselho, Mestre Conselheiro e Escrivão. Há modelos editáveis por capítulo, com campos que se preenchem sozinhos (data, número da sessão, nomes), e exportação em PDF.

**Presenças.** O histórico de chamada e a frequência de cada membro ao longo do tempo.

**Chamada ao vivo.** Quando a sessão está acontecendo, o sistema abre uma tela de chamada: marca-se presente ou ausente (com justificativa), e a ata pode ser escrita ali mesmo, durante a sessão.

### Tesouraria

**Fluxo de Caixa.** O livro-caixa do capítulo: entradas e saídas com data, categoria, valor e descrição. Dá para ver um mês específico ou o período inteiro, e o saldo em conta aparece separado do resultado do período.

As categorias já vêm prontas — Eventos, Hospitalaria, Mensalidades, SCDB / GCE, Entretenimento e Outras — e o capítulo pode criar as suas. As categorias de Eventos e Hospitalaria têm um detalhe útil: **a própria comissão define as subcategorias** (por exemplo, cada evento vira uma subcategoria), e o Tesoureiro escolhe uma na hora de lançar. Assim dá para saber quanto entrou e saiu de cada evento, sem o Tesoureiro precisar adivinhar.

Também é possível **importar uma planilha** de lançamentos (com uma tela de conferência antes de gravar, que aponta linha por linha o que está errado), **exportar em planilha** e gerar o **relatório em PDF** — com o logo do capítulo, os totais do período e uma página de assinaturas já com os nomes dos oficiais do semestre.

**Mensalidades.** As cobranças por mês e por membro. O sistema gera as cobranças do mês de uma vez e acompanha quem está em aberto, pago ou isento. Sênior DeMolay e Maçom já saem isentos automaticamente.

O ponto mais prático: **mensalidade paga vira lançamento no caixa sozinha.** Ao marcar como paga, a entrada aparece no fluxo de caixa na categoria Mensalidades; se o status for desfeito, o lançamento sai junto. Não há risco de contar o dinheiro duas vezes nem de esquecer de lançar. Para pagamentos negociados ou de vários meses de uma vez, há um lançamento manual que divide o valor entre as competências escolhidas.

### Gestão

**Calendário.** Todos os compromissos do capítulo, em cinco tipos: sessão ritualística, sessão administrativa, evento, filantropia e entretenimento. Cada compromisso pode indicar obrigatoriedade, se é aberto ao público, traje e local. Dá para baixar o compromisso para o calendário do celular ou abrir direto no Google Agenda ou no Outlook, e gerar o texto da chave do dia. Há ainda um assistente que ajuda a escrever a descrição do evento.

**Cargos e Comissões.** Quem ocupa qual cargo e quem compõe cada comissão, organizados por semestre. O histórico de semestres anteriores fica preservado.

**Configurações.** A identidade do capítulo: logo, cor de destaque (que passa a colorir o sistema inteiro para aquele capítulo), nome, número, cidade, lojas vinculadas e o modelo de texto da chave do dia.

### Comissão de Eventos

Para os eventos de arrecadação. Cria-se o evento, definem-se os **tipos de ingresso** com preço e quantidade, e a venda é registrada no sistema. Cada ingresso ganha um **QR Code**. Há um **mapa de mesas e lugares** para organizar quem senta onde, e o **check-in na portaria é feito pela câmera do celular**, lendo o QR Code — ou pelo nome, se a pessoa esqueceu o ingresso.

### Comissão de Sindicâncias

**Fichas** dos candidatos e **processos** de sindicância, com acompanhamento do andamento (aberta, em andamento, aprovada, reprovada ou arquivada) e registro dos pareceres.

### Hospitalaria

**Cardápios** das sessões e eventos, com custo estimado — o que ajuda o Tesoureiro a se planejar. E a **escala de serviço**, para organizar quem fica responsável por cada ocasião.

### Regional e Estadual

Para quem tem cargo acima do capítulo:

- **Panorama** — todos os capítulos da jurisdição, com número de membros ativos e a próxima atividade de cada um
- **Calendário** — todos os compromissos de todos os capítulos em uma agenda só
- **Membros** — busca de membros entre capítulos (com os documentos protegidos)
- **Instituições e Regiões** — cadastro e edição de capítulos e regiões, exclusivo do Grão-Mestre Estadual

### Documentação

Sem precisar de permissão especial: em **Mais → Documentação**, ou pela URL \`/documentacao\` (também acessível sem login). Há três guias — técnico, do usuário e de contribuição open source.

---

## Cuidado com os dados pessoais

O sistema guarda dados de adolescentes, então esse ponto foi tratado com rigor:

- **CPF e RG ficam guardados de forma cifrada.** Mesmo quem tem acesso direto ao banco de dados não os lê.
- **Na tela, os documentos aparecem mascarados** — só os dois últimos dígitos.
- **Ver o documento completo é uma ação deliberada e registrada.** Não é algo que se vê por acidente ao abrir uma ficha.
- **O consentimento é coletado no cadastro** e fica registrado.
- **Quem acompanha pela regional ou estadual não vê documentos** — a visão consolidada é sempre com os dados protegidos.

---

## Perguntas frequentes

**Funciona no celular?**
Sim. No celular o menu vira uma barra de abas na parte de baixo da tela, com atalhos para Início, Membros, Caixa, Eventos e um botão "Mais" com o restante — inclusive o atalho para a **Documentação** (\`/documentacao\`), que também pode ser aberta sem login.

**Preciso instalar alguma coisa?**
Não. É pelo navegador, no computador ou no celular.

**E se eu pertenço a dois capítulos?**
Ao entrar, o sistema pergunta em qual capítulo você quer trabalhar. A escolha fica guardada, e há um seletor no topo para trocar quando quiser — inclusive de outro dispositivo.

**Errei um lançamento no caixa. E agora?**
Quem tem permissão de Tesouraria pode editar ou excluir o lançamento. Se ele veio de uma mensalidade paga, basta desfazer o pagamento que o lançamento sai junto.

**Perdi o acesso / esqueci a senha.**
Fale com o Administrador Total ou o Mestre Conselheiro do seu capítulo — o vínculo da sua conta com o capítulo é administrado por eles.

**Meu menu não tem a área da comissão que eu presido.**
As áreas de comissão só aparecem para quem está registrado como membro daquela comissão no semestre corrente. Peça para o Administrador incluir você em **Gestão → Cargos e Comissões**.

**O sistema tem tema escuro?**
Tem, com alternância no próprio sistema.

---

## Glossário

| Termo | O que significa aqui |
| --- | --- |
| **Capítulo** | A unidade do sistema. Toda informação pertence a um capítulo |
| **Escopo** | Em qual "contexto" você está trabalhando: um capítulo específico, ou a visão regional/estadual |
| **Cargo** | Sua função no capítulo, que define o que você pode fazer no sistema |
| **Termo / semestre** | O período de uma gestão. Cargos e comissões são organizados por termo |
| **Competência** | O mês a que uma mensalidade se refere (ex.: "Março/2026") |
| **Chave do dia** | O texto padrão de convocação da sessão, gerado a partir do modelo do capítulo |
| **Ata** | O registro oficial da sessão, que passa por revisão e recebe três assinaturas |
| **Sindicância** | O processo de investigação e parecer sobre um candidato |
| **Hospitalaria** | A comissão responsável pela alimentação e recepção nas atividades |
| **Sênior DeMolay** | Membro que já passou da idade ativa — isento de mensalidade no sistema |

---

## Manutenção deste guia

> **Mudou uma tela, um campo ou um fluxo que o usuário enxerga? Este guia é atualizado no mesmo momento da mudança.**

Esta é a documentação que as pessoas do capítulo leem antes de pedir ajuda, e que serve de roteiro para apresentar o sistema. Se ela descreve uma tela que não existe mais, ou deixa de fora um recurso novo, ela para de ser confiável e todo mundo volta a perguntar.

Quem faz a mudança atualiza o guia. Ver a regra completa e as demais documentações em [docs/README.md](./README.md).
`,title:`Guia do Usuário — SG-CDM`},{slug:`open-source`,to:`/documentacao/open-source`,label:`Open source e contribuição`,shortLabel:`Contribuir`,audience:`Quem quer contribuir`,description:`Setup local, tutorial passo a passo de fork e pull request, padrões de código e segurança.`,icon:r,content:`# SG-CDM — Projeto aberto e guia de contribuição

Este documento é para quem quer **contribuir com o código** do SG-CDM. Para entender a arquitetura em profundidade, veja [TECNICO.md](./TECNICO.md); para entender o produto, veja o [Guia do Usuário](./GUIA-DO-USUARIO.md). No app, este guia também está em \`/documentacao/open-source\`.

---

## Sobre o projeto

O **SG-CDM (Sistema Gerenciador de Capítulos DeMolay)** é um sistema de gestão para capítulos da Ordem DeMolay: membros, atas, presenças, tesouraria, calendário e comissões, com controle de acesso por cargo e acompanhamento regional/estadual.

**Por que abrir o código:**

- **Capítulos não têm orçamento de software.** Um sistema pago, por mais barato, exclui exatamente os capítulos que mais precisam de organização.
- **O sistema guarda dados pessoais de adolescentes.** Código aberto significa que qualquer pessoa pode auditar como o consentimento é coletado, como os documentos são protegidos e o que é registrado — em vez de confiar na palavra de quem construiu.
- **Cada capítulo tem suas particularidades.** Um capítulo que precisa de um relatório específico consegue fazer, em vez de esperar em uma fila de pedidos.

---

## Status do projeto

Sendo direto, para você saber no que está entrando:

- **Em desenvolvimento ativo.** Ainda não há release versionada nem instância pública de referência.
- **Sem testes automatizados e sem CI.** E o ESLint, que seria a barreira restante, hoje acusa ~2.535 erros pré-existentes — na prática, a única verificação efetiva é o TypeScript em modo \`strict\` durante o build.
- **Boa parte do código foi gerada e é sincronizada via [Lovable](https://lovable.dev).** Isso impõe uma restrição real ao histórico do git — veja [Restrição crítica de histórico](#restrição-crítica-de-histórico-git).
- O histórico de commits **não** serve como documentação: a maioria são commits automáticos com a mensagem "Changes".

Nada disso impede contribuição — mas explica por que a seção de [roadmap](#roadmap--onde-ajudar) começa por testes e CI.

---

## Licença

Este repositório está sob a **[GNU Affero General Public License v3.0 (AGPL-3.0)](../LICENSE)**.

A AGPL é um *copyleft* forte: você pode usar, modificar e redistribuir o código; se hospedar uma versão modificada como serviço na rede, precisa oferecer o código-fonte dessa versão sob a mesma licença. O objetivo é garantir que melhorias voltem para a comunidade — coerente com um sistema de gestão oferecido pela web.

Contribuições são aceitas sob os mesmos termos. O campo \`license\` no \`package.json\` e o arquivo \`LICENSE\` na raiz são a referência formal.

---

## Começando (setup local)

### Pré-requisitos

- **Git** instalado na máquina
- **Bun** (recomendado) ou **Node.js 20+**
- Um projeto **Supabase** (o schema é reproduzível pelas migrations do repositório)
- Conta no **GitHub**

### Modelo de \`.env\`

Ainda não há um arquivo \`.env.example\` versionado (é um dos itens do roadmap). Use este bloco como modelo:

\`\`\`bash
# ---- Supabase: obrigatórias ----
# Encontráveis no painel do Supabase em Settings → API
SUPABASE_PROJECT_ID=seu-project-ref
SUPABASE_URL=https://seu-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua-chave-anonima

# Os mesmos valores, prefixados — usados pelo cliente do navegador
VITE_SUPABASE_PROJECT_ID=seu-project-ref
VITE_SUPABASE_URL=https://seu-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anonima

# ---- Somente servidor: NUNCA versionar ----
# Ignora todas as políticas de segurança do banco. Só no ambiente de deploy.
# SUPABASE_SERVICE_ROLE_KEY=

# Sem esta chave, os recursos de IA lançam "IA indisponível".
# O restante do sistema funciona normalmente.
# LOVABLE_API_KEY=
\`\`\`

A chave publicável (anônima) é pública por design — ela é embutida no bundle do navegador e a proteção real vem das políticas RLS do Postgres. Já \`SUPABASE_SERVICE_ROLE_KEY\` **ignora todas essas políticas**: ela nunca vai para o cliente, nunca para o repositório, só para os *secrets* do ambiente de deploy.

### Banco de dados

O schema vive em \`supabase/migrations/\` (26 arquivos \`.sql\`). Aplique-os no seu projeto Supabase com a CLI do Supabase. Depois de qualquer migration nova, regenere os tipos em \`src/integrations/supabase/types.ts\`.

---

## Tutorial: sua primeira contribuição

Este passo a passo segue o fluxo clássico *fork → clone → branch → commit → pull request*, no espírito do projeto [First Contributions](https://github.com/firstcontributions/first-contributions). Se você nunca abriu um PR, comece por aqui.

Repositório: [https://github.com/farrapos1111/sgc-dm](https://github.com/farrapos1111/sgc-dm)

### 1. Fork do repositório

No GitHub, abra [farrapos1111/sgc-dm](https://github.com/farrapos1111/sgc-dm) e clique em **Fork**. Isso cria uma cópia do projeto na sua conta.

### 2. Clone o seu fork

No seu fork, clique em **Code**, copie a URL (HTTPS ou SSH) e clone:

\`\`\`bash
git clone https://github.com/SEU-USUARIO/sgc-dm.git
cd sgc-dm
\`\`\`

Substitua \`SEU-USUARIO\` pelo seu usuário do GitHub.

Instale as dependências e suba o ambiente (opcional se a mudança for só documentação):

\`\`\`bash
bun install          # ou: npm install
# crie o .env — ver o modelo acima
bun run dev          # http://localhost:3000
\`\`\`

### 3. Crie um branch

A partir de \`main\`:

\`\`\`bash
git switch -c feat/nome-curto
\`\`\`

Prefixos aceitos:

| Prefixo | Quando usar |
| --- | --- |
| \`feat/\` | nova funcionalidade |
| \`fix/\` | correção de bug |
| \`docs/\` | só documentação |

Exemplo: \`git switch -c docs/corrigir-typo-guia\`

Se \`git switch\` não existir na sua versão do Git:

\`\`\`bash
git checkout -b feat/nome-curto
\`\`\`

### 4. Faça a alteração

Mantenha o escopo enxuto: **um PR, um assunto**.

Em mudanças grandes, **abra uma issue antes** — evita duas pessoas resolvendo o mesmo problema de formas incompatíveis.

**Atualize a documentação no mesmo PR** — ver [Regra de documentação](#regra-de-documentação).

### 5. Adicione e faça o commit

\`\`\`bash
git status
git add caminho/do/arquivo-alterado.tsx
git commit -m "Descreva o porquê da mudança em uma frase"
\`\`\`

Exemplo:

\`\`\`bash
git add docs/GUIA-DO-USUARIO.md
git commit -m "Corrige descrição da tela Mais no guia do usuário"
\`\`\`

### 6. Envie o branch para o seu fork

\`\`\`bash
git push -u origin feat/nome-curto
\`\`\`

Use o mesmo nome do branch que você criou.

### 7. Abra o Pull Request

No GitHub, no **seu** fork, aparece o botão **Compare & pull request**. Clique, preencha:

- **o que** mudou
- **por que**
- **como testar**

Se mexeu na interface, inclua capturas de tela (antes e depois). Envie o PR para o repositório original \`farrapos1111/sgc-dm\`.

### Antes de marcar o PR como pronto

Rode as verificações **só nos arquivos que você tocou**:

\`\`\`bash
npx eslint <apenas-os-arquivos-que-você-tocou>
npx prettier --write <apenas-os-arquivos-que-você-tocou>
bun run build      # confirma que o build passa e o TypeScript está limpo
\`\`\`

> **Não rode \`bun run lint\` ou \`bun run format\` no repositório inteiro.** O código atual acumula ~2.535 erros de ESLint em 70 arquivos, sendo 2.377 apenas de formatação. Um \`prettier --write .\` reformataria 70 arquivos de uma vez, escondendo a sua mudança real e conflitando com a sincronização do Lovable. **Limite-se aos arquivos que você editou.** Detalhe em [TECNICO.md](./TECNICO.md#12-estado-atual-e-lacunas-conhecidas).

### Restrição crítica de histórico git

> **Não reescreva histórico já publicado.** Nada de \`push --force\`, \`rebase\`, \`commit --amend\` ou \`squash\` sobre commits que já estão no remoto.

Este repositório é sincronizado com o editor Lovable: os commits enviados ao branch conectado voltam para lá e aparecem no editor. Reescrever histórico publicado quebra essa sincronia e pode **fazer o mantenedor perder o histórico do projeto** no lado do Lovable. A restrição está registrada em [AGENTS.md](../AGENTS.md) na raiz.

Corolário: mantenha o branch conectado sempre em estado funcional. Um commit quebrado no \`main\` quebra também o editor.

---

## Organização do repositório

\`\`\`
docs/                  esta documentação
supabase/migrations/   schema do banco — fonte única de verdade
src/
  routes/              telas (roteamento por arquivo)
  lib/
    *.functions.ts     camada de serviço (server functions)
    *.server.ts        código exclusivo de servidor
    *.ts               helpers puros
  components/ui/       primitivos shadcn/ui — não editar
  components/          componentes de feature
  context/ hooks/      estado transversal
  integrations/supabase/   clientes e tipos gerados
\`\`\`

Detalhamento completo de camadas, fluxo de dados e modelo de dados em [TECNICO.md](./TECNICO.md).

---

## Padrões de código

**Idioma.** Textos da interface, segmentos de rota e comentários em **português**; identificadores de código (variáveis, funções, tipos) em **inglês**. É uma inconsistência aparente, mas intencional e consistente em todo o projeto.

**Formatação.** Prettier, aplicado como regra do ESLint: 100 colunas, aspas duplas, vírgula final. Formate **apenas os arquivos que você tocou** (\`npx prettier --write caminho/do/arquivo.tsx\`) — o repositório inteiro está fora de formatação e um \`--write .\` geral produz um diff que inviabiliza a revisão. Não discuta estilo em revisão de PR: o Prettier decide.

**Imports.** Use o alias \`@/\` para \`src/\`. Nada de \`../../../\`.

**Validação.** Toda *server function* valida a entrada com Zod, e as mensagens de erro são em português, porque chegam direto ao usuário via toast.

**\`src/components/ui/\` não se edita.** São primitivos do shadcn/ui. Precisa de comportamento diferente? Componha por cima, em um componente de feature.

**Sufixos de arquivo têm significado:**
- \`*.functions.ts\` — *server functions*, importáveis normalmente do cliente
- \`*.server.ts\` — exclusivo de servidor, importado **dinamicamente** (\`await import()\`) de dentro do handler

O ESLint bloqueia o pacote \`server-only\` do Next.js com uma mensagem explicando essa convenção.

**Arquivos gerados — nunca editar à mão:** \`src/routeTree.gen.ts\` e \`src/integrations/supabase/types.ts\`.

**Bibliotecas pesadas entram sob demanda** (\`await import()\`), como já é feito com \`jspdf\`, \`xlsx\`, \`qrcode\` e \`html5-qrcode\`.

**Nunca commite segredo.** Chave, token ou senha real não entra no repositório, nem em comentário, nem em arquivo de teste.

---

## Mudanças no banco de dados

1. **Sempre por migration** em \`supabase/migrations/\`. Nunca altere o schema pelo painel do Supabase — a mudança não chega em quem clonou o projeto.
2. **Toda tabela nova precisa de RLS.** Uma tabela sem política é uma tabela aberta. Use os helpers já existentes: \`is_chapter_member\`, \`has_permission\`, \`can_read_chapter\`, \`is_commission_member\`.
3. **Toda tabela de conteúdo carrega \`chapter_id\`** — é a chave de isolamento entre capítulos.
4. **Mudou permissão? Mude nos dois lados.** A matriz de cargos existe duplicada: em TypeScript ([src/lib/permissions.ts](../src/lib/permissions.ts)) e em SQL (função \`has_permission\`). Alterar só uma cria divergência silenciosa: a interface esconde o botão mas o banco aceita a escrita, ou o contrário. **As duas pontas, no mesmo PR.**
5. **Regenere \`types.ts\`** depois de aplicar a migration.

---

## Segurança

O projeto lida com dados pessoais de menores de idade. Leve a sério.

**Reportar vulnerabilidade:** não abra issue pública. Entre em contato em privado com o mantenedor do repositório e dê tempo para a correção antes de qualquer divulgação. (Ainda não há \`SECURITY.md\` nem endereço dedicado — está no roadmap.)

**Ao contribuir, atenção especial a:**

- \`SUPABASE_SERVICE_ROLE_KEY\` ignora toda a RLS. Nunca no cliente, nunca no repositório, nunca em log.
- CPF e RG são cifrados no banco e só se revelam pela RPC \`reveal_member_pii\`. Não crie caminho novo que devolva PII em claro.
- O escopo regional/estadual é **somente leitura** e **sem PII**. Não amplie isso sem discussão.
- Toda tabela nova precisa de RLS antes do merge.
- Nunca registre PII em log ou telemetria de erro.

---

## Código de conduta

O SG-CDM atende uma organização juvenil, e o padrão de convivência acompanha isso:

- **Respeito, sempre.** Critique a ideia, o código, a decisão — nunca a pessoa.
- **Zero tolerância a assédio**, de qualquer forma, em qualquer espaço do projeto.
- **Paciência com quem está começando.** Muita gente que vai contribuir aqui é jovem e está no primeiro projeto. Uma revisão de PR mal-educada custa um contribuidor.
- **Sem conteúdo impróprio** em código, comentário, issue ou PR.

Um \`CODE_OF_CONDUCT.md\` formal (provavelmente baseado no Contributor Covenant) ainda será adotado. Até lá, valem os pontos acima. Comportamento fora desse padrão pode resultar em bloqueio de participação.

---

## Roadmap — onde ajudar

As lacunas conhecidas do projeto, que são também as melhores primeiras contribuições:

| Prioridade | Item | Por quê |
| --- | --- | --- |
| 🔴 Alta | Remover as credenciais de teste da tela de login ([src/routes/auth.tsx](../src/routes/auth.tsx)) | Bloqueia qualquer uso real |
| 🔴 Alta | Adicionar \`.env\` ao \`.gitignore\` e versionar um \`.env.example\` | Hoje o \`.env\` está no repositório; é questão de tempo até alguém colocar um segredo ali |
| 🟠 Média | Investigar os 9 erros de \`react-hooks/rules-of-hooks\` | São os únicos erros de lint que apontam bug de execução, não estilo |
| 🟠 Média | Testes automatizados (Vitest para os helpers, Playwright para os fluxos) | Não existe nenhum; comece por \`permissions.ts\`, \`format.ts\`, \`terms.ts\`, \`finance-xlsx.ts\` |
| 🟠 Média | Zerar a dívida de formatação (\`prettier --write .\` em um PR isolado, sem nenhuma outra mudança) | Enquanto houver 2.377 erros de estilo, o lint não serve de barreira. Precisa ser um PR só disso, combinado antes com o mantenedor |
| 🟠 Média | CI no GitHub Actions rodando lint + build | Nenhuma verificação automática hoje — só faz sentido depois de zerar a dívida acima |
| 🟠 Média | Script de \`typecheck\` no \`package.json\` | Erros de tipo só aparecem no editor ou no build |
| 🟡 Baixa | Revisão de acessibilidade (navegação por teclado, leitores de tela, contraste) | Nunca foi auditada |
| 🟡 Baixa | Corrigir \`package.json.name\` (ainda \`tanstack_start_ts\`) | Herança do template |
| 🟡 Baixa | \`CODE_OF_CONDUCT.md\` e \`SECURITY.md\` formais | Hoje só existem em resumo, aqui |
| 🟡 Baixa | Decidir o destino de \`improveText\` e de \`supabaseAdmin\` | Ambos existem no código e não são usados por ninguém |

Quer ajudar mas não sabe por onde começar? Abra uma issue perguntando — é uma contribuição legítima.

---

## Regra de documentação

> **PR que muda comportamento e não atualiza a documentação correspondente não é mergeado.**

Não é burocracia. Documentação adiada é documentação nunca escrita, e documentação errada é pior do que documentação nenhuma — as pessoas confiam nela e tomam decisões erradas. O custo de atualizar um parágrafo no PR em que a mudança está fresca é minúsculo perto do custo de descobrir seis meses depois que a doc mente.

| Tipo de mudança | Atualizar |
| --- | --- |
| Nova rota, nova *server function*, nova tabela/migration, nova variável de ambiente, nova dependência | [TECNICO.md](./TECNICO.md) |
| Nova tela, novo campo, ou qualquer fluxo visível para quem usa o sistema | [GUIA-DO-USUARIO.md](./GUIA-DO-USUARIO.md) |
| Mudança em setup, scripts, convenções ou processo de PR | **este documento** |
| Mudança em cargo, permissão ou regra de acesso | **os três** |
| Mudança apenas de estilo, refatoração sem efeito visível | nenhum |

Antes de marcar o PR como pronto:

- [ ] O comportamento mudou para quem usa? → Guia do Usuário
- [ ] Quem for mexer nesse código precisa saber de algo novo? → Documentação técnica
- [ ] Mudou como se roda, testa ou contribui? → este documento
- [ ] Adicionei variável de ambiente? → tabela em \`TECNICO.md\` **e** o bloco \`.env.example\` acima
- [ ] Fechei um item do roadmap? → remova-o daqui e da seção de lacunas em \`TECNICO.md\`
- [ ] Os caminhos de arquivo que citei realmente existem?
`,title:`Projeto aberto e contribuição — SG-CDM`}];function a(e){let t=i.find(t=>t.slug===e);if(!t)throw Error(`Categoria de documentação desconhecida: ${e}`);return t}function o(e){if(!e||e.startsWith(`http://`)||e.startsWith(`https://`)||e.startsWith(`#`)||e.startsWith(`mailto:`))return e;let t={"./TECNICO.md":`/documentacao/tecnica`,"TECNICO.md":`/documentacao/tecnica`,"./GUIA-DO-USUARIO.md":`/documentacao/guia`,"GUIA-DO-USUARIO.md":`/documentacao/guia`,"./OPEN-SOURCE.md":`/documentacao/open-source`,"OPEN-SOURCE.md":`/documentacao/open-source`,"./README.md":`/documentacao`,"README.md":`/documentacao`},[n,r=``]=e.split(`#`),i=t[n];return i?r?`${i}#${r}`:i:n.startsWith(`../`)||n.startsWith(`./`)?`https://github.com/farrapos1111/sgc-dm/blob/main/${n.replace(/^\.\.\//,``).replace(/^\.\//,``)}${r?`#${r}`:``}`:e}function s(e){return e.toLowerCase().replace(/[—–]/g,``).replace(/[^\p{L}\p{N}\s-]/gu,``).trim().replace(/\s+/g,`-`)}function c(e){let t=[],n=new Map;for(let r of e.split(`
`)){let e=/^(#{2,3})\s+(.+)$/.exec(r);if(!e)continue;let i=e[1].length,a=e[2].replace(/[*_`#\[\]]/g,``).trim(),o=s(a),c=n.get(o)??0;n.set(o,c+1),c>0&&(o=`${o}-${c}`),t.push({id:o,text:a,level:i})}return t}export{s as a,o as i,c as n,a as r,i as t};