# Templo Virtual — Projeto aberto e guia de contribuição

Este documento é para quem quer **contribuir com o código** do Templo Virtual. Para entender a arquitetura em profundidade, veja [TECNICO.md](./TECNICO.md); para entender o produto, veja o [Guia do Usuário](./GUIA-DO-USUARIO.md). No app, este guia também está em `/documentacao/open-source`.

---

## Sobre o projeto

O **Templo Virtual** é o hub de gerenciamento das ordens paramaçônicas: membros, atas, presenças, tesouraria, calendário e comissões, com controle de acesso por cargo e acompanhamento regional/estadual. O repositório permanece `sgc-dm` (nome histórico: SG-CDM).

**Por que abrir o código:**

- **Capítulos não têm orçamento de software.** Um sistema pago, por mais barato, exclui exatamente os capítulos que mais precisam de organização.
- **O sistema guarda dados pessoais de adolescentes.** Código aberto significa que qualquer pessoa pode auditar como o consentimento é coletado, como os documentos são protegidos e o que é registrado — em vez de confiar na palavra de quem construiu.
- **Cada capítulo tem suas particularidades.** Um capítulo que precisa de um relatório específico consegue fazer, em vez de esperar em uma fila de pedidos.

---

## Status do projeto

Sendo direto, para você saber no que está entrando:

