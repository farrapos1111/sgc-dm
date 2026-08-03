# SG-CDM — Guia do Usuário

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

Você entra em `/auth` com **e-mail ou ID DeMolay** e senha. Contas não são criadas sozinhas: o Mestre Conselheiro (ou Administrador Total) cria o acesso na ficha do membro, depois que a ficha já está cadastrada.

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

### Perfil

Área global do usuário (não muda com o capítulo selecionado). Mostra os capítulos em que o cadastro de membro está vinculado à sua conta (`members.user_id`, com fallback legado por e-mail/nome), os **IDs DeMolay e maçônico**, os graus, um espaço reservado para o **Nobre Rito da Cavalaria** (em breve) e as **carteirinhas de proficiência** ativas — com visualização frente/verso no formato CR80 e opção de imprimir ou salvar em PDF.

No celular, **Perfil** fica na barra inferior; no computador, no menu lateral.

### Início

O painel de abertura. Cumprimenta pelo **primeiro nome** do perfil e mostra, de relance:

- se há uma **sessão acontecendo agora** (com atalho direto para a chamada)
- o **próximo compromisso** do calendário
- o **saldo do mês** no caixa
- quantos **membros ativos** o capítulo tem
- os **aniversariantes**
- a **chave do dia** pronta para copiar e colar no grupo do capítulo

### Secretaria

**Membros.** O cadastro completo do capítulo. O formulário é um passo a passo — se o candidato for menor de idade, ele ganha uma etapa a mais para os dados dos responsáveis (até dois, com um definido como principal) e a coleta do consentimento de dados. Cada membro tem sua ficha com histórico de cargos, presenças e graus. O **Mestre Conselheiro** (ou Administrador Total) pode **emitir, ver e revogar** a carteirinha de proficiência CR80 na ficha do membro; o titular a encontra também em **Perfil**.

Na mesma ficha, o MC/Admin Total vê o painel **Acesso ao sistema**: com o e-mail já preenchido na ficha, ele **cria a conta** (senha temporária) ou **vincula** uma conta existente, escolhe o cargo de acesso e pode gerar nova senha temporária ou desativar o acesso ao capítulo. O jovem entra depois com e-mail **ou ID DeMolay** e, no primeiro acesso, redefine a senha.

**Atas.** Em **Secretaria → Atas**, a aba **Atual** lista cards das atas em andamento (rascunho ou em revisão): nome da sessão, data, situação, assinaturas, PDF e **Acessar ata**. A redação e a aprovação acontecem **só na sessão** (não no hub). Use **Criar nova ata** para escolher uma sessão recente sem registro e ir direto à aba Ata. As atas seguem **rascunho → em revisão → aprovada**. Ainda no rascunho, dá para **compartilhar uma visão pública** (link + senha) para os membros lerem e registrarem *aprovada* ou *reprovada* — reprovação **exige justificativa**. Esse feedback **não substitui** as três assinaturas oficiais (Presidente do Conselho, Mestre Conselheiro e Escrivão). Há modelos editáveis por capítulo e exportação em PDF.

**Presenças.** O histórico de chamada e a frequência de cada membro ao longo do tempo.

**Chamada ao vivo.** Quando a sessão está acontecendo, o sistema abre uma tela de chamada: marca-se presente ou ausente (com justificativa), e a ata é escrita na aba Ata da mesma tela.
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
- **Instituições e Regiões** — cadastro e edição de capítulos e regiões (Grande Mestre Estadual ou super administrador)
- **Estados** — cadastro de jurisdições estaduais (**somente super administrador**)
- **Lideranças** — atribui GME, MCE, MCR e Oficiais Executivos a contas existentes por e-mail (GME do estado ou super administrador)

### Documentação

Sem precisar de permissão especial: em **Mais → Documentação**, ou pela URL `/documentacao` (também acessível sem login). Há três guias — técnico, do usuário e de contribuição open source. No celular, **Mais** também lista o menu completo do sistema (as mesmas áreas do menu lateral no computador), filtrado pelo seu cargo, comissão e escopo.

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
Sim. No celular o menu vira uma barra de abas na parte de baixo da tela, com atalhos rápidos (**Início**, **Calendário**, **Perfil** e **Mais**; no escopo regional, Panorama · Calendário · Perfil · Mais). Em **Mais** aparece o menu completo — as mesmas áreas do computador, filtradas pelo seu cargo, comissão e escopo — além da **Documentação** (`/documentacao`, também acessível sem login) e da opção de sair. Eventos e demais áreas de comissão ficam em **Mais** (ou no menu lateral no computador).

**Preciso instalar alguma coisa?**
Não. É pelo navegador, no computador ou no celular.

**E se eu pertenço a dois capítulos?**
Ao entrar, o sistema pergunta em qual capítulo você quer trabalhar. A escolha fica guardada, e há um seletor no topo para trocar quando quiser — inclusive de outro dispositivo.

**Errei um lançamento no caixa. E agora?**
Quem tem permissão de Tesouraria pode editar ou excluir o lançamento. Se ele veio de uma mensalidade paga, basta desfazer o pagamento que o lançamento sai junto.

**Perdi o acesso / esqueci a senha.**
Use **Esqueci a senha** na tela de login (`/auth/recuperar-senha`) com o e-mail da conta. Se ainda não tiver conta, fale com o Administrador Total ou o Mestre Conselheiro — eles criam o acesso na ficha do membro e passam a senha temporária. No primeiro acesso o sistema pede para redefinir a senha.

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
| **Ata** | O registro oficial da sessão: rascunho (com consulta pública opcional), revisão e três assinaturas |
| **Sindicância** | O processo de investigação e parecer sobre um candidato |
| **Hospitalaria** | A comissão responsável pela alimentação e recepção nas atividades |
| **Sênior DeMolay** | Membro que já passou da idade ativa — isento de mensalidade no sistema |

---

## Manutenção deste guia

> **Mudou uma tela, um campo ou um fluxo que o usuário enxerga? Este guia é atualizado no mesmo momento da mudança.**

Esta é a documentação que as pessoas do capítulo leem antes de pedir ajuda, e que serve de roteiro para apresentar o sistema. Se ela descreve uma tela que não existe mais, ou deixa de fora um recurso novo, ela para de ser confiável e todo mundo volta a perguntar.

Quem faz a mudança atualiza o guia. Ver a regra completa e as demais documentações em [docs/README.md](./README.md).
