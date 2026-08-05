# Checklist manual — RBAC por papel (capítulo ativo)

Pré-requisito: migration `20260809120000_global_members_rbac.sql` aplicada; usuário com `chapter_members` ativo (role base `membro` basta quando o cargo ritualístico concede poder).

| Papel | Como preparar | Esperado |
| --- | --- | --- |
| Admin (`admin_total`) | SQL / convite manual — **não** aparece em selects de role | Acesso total; Configurações e provisionamento de conta |
| Mestre Conselheiro | Role ou cargo `mestre_conselheiro` no semestre | Acesso total no capítulo |
| Escrivão | Role ou cargo `escrivao` | Secretaria + Com. Sindicâncias |
| Tesoureiro | Role ou cargo `tesoureiro` | Tesouraria + Com. Eventos (tickets/comandas/checkout) |
| 1º Conselheiro | Cargo ritualístico no semestre | Visualização ampla; sem edição admin |
| 2º Conselheiro | Idem | Idem |
| PCC / Consultor | Role `presidente_conselho`/`consultor` ou cargos consultivos | Acesso total no capítulo |
| Pres. de comissão | `commission_members.role = presidente` | Edição só na comissão designada |
| Membro/vice/auxiliar Eventos | Papel na comissão eventos | View + voto; tickets, comandas, checkout, orçamento |
| Membro comum | Role `membro` sem cargos especiais | Presenças, Fluxo, Mensalidades, Calendário, Gestão (view), Perfil |

## Escopo de capítulo

- MC do Capítulo A **não** administra Capítulo B (mesmo login com múltiplos `chapter_members`).
- Trocar capítulo ativo e repetir um gate de edição.

## Cadastro global

- Buscar por ID DeMolay existente → autofill + histórico collapsed.
- Vincular sem duplicar ficha; dados mestres read-only no capítulo não originário.
- Solicitar alteração → aparece em `/membros/solicitacoes` do originário → aprovar aplica / recusar mantém.

## Testes automatizados da matriz

```bash
npx tsx src/lib/permissions.test.ts
```
