# Checklist manual — RBAC por papel (capítulo ativo)

Pré-requisito: migrations `20260809120000_global_members_rbac.sql`, `20260815120000_dues_amount_has_permission.sql` e `20260817130000_multiaffiliation_signatures_rbac.sql` aplicadas; usuário com `chapter_members` ativo (role base `membro` basta quando o cargo ritualístico concede poder). Gates de UI usam `useChapterAccess` (role **+** cargo do termo). Assinaturas oficiais usam `member_office_signatures` por `(membro, capítulo, cargo)`.

| Papel | Como preparar | Esperado |
| --- | --- | --- |
| Admin (`admin_total`) | SQL / convite manual — **não** aparece em selects de role | Acesso total; Configurações e provisionamento de conta |
| Mestre Conselheiro | Role ou cargo `mestre_conselheiro` no semestre | Acesso total no capítulo |
| Escrivão | Role ou cargo `escrivao` | CRUD completo de Secretaria (nav + telas) + Com. Sindicâncias |
| Tesoureiro | Role ou cargo `tesoureiro` | CRUD completo de Tesouraria (nav + telas; Pix/mensalidade padrão) + Com. Eventos (tickets/comandas/checkout) |
| 1º Conselheiro | Cargo ritualístico no semestre | Visualização de **todas** as telas (Secretaria, Tesouraria, Comissões…); sem CRUD/edição |
| 2º Conselheiro | Idem | Idem |
| PCC / Consultor | Role `presidente_conselho`/`consultor` ou cargos consultivos | Acesso total no capítulo |
| Pres. de comissão | `commission_members.role = presidente` | Edição só na comissão designada |
| Membro/vice/auxiliar Eventos | Papel na comissão eventos | View + voto; tickets, comandas, checkout, orçamento |
| Membro comum | Role `membro` sem cargos especiais | Calendário, Gestão (view), Perfil; sem menus Secretaria/Tesouraria |

## Escopo de capítulo (multifiliação)

- MC do Capítulo A **não** administra Capítulo B (mesmo login com múltiplos `chapter_members`).
- Trocar capítulo ativo e repetir um gate de edição (menus `/mais` e sidebar devem recalcular).
- Confirmar para: MC, Escrivão, Tesoureiro, PCC, Conselheiros (1º/2º e consultivo).

## Assinaturas oficiais

- Registrar tinta em `/auth/assinatura` por cargo **e** capítulo.
- Ata: só quem ocupa o cargo no capítulo da ata consegue Assinar; exige tinta registrada nesse capítulo.
- Ofício / fluxo de caixa: PDF mostra nomes + imagens oficiais dos cargos do capítulo emissor (PCC, MC, Escrivão / Tesoureiro / Conselheiro).
- Sindicância: pad “Escrivão de Parecer” pré-preenche com assinatura oficial do cargo Escrivão do capítulo, se existir; demais pads (indicado, responsáveis, sindicante) continuam livres.
- Assinatura do Capítulo A **não** aparece em documentos do Capítulo B.

## Cadastro global

- Buscar por ID DeMolay existente → autofill + histórico collapsed.
- Vincular sem duplicar ficha; dados mestres read-only no capítulo não originário.
- Solicitar alteração → aparece em `/membros/solicitacoes` do originário → aprovar aplica / recusar mantém.
- Aprovar afiliação cria `chapter_members` com role `membro` (nunca copia role elevado).

## Testes automatizados da matriz

```bash
npx tsx src/lib/permissions.test.ts
npx tsx src/lib/office-signatures.test.ts
```
