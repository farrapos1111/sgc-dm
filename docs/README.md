# Documentação — SG-CDM

**SG-CDM (Sistema Gerenciador de Capítulos DeMolay)** é uma aplicação web em português para a gestão de capítulos DeMolay: membros, atas, presenças, tesouraria, calendário e comissões, com controle de acesso por cargo e uma camada de acompanhamento regional/estadual.

## Os três documentos

Toda a documentação vive em [`docs/`](./) e no visualizador do app em **`/documentacao`**:

| Documento | Leia se você é… | Cobre |
| --- | --- | --- |
| [TECNICO.md](./TECNICO.md) · `/documentacao/tecnica` | desenvolvedor(a), vai mexer no código | stack, arquitetura, modelo de dados, permissões, variáveis de ambiente, build e deploy |
| [GUIA-DO-USUARIO.md](./GUIA-DO-USUARIO.md) · `/documentacao/guia` | membro do capítulo, ou vai apresentar o sistema | o que o sistema faz, tela por tela, em linguagem simples |
| [OPEN-SOURCE.md](./OPEN-SOURCE.md) · `/documentacao/open-source` | quer contribuir com o projeto | setup local, tutorial de contribuição, padrões de código, licença, segurança |

### Discussão interna (fora do app)

| Documento | Uso |
| --- | --- |
| [FUTURO-FILIACOES.md](./FUTURO-FILIACOES.md) | Rascunho para a equipe sobre expansão futura (Castelo, Priorado, Alumni) — **não** publicado em `/documentacao` |

---

## Regra de manutenção da documentação

> **Toda alteração no projeto deve atualizar a documentação correspondente no mesmo commit/PR da mudança.**

Documentação que vive num PR separado nunca é escrita. Se a mudança de comportamento entra hoje e a doc entra "depois", a doc fica errada a partir de hoje — e uma doc errada é pior do que doc nenhuma, porque as pessoas confiam nela.

### Qual documento atualizar

| Tipo de mudança | Atualizar |
| --- | --- |
| Nova rota, nova *server function*, nova tabela/migration, nova variável de ambiente, nova dependência | [TECNICO.md](./TECNICO.md) |
| Nova tela, novo campo, ou qualquer fluxo visível para quem usa o sistema | [GUIA-DO-USUARIO.md](./GUIA-DO-USUARIO.md) |
| Mudança em setup, scripts, convenções de código ou processo de PR | [OPEN-SOURCE.md](./OPEN-SOURCE.md) |
| Mudança em cargo, permissão ou regra de acesso | **os três** |
| Mudança apenas de estilo, refatoração sem efeito visível | nenhum |

### Checklist rápido antes de abrir o PR

- [ ] O comportamento mudou para quem usa? → `GUIA-DO-USUARIO.md`
- [ ] Alguém que for mexer nesse código precisa saber de algo novo? → `TECNICO.md`
- [ ] Mudou como se roda, testa ou contribui? → `OPEN-SOURCE.md`
- [ ] Adicionei variável de ambiente? → `TECNICO.md` **e** o bloco `.env.example` em `OPEN-SOURCE.md`
- [ ] Os caminhos de arquivo que citei na doc realmente existem?
