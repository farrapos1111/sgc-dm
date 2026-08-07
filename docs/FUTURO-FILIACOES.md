# Futuro — filiações multi-corpo (discussão)

> Documento interno para alinhar com a equipe **antes** de implementar.  
> **Não** faz parte do catálogo in-app em `/documentacao`. Escopo atual do produto continua sendo **apenas Capítulo DeMolay**.

## Contexto

Hoje o Templo Virtual modela um único tipo de instituição: o **capítulo DeMolay** (`chapters` → `members` → `chapter_members`). Na Ordem, a mesma pessoa pode pertencer a corpos distintos ao longo da vida. A meta futura é um **login único** com até **uma afiliação de cada tipo**.

## Corpos previstos

| Corpo | Nome usual | Limite |
| --- | --- | --- |
| Escudeiros | Castelo de Escudeiros | no máximo 1 |
| DeMolay | Capítulo DeMolay | no máximo 1 (já existe) |
| Cavalaria | Priorado da Cavalaria (Nobre Rito) | no máximo 1 |
| Alumni | Colégio Alumni | no máximo 1 |

**Alumni:** só quem **já foi DeMolay** e tem **21 anos ou mais**.

## Faixas etárias de referência (validar com a equipe)

Valores típicos da Ordem no Brasil — **não são regra de produto ainda**:

| Corpo | Referência |
| --- | --- |
| Escudeiros | cerca de 9 a 11 anos |
| DeMolay ativo | 12 a 21 anos (já refletido em parte no sistema via `kind` senior em 21+) |
| Cavalaria | após requisitos ritualísticos / idade mínima do rito (a confirmar) |
| Alumni | 21+ e histórico DeMolay |

Menores de idade continuam exigindo responsáveis e consentimento LGPD, como já ocorre no cadastro de membros.

## Implicações técnicas (rascunho)

1. **Instituições tipadas** — generalizar `chapters` (ou tabela `institutions`) com `kind`: `castelo` | `capitulo` | `priorado` | `alumni`, mantendo hierarquia estadual/regional onde fizer sentido.
2. **Membros multi-corpo** — `members` (ou afiliações) por instituição; a pessoa física liga-se à conta via `user_id` (já introduzido no capítulo).
3. **Acesso** — `chapter_members` (ou equivalente) por instituição + cargos específicos de cada corpo; matriz de permissões deixa de ser só “capítulo DeMolay”.
4. **Login** — permanece único (e-mail / ID DeMolay); o seletor de escopo passa a listar as instituições vinculadas, não só capítulos.
5. **Regras de elegibilidade** — validar idade e pré-requisitos (ex.: Alumni) no cadastro/vínculo, no servidor.

## Fora de escopo agora

- Migrations, UI, cargos e permissões de Castelo / Priorado / Alumni.
- Mudar o papel do GME ou abrir escrita regional além do que a documentação atual descreve.
- Signup público self-service.

## Próximo passo sugerido

Workshop curto com a equipe para: (1) confirmar faixas etárias e pré-requisitos oficiais no jurisdição; (2) decidir se Castelo/Priorado/Alumni compartilham o mesmo módulo de tesouraria/atas ou têm superfícies menores; (3) priorizar qual corpo entra depois do Capítulo.