- **Em desenvolvimento ativo.** Ainda não há release versionada nem instância pública de referência.
- **Sem testes automatizados e sem CI.** E o ESLint, que seria a barreira restante, hoje acusa ~2.535 erros pré-existentes — na prática, a única verificação efetiva é o TypeScript em modo `strict` durante o build.
- **Boa parte do código foi gerada e é sincronizada via [Lovable](https://lovable.dev).** Isso impõe uma restrição real ao histórico do git — veja [Restrição crítica de histórico](#restrição-crítica-de-histórico-git).
- O histórico de commits **não** serve como documentação: a maioria são commits automáticos com a mensagem "Changes".

Nada disso impede contribuição — mas explica por que a seção de [roadmap](#roadmap--onde-ajudar) começa por testes e CI.

---

## Licença

Este repositório está sob a **[GNU Affero General Public License v3.0 (AGPL-3.0)](../LICENSE)**.

A AGPL é um _copyleft_ forte: você pode usar, modificar e redistribuir o código; se hospedar uma versão modificada como serviço na rede, precisa oferecer o código-fonte dessa versão sob a mesma licença. O objetivo é garantir que melhorias voltem para a comunidade — coerente com um sistema de gestão oferecido pela web.

Contribuições são aceitas sob os mesmos termos. O campo `license` no `package.json` e o arquivo `LICENSE` na raiz são a referência formal.

---

## Começando (setup local)

### Pré-requisitos

- **Git** instalado na máquina
- **Bun** (recomendado) ou **Node.js 20+**
- Um projeto **Supabase** (o schema é reproduzível pelas migrations do repositório)
- Conta no **GitHub**

### Modelo de `.env`

Há um [`.env.example`](../.env.example) na raiz. Copie para o mode que for usar (ex.: `.env.odm` com `bun run dev:odm`) e preencha:

```bash
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

# ---- E-mail transacional (Resend) — server-only ----
# RESEND_API_KEY=re_xxxxxxxx
# EMAIL_FROM="Templo Virtual <noreply@seudominio.com.br>"
```

A chave publicável (anônima) é pública por design — ela é embutida no bundle do navegador e a proteção real vem das políticas RLS do Postgres. Já `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` **nunca** vão para o cliente nem para o repositório — só nos `.env` locais (gitignored) e nos _secrets_ do deploy.

**Resend (manual):** em [resend.com/domains](https://resend.com/domains) adicione o domínio, copie SPF/DKIM (e DMARC se pedido) para o DNS, aguarde **Verified**, depois preencha `RESEND_API_KEY` + `EMAIL_FROM` com um endereço desse domínio. E-mails de Auth do Supabase (reset de senha) usam SMTP separado no painel Supabase — ver [Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp).

### Banco de dados

O schema vive em `supabase/migrations/` (26 arquivos `.sql`). Aplique-os no seu projeto Supabase com a CLI do Supabase. Depois de qualquer migration nova, regenere os tipos em `src/integrations/supabase/types.ts`.

---

## Tutorial: sua primeira contribuição

Este passo a passo segue o fluxo clássico _fork → clone → branch → commit → pull request_, no espírito do projeto [First Contributions](https://github.com/firstcontributions/first-contributions). Se você nunca abriu um PR, comece por aqui.

Repositório: [https://github.com/farrapos1111/sgc-dm](https://github.com/farrapos1111/sgc-dm)

### 1. Fork do repositório

No GitHub, abra [farrapos1111/sgc-dm](https://github.com/farrapos1111/sgc-dm) e clique em **Fork**. Isso cria uma cópia do projeto na sua conta.

### 2. Clone o seu fork

No seu fork, clique em **Code**, copie a URL (HTTPS ou SSH) e clone:

```bash
git clone https://github.com/SEU-USUARIO/sgc-dm.git
cd sgc-dm
```

Substitua `SEU-USUARIO` pelo seu usuário do GitHub.

Instale as dependências e suba o ambiente (opcional se a mudança for só documentação):

```bash
bun install          # ou: npm install
# crie o .env — ver o modelo acima
bun run dev          # http://localhost:3000
```

### 3. Crie um branch

A partir de `main`:

```bash
git switch -c feat/nome-curto
```

Prefixos aceitos:

| Prefixo | Quando usar         |
| ------- | ------------------- |
| `feat/` | nova funcionalidade |
| `fix/`  | correção de bug     |
| `docs/` | só documentação     |

Exemplo: `git switch -c docs/corrigir-typo-guia`

Se `git switch` não existir na sua versão do Git:

```bash
git checkout -b feat/nome-curto
```

### 4. Faça a alteração

Mantenha o escopo enxuto: **um PR, um assunto**.

Em mudanças grandes, **abra uma issue antes** — evita duas pessoas resolvendo o mesmo problema de formas incompatíveis.

**Atualize a documentação no mesmo PR** — ver [Regra de documentação](#regra-de-documentação).

### 5. Adicione e faça o commit

```bash
git status
git add caminho/do/arquivo-alterado.tsx
git commit -m "Descreva o porquê da mudança em uma frase"
```

Exemplo:

```bash
git add docs/GUIA-DO-USUARIO.md
git commit -m "Corrige descrição da tela Mais no guia do usuário"
```

### 6. Envie o branch para o seu fork

```bash
git push -u origin feat/nome-curto
```

Use o mesmo nome do branch que você criou.

### 7. Abra o Pull Request

No GitHub, no **seu** fork, aparece o botão **Compare & pull request**. Clique, preencha:

- **o que** mudou
- **por que**
- **como testar**

Se mexeu na interface, inclua capturas de tela (antes e depois). Envie o PR para o repositório original `farrapos1111/sgc-dm`.

### Antes de marcar o PR como pronto

Rode as verificações **só nos arquivos que você tocou**:

```bash
npx eslint <apenas-os-arquivos-que-você-tocou>
npx prettier --write <apenas-os-arquivos-que-você-tocou>
bun run build      # confirma que o build passa e o TypeScript está limpo
```

> **Não rode `bun run lint` ou `bun run format` no repositório inteiro.** O código atual acumula ~2.535 erros de ESLint em 70 arquivos, sendo 2.377 apenas de formatação. Um `prettier --write .` reformataria 70 arquivos de uma vez, escondendo a sua mudança real e conflitando com a sincronização do Lovable. **Limite-se aos arquivos que você editou.** Detalhe em [TECNICO.md](./TECNICO.md#12-estado-atual-e-lacunas-conhecidas).

### Restrição crítica de histórico git

> **Não reescreva histórico já publicado.** Nada de `push --force`, `rebase`, `commit --amend` ou `squash` sobre commits que já estão no remoto.

Este repositório é sincronizado com o editor Lovable: os commits enviados ao branch conectado voltam para lá e aparecem no editor. Reescrever histórico publicado quebra essa sincronia e pode **fazer o mantenedor perder o histórico do projeto** no lado do Lovable. A restrição está registrada em [AGENTS.md](../AGENTS.md) na raiz.

Corolário: mantenha o branch conectado sempre em estado funcional. Um commit quebrado no `main` quebra também o editor.

---

## Organização do repositório

```
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
```

Detalhamento completo de camadas, fluxo de dados e modelo de dados em [TECNICO.md](./TECNICO.md).

---

## Padrões de código

**Idioma.** Textos da interface, segmentos de rota e comentários em **português**; identificadores de código (variáveis, funções, tipos) em **inglês**. É uma inconsistência aparente, mas intencional e consistente em todo o projeto.

**Formatação.** Prettier, aplicado como regra do ESLint: 100 colunas, aspas duplas, vírgula final. Formate **apenas os arquivos que você tocou** (`npx prettier --write caminho/do/arquivo.tsx`) — o repositório inteiro está fora de formatação e um `--write .` geral produz um diff que inviabiliza a revisão. Não discuta estilo em revisão de PR: o Prettier decide.

**Imports.** Use o alias `@/` para `src/`. Nada de `../../../`.

**Validação.** Toda _server function_ valida a entrada com Zod, e as mensagens de erro são em português, porque chegam direto ao usuário via toast.

**`src/components/ui/` não se edita.** São primitivos do shadcn/ui. Precisa de comportamento diferente? Componha por cima, em um componente de feature.

**Sufixos de arquivo têm significado:**

- `*.functions.ts` — _server functions_, importáveis normalmente do cliente
- `*.server.ts` — exclusivo de servidor, importado **dinamicamente** (`await import()`) de dentro do handler

O ESLint bloqueia o pacote `server-only` do Next.js com uma mensagem explicando essa convenção.

**Arquivos gerados — nunca editar à mão:** `src/routeTree.gen.ts` e `src/integrations/supabase/types.ts`.

**Bibliotecas pesadas entram sob demanda** (`await import()`), como já é feito com `jspdf`, `xlsx`, `qrcode` e `html5-qrcode`.

**Nunca commite segredo.** Chave, token ou senha real não entra no repositório, nem em comentário, nem em arquivo de teste.

---

## Mudanças no banco de dados

1. **Sempre por migration** em `supabase/migrations/`. Nunca altere o schema pelo painel do Supabase — a mudança não chega em quem clonou o projeto.
2. **Toda tabela nova precisa de RLS.** Uma tabela sem política é uma tabela aberta. Use os helpers já existentes: `is_chapter_member`, `has_permission`, `can_read_chapter`, `is_commission_member`.
3. **Toda tabela de conteúdo carrega `chapter_id`** — é a chave de isolamento entre capítulos.
4. **Mudou permissão? Mude nos dois lados.** A matriz de cargos existe duplicada: em TypeScript ([src/lib/permissions.ts](../src/lib/permissions.ts)) e em SQL (função `has_permission`). Alterar só uma cria divergência silenciosa: a interface esconde o botão mas o banco aceita a escrita, ou o contrário. **As duas pontas, no mesmo PR.**
5. **Regenere `types.ts`** depois de aplicar a migration.

---

## Segurança

O projeto lida com dados pessoais de menores de idade. Leve a sério.

**Reportar vulnerabilidade:** não abra issue pública. Entre em contato em privado com o mantenedor do repositório e dê tempo para a correção antes de qualquer divulgação. (Ainda não há `SECURITY.md` nem endereço dedicado — está no roadmap.)

**Ao contribuir, atenção especial a:**

- `SUPABASE_SERVICE_ROLE_KEY` ignora toda a RLS. Nunca no cliente, nunca no repositório, nunca em log.
- CPF e RG são cifrados no banco e só se revelam pela RPC `reveal_member_pii`. Não crie caminho novo que devolva PII em claro.
- O escopo regional/estadual é **sem PII** na busca consolidada. Escrita de regiões fica com o GME; capítulos/membros regionais também com MCR/OE — não amplie sem discussão. Estados não são gerenciáveis pelo app.
- Toda tabela nova precisa de RLS antes do merge.
- Nunca registre PII em log ou telemetria de erro.

---

## Código de conduta

O Templo Virtual atende uma organização juvenil, e o padrão de convivência acompanha isso:

- **Respeito, sempre.** Critique a ideia, o código, a decisão — nunca a pessoa.
- **Zero tolerância a assédio**, de qualquer forma, em qualquer espaço do projeto.
- **Paciência com quem está começando.** Muita gente que vai contribuir aqui é jovem e está no primeiro projeto. Uma revisão de PR mal-educada custa um contribuidor.
- **Sem conteúdo impróprio** em código, comentário, issue ou PR.

Um `CODE_OF_CONDUCT.md` formal (provavelmente baseado no Contributor Covenant) ainda será adotado. Até lá, valem os pontos acima. Comportamento fora desse padrão pode resultar em bloqueio de participação.

---

## Roadmap — onde ajudar

As lacunas conhecidas do projeto, que são também as melhores primeiras contribuições:

| Prioridade | Item                                                                                                         | Por quê                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Alta    | Remover as credenciais de teste da tela de login ([src/routes/auth/index.tsx](../src/routes/auth/index.tsx)) | Bloqueia qualquer uso real                                                                                                        |
| 🟡 Média   | Revisar se algum `.env` legado ainda está no histórico do git                                                | `.gitignore` e `.env.example` já existem; confirme que nenhum segredo foi commitado no passado                                    |
| 🟠 Média   | Investigar os 9 erros de `react-hooks/rules-of-hooks`                                                        | São os únicos erros de lint que apontam bug de execução, não estilo                                                               |
| 🟠 Média   | Testes automatizados (Vitest para os helpers, Playwright para os fluxos)                                     | Não existe nenhum; comece por `permissions.ts`, `format.ts`, `terms.ts`, `finance-xlsx.ts`                                        |
| 🟠 Média   | Zerar a dívida de formatação (`prettier --write .` em um PR isolado, sem nenhuma outra mudança)              | Enquanto houver 2.377 erros de estilo, o lint não serve de barreira. Precisa ser um PR só disso, combinado antes com o mantenedor |
| 🟠 Média   | CI no GitHub Actions rodando lint + build                                                                    | Nenhuma verificação automática hoje — só faz sentido depois de zerar a dívida acima                                               |
| 🟠 Média   | Script de `typecheck` no `package.json`                                                                      | Erros de tipo só aparecem no editor ou no build                                                                                   |
| 🟡 Baixa   | Revisão de acessibilidade (navegação por teclado, leitores de tela, contraste)                               | Nunca foi auditada                                                                                                                |
| 🟡 Baixa   | Corrigir `package.json.name` (ainda `tanstack_start_ts`)                                                     | Herança do template                                                                                                               |
| 🟡 Baixa   | `CODE_OF_CONDUCT.md` e `SECURITY.md` formais                                                                 | Hoje só existem em resumo, aqui                                                                                                   |
| 🟡 Baixa   | Decidir o destino de `improveText` e de `supabaseAdmin`                                                      | Ambos existem no código e não são usados por ninguém                                                                              |

Quer ajudar mas não sabe por onde começar? Abra uma issue perguntando — é uma contribuição legítima.

---

## Regra de documentação

> **PR que muda comportamento e não atualiza a documentação correspondente não é mergeado.**

Não é burocracia. Documentação adiada é documentação nunca escrita, e documentação errada é pior do que documentação nenhuma — as pessoas confiam nela e tomam decisões erradas. O custo de atualizar um parágrafo no PR em que a mudança está fresca é minúsculo perto do custo de descobrir seis meses depois que a doc mente.

| Tipo de mudança                                                                                       | Atualizar                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Nova rota, nova _server function_, nova tabela/migration, nova variável de ambiente, nova dependência | [TECNICO.md](./TECNICO.md)                 |
| Nova tela, novo campo, ou qualquer fluxo visível para quem usa o sistema                              | [GUIA-DO-USUARIO.md](./GUIA-DO-USUARIO.md) |
| Mudança em setup, scripts, convenções ou processo de PR                                               | **este documento**                         |
| Mudança em cargo, permissão ou regra de acesso                                                        | **os três**                                |
| Mudança apenas de estilo, refatoração sem efeito visível                                              | nenhum                                     |

Antes de marcar o PR como pronto:

- [ ] O comportamento mudou para quem usa? → Guia do Usuário
- [ ] Quem for mexer nesse código precisa saber de algo novo? → Documentação técnica
- [ ] Mudou como se roda, testa ou contribui? → este documento
- [ ] Adicionei variável de ambiente? → tabela em `TECNICO.md` **e** o bloco `.env.example` acima
- [ ] Fechei um item do roadmap? → remova-o daqui e da seção de lacunas em `TECNICO.md`
- [ ] Os caminhos de arquivo que citei realmente existem?
