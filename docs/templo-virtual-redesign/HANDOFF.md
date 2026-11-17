# Templo Virtual · Redesign (handoff para implementação)

Cada arquivo `.dc.html` é uma tela. O markup é HTML com estilos inline; a lógica (estado, dados de exemplo, handlers) fica no `<script type="text/x-dc">` no fim de cada arquivo. `{{x}}` são valores vindos de `renderVals()`, `<sc-for>` é um loop e `<sc-if>` é condicional. `<dc-import name="X">` monta o componente `X.dc.html`.

Use como especificação visual e de comportamento. Reimplemente em React/Next + Tailwind seguindo os tokens abaixo.

## Telas
| Arquivo | Tela |
|---|---|
| Main.dc.html | Mobile · Início (dashboard estilo app de banco) |
| M-Membros.dc.html | Mobile · Membros |
| M-Perfil.dc.html | Mobile · Perfil + carteirinha digital |
| M-Caixa.dc.html | Mobile · Caixa (extrato por dia) |
| M-Mensalidades.dc.html | Mobile · Mensalidades |
| M-Chamada.dc.html | Mobile · Chamada (presenças) |
| M-Ata.dc.html | Mobile · Ata |
| TabBar.dc.html | Componente · barra de abas mobile (Chamada central) |
| Sidebar.dc.html | Componente · menu lateral desktop |
| D-Inicio, D-Membros, D-Perfil, D-Caixa, D-Mensalidades, D-Chamada, D-Atas | Desktop |

## Tokens
Cor da marca é variável (seletor de identidade). Cada tema tem 3 valores:
- `primary` (fundos de destaque, botões principais)
- `primary-soft` (fundo de chips, avatares, botões secundários)
- `primary-ink` (texto sobre `primary-soft`)

| Tema | primary | soft | ink |
|---|---|---|---|
| Bordô | #8A1C2B | #F7E9EB | #6E1622 |
| Azul | #1F4FA3 | #E7EEFA | #173E80 |
| Verde | #17694A | #E3F1EA | #10523A |
| Roxo | #5B2A86 | #EFE7F7 | #4A2270 |
| Grafite | #2A2E35 | #E9EAEC | #2A2E35 |

Fixos (não mudam com o tema):
- Fundo app #F4F4F1, superfície #FFFFFF, borda #E2E2DE / #F0F0EC
- Texto #17181A, secundário #5E6168
- Entrada/sucesso #155A38 sobre #EAF5EF; saída/erro #A1261B sobre #FBEDEC
- Aviso #7A4F00 sobre #FDF3D8
- Mensalidade: Pago #DDF0E5/#155A38, Em aberto #FFF6D6/#6E5100, Atrasado #FBE3C8/#7E3F00, Isento #E3EAF7/#2D4A80, Desligado #E6E6E3/#4F5258

Tipografia: Inter (corpo, 16px base no mobile), Plus Jakarta Sans 800 (títulos e valores).
Raios: cards 20-22px, botões 12-14px, chips 999px.

## Regras de acessibilidade
- Alvos de toque mínimos de 44px
- Todo ícone tem rótulo escrito; botões só com ícone têm aria-label
- Situações sempre por extenso, nunca só letra ou cor
- Olho para ocultar valores no Início e no Caixa

## Pendências
- Logo do capítulo no background do Início (a fazer na implementação)
- Tema escuro
