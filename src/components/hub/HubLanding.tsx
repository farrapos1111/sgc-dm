import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import {
  REALM_CARD_BLURB,
  REALM_LABELS,
  REALMS,
  realmEntryUrl,
} from "@/lib/realm";
import { cn } from "@/lib/utils";
import { SupademoEmbed } from "@/components/hub/SupademoEmbed";
import {
  useHubHostGuard,
} from "@/components/hub/useHubSession";
import "./hub-landing.css";

const PIX_KEY = "pix@templovirtual.com.br";
const GITHUB_URL = "https://github.com/farrapos1111/sgc-dm";

const NAV_LINKS = [
  { href: "#quem", label: "Para quem é" },
  { href: "#modulos", label: "Módulos" },
  { href: "#demo", label: "Demonstração" },
  { href: "#valor", label: "Valor" },
  { href: "#apoiar", label: "Apoiar" },
  { href: "#contato", label: "Contato" },
] as const;

const AUDIENCES = [
  {
    label: "Ordem DeMolay",
    detail: "Capítulos · Escudeiros · Cavalaria · Alumni",
    className: "tv-a-odm",
    realm: "odm" as const,
  },
  {
    label: "Filhas de Jó",
    detail: "Bethéis",
    className: "tv-a-fdj",
    realm: "fdj" as const,
  },
  {
    label: "Ordem do Arco-Íris",
    detail: "Em expansão",
    className: "tv-a-arco",
    realm: null,
  },
  {
    label: "Ação Paramaçônica",
    detail: "Em expansão",
    className: "tv-a-apj",
    realm: null,
  },
  {
    label: "Lojas Maçônicas",
    detail: "Sob medida",
    className: "tv-a-loja",
    realm: "loja" as const,
  },
] as const;

const FAQ = [
  {
    q: "Como contribuir?",
    a: "Com sugestões, doações ou entrando na comissão de Tecnologia e Inovação. As três formas estão em Apoiar o projeto.",
  },
  {
    q: "Existe comissão de Tecnologia?",
    a: "Sim. Se você tem interesse e conhecimento, solicite o ingresso na equipe pelos contatos abaixo.",
  },
  {
    q: "Roda em qualquer aparelho?",
    a: "Sim — totalmente funcional em computadores e telefones.",
  },
] as const;

/** Quatro módulos iguais no anel (circunferência ≈ 2π·88). */
const MODULES = [
  {
    id: "secretaria",
    title: "Secretaria",
    description: "Gestão completa de membros, atas, ofícios e frequência.",
    color: "#f6d84f",
  },
  {
    id: "tesouraria",
    title: "Tesouraria",
    description: "Fluxo de caixa, mensalidades, relatórios e cobranças.",
    color: "#5b8bf0",
  },
  {
    id: "comissoes",
    title: "Comissões",
    description: "Eventos, manutenção, novos membros e hospitalaria.",
    color: "#b09bf0",
  },
  {
    id: "gestao",
    title: "Gestão",
    description: "Calendário, nominatas e chaves do dia.",
    color: "#f3b06a",
  },
] as const;

const DONUT_R = 88;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_SEG = DONUT_C / 4;

function PageHead({ num, dark }: { num: string; dark?: boolean }) {
  return (
    <>
      <div className="tv-pagehead">
        <span className="tv-badge" aria-hidden>
          <img
            src={dark ? "/favicon-white.svg" : "/logos/templo-virtual.svg"}
            alt=""
            width={26}
            height={26}
          />
        </span>
        <span className="tv-num">{num}</span>
      </div>
      <div className="tv-rule" />
    </>
  );
}

function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = el.querySelectorAll(".tv-rv");
    if (!nodes.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root]);
}

export function HubLanding() {
  useHubHostGuard();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);
  const [pixCopied, setPixCopied] = useState(false);
  const [navStuck, setNavStuck] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useReveal(rootRef);

  useEffect(() => {
    const onScroll = () => setNavStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
    } catch {
      const t = document.createElement("textarea");
      t.value = PIX_KEY;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setPixCopied(true);
    window.setTimeout(() => setPixCopied(false), 2200);
  }

  return (
    <div className="tv-hub" ref={rootRef}>
      <header
        className={cn("tv-nav", menuOpen && "tv-open", navStuck && "tv-stuck")}
      >
        <a className="tv-brand" href="#top" onClick={() => setMenuOpen(false)}>
          <img src="/favicon-white.svg" alt="" width={34} height={34} />
          <span>
            Templo <em>Virtual</em>
          </span>
        </a>
        <nav className="tv-nav-links" aria-label="Seções">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="tv-nav-actions">
          <button
            type="button"
            className="tv-menu-btn"
            aria-expanded={menuOpen}
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
          <Link
            to="/auth"
            className="tv-btn tv-btn-ghost"
            style={{ padding: "10px 18px" }}
          >
            Entrar
          </Link>
          <a className="tv-btn tv-btn-gold" href="#iniciar">
            Solicitar acesso
          </a>
        </div>
      </header>

      <section className="tv-section tv-dark tv-hero" id="top">
        <div className="tv-glow-gold" aria-hidden />
        <div className="tv-blinds" aria-hidden />
        <img
          className="tv-hero-mark-bg"
          src="/favicon-white.svg"
          alt=""
          aria-hidden
        />
        <div className="tv-shell tv-hero-in">
          <img
            className="tv-hero-mark"
            src="/favicon-white.svg"
            alt="Marca Templo Virtual"
            width={96}
            height={96}
          />
          <h1>
            Templo <span className="tv-gold">Virtual</span>
          </h1>
          <div className="tv-mirror" aria-hidden>
            <h1>
              Templo <span className="tv-gold">Virtual</span>
            </h1>
          </div>
          <p className="tv-sub">
            Gestão e gerenciamento de ordens paramaçônicas e lojas maçônicas, em
            um só lugar.
          </p>
          <div className="tv-hero-cta">
            <a className="tv-btn tv-btn-gold" href="#iniciar">
              Solicitar acesso
            </a>
            <a className="tv-btn tv-btn-ghost" href="#demo">
              Ver o sistema por dentro
            </a>
          </div>
          <div className="tv-hero-meta">
            <span>Gratuito para paramaçônicas</span>
            <span>Código aberto</span>
            <span>Roda no celular</span>
          </div>
        </div>
        <div className="tv-scrolldot" aria-hidden />
      </section>

      <section className="tv-section tv-paper" id="quem">
        <div className="tv-shell">
          <PageHead num="02" />
          <div className="tv-grid-2 tv-rv">
            <div>
              <h2 style={{ fontSize: "clamp(2.3rem, 5.2vw, 3.6rem)" }}>
                Para quem é?
              </h2>
              <p className="tv-lead" style={{ marginTop: 16 }}>
                Um sistema por organização, com os módulos que a rotina dela
                realmente usa.
              </p>
              <img
                src="/logos/templo-virtual.svg"
                alt=""
                width={200}
                height={200}
                style={{
                  marginTop: 28,
                  display: "block",
                  width: "min(200px, 55%)",
                }}
              />
            </div>
            <div className="tv-audiences">
              {AUDIENCES.map((a) =>
                a.realm ? (
                  <a
                    key={a.label}
                    className={cn("tv-audience", a.className)}
                    href={realmEntryUrl(a.realm)}
                  >
                    <span>
                      {a.label}
                      <br />
                      <small>{a.detail}</small>
                    </span>
                    <span className="tv-chev" aria-hidden>
                      →
                    </span>
                  </a>
                ) : (
                  <div key={a.label} className={cn("tv-audience", a.className)}>
                    <span>
                      {a.label}
                      <br />
                      <small>{a.detail}</small>
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          <h3
            className="tv-rv"
            style={{ marginTop: 56, fontSize: "1.55rem", textAlign: "center" }}
          >
            Escolha o ambiente da sua instituição
          </h3>
          <div className="tv-realms">
            {REALMS.map((realm, i) => (
              <a
                key={realm}
                href={realmEntryUrl(realm)}
                className={cn("tv-realm", "tv-rv", `tv-rv-d${i + 1}`)}
              >
                <div className="host">{realm}.templovirtual.app</div>
                <h3>{REALM_LABELS[realm]}</h3>
                <p>{REALM_CARD_BLURB[realm]}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="tv-section tv-dark">
        <div className="tv-glow-gold" aria-hidden />
        <div className="tv-glow-blue" aria-hidden />
        <div className="tv-shell">
          <PageHead num="03" dark />
          <h2
            className="tv-rv"
            style={{
              textAlign: "center",
              fontSize: "clamp(2.1rem, 5vw, 3.4rem)",
            }}
          >
            Os nossos <span className="tv-gold">3 pilares</span>.
          </h2>
          <div className="tv-pillars">
            <div className="tv-card tv-rv tv-rv-d1">
              <span className="tv-letter">A</span>
              <h3>Acessibilidade</h3>
              <p>
                Todo mundo consegue usar. Poucos cliques e feito para o celular.
              </p>
            </div>
            <div className="tv-card tv-rv tv-rv-d2">
              <span className="tv-letter">T</span>
              <h3>Transparência</h3>
              <p>Código aberto, com espaço para quem quiser contribuir.</p>
            </div>
            <div className="tv-card tv-rv tv-rv-d3">
              <span className="tv-letter">O</span>
              <h3>Otimização</h3>
              <p>Sistema rápido de operar, com respostas instantâneas.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tv-section tv-paper" id="modulos">
        <div className="tv-shell">
          <PageHead num="04" />
          <h2
            className="tv-rv"
            style={{
              textAlign: "center",
              fontSize: "clamp(2.1rem, 5vw, 3.4rem)",
            }}
          >
            Composição
          </h2>
          <div className="tv-comp tv-rv" style={{ marginTop: 40 }}>
            <div
              className="tv-donut-wrap"
              onMouseLeave={() => setActiveModule(null)}
            >
              <svg
                className="tv-donut"
                viewBox="0 0 260 260"
                role="img"
                aria-label="Composição em quatro módulos: Secretaria, Tesouraria, Comissões e Gestão"
              >
                <g transform="rotate(-90 130 130)" fill="none" strokeWidth="52">
                  {MODULES.map((mod, i) => {
                    const dimmed =
                      activeModule !== null && activeModule !== mod.id;
                    return (
                      <circle
                        key={mod.id}
                        className={cn(
                          "tv-donut-seg",
                          activeModule === mod.id && "is-active",
                          dimmed && "is-dim",
                        )}
                        cx="130"
                        cy="130"
                        r={DONUT_R}
                        stroke={mod.color}
                        strokeDasharray={`${DONUT_SEG} ${DONUT_C - DONUT_SEG}`}
                        strokeDashoffset={-DONUT_SEG * i}
                        onMouseEnter={() => setActiveModule(mod.id)}
                      >
                        <title>{mod.title}</title>
                      </circle>
                    );
                  })}
                </g>
                <circle cx="130" cy="130" r="60" fill="#fff" />
              </svg>
              <img
                className="tv-donut-logo"
                src="/logos/templo-virtual.svg"
                alt=""
                width={96}
                height={96}
              />
            </div>
            <div className="tv-modules">
              {MODULES.map((mod) => (
                <div
                  key={mod.id}
                  className={cn(
                    "tv-mod",
                    activeModule === mod.id && "is-active",
                    activeModule && activeModule !== mod.id && "is-dim",
                  )}
                  style={{ ["--mod-dot" as string]: mod.color }}
                  onMouseEnter={() => setActiveModule(mod.id)}
                  onMouseLeave={() => setActiveModule(null)}
                >
                  <h3>{mod.title}</h3>
                  <p>{mod.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="tv-section tv-dark" id="demo">
        <div className="tv-glow-gold" aria-hidden />
        <div className="tv-shell">
          <PageHead num="05" dark />
          <h2
            className="tv-rv"
            style={{
              textAlign: "center",
              fontSize: "clamp(1.9rem, 4.6vw, 3.2rem)",
            }}
          >
            Secretaria, Tesouraria e Gestão
          </h2>
          <p
            className="tv-rv"
            style={{ textAlign: "center", opacity: 0.6, marginTop: 10 }}
          >
            Demonstrações interativas com Supademo
          </p>
          <div className="tv-demos-3 tv-rv" style={{ marginTop: 40 }}>
            <SupademoEmbed
              slot="secretaria"
              title="Secretaria"
              caption="Atas, ofícios e membros"
            />
            <SupademoEmbed
              slot="tesouraria"
              title="Tesouraria"
              caption="Mensalidades e fluxo de caixa"
            />
            <SupademoEmbed
              slot="gestao"
              title="Gestão"
              caption="Calendário e presença"
            />
          </div>
          <div
            className="tv-rv"
            style={{ marginTop: 36, maxWidth: 920, marginInline: "auto" }}
          >
            <SupademoEmbed
              slot="overview"
              title="Visão geral do Templo Virtual"
              caption="Tour completo da plataforma"
            />
          </div>
        </div>
      </section>

      <section className="tv-section tv-paper" id="comissoes">
        <div className="tv-shell">
          <PageHead num="06" />
          <h2
            className="tv-rv"
            style={{
              textAlign: "center",
              fontSize: "clamp(2.1rem, 5vw, 3.4rem)",
            }}
          >
            Comissões
          </h2>
          <div className="tv-grid-2 tv-rv" style={{ marginTop: 40 }}>
            <div>
              <p className="tv-kicker" style={{ color: "#6b717b" }}>
                Algumas funcionalidades
              </p>
              <div className="tv-feat-list" style={{ marginTop: 18 }}>
                <span className="tv-feat">Comandas virtuais</span>
                <span className="tv-feat">Aniversários por vir</span>
                <span className="tv-feat">Fichas de indicação</span>
                <span className="tv-feat">Questionários de sindicância</span>
              </div>
            </div>
            <SupademoEmbed
              slot="comissoes"
              title="Comissões e eventos"
              caption="Comandas, indicações e hospitalaria"
            />
          </div>
        </div>
      </section>

      <section className="tv-section tv-dark" id="cronograma">
        <div className="tv-glow-gold" aria-hidden />
        <div className="tv-glow-blue" aria-hidden />
        <div className="tv-shell">
          <PageHead num="07" dark />
          <div className="tv-grid-2 tv-rv">
            <div>
              <h2
                style={{
                  fontSize: "clamp(2.1rem, 5vw, 3.4rem)",
                  lineHeight: 1.05,
                }}
              >
                Cronograma de
                <br />
                Atualizações
              </h2>
              <p className="tv-lead" style={{ marginTop: 20 }}>
                Planejamento futuro do Templo Virtual.
              </p>
            </div>
            <div className="tv-timeline">
              <div className="tv-stage">
                <span className="st st-ok">#1 · Sucesso</span>
                <p>Criação do escopo inicial e montagem do projeto base.</p>
              </div>
              <div className="tv-stage">
                <span className="st st-ok">#2 · Sucesso</span>
                <p>
                  Validação do método em situações do dia a dia do Farrapos
                  1111.
                </p>
              </div>
              <div className="tv-stage">
                <span className="st st-now">#3 · Atual</span>
                <p>
                  Testes com outras paramaçônicas, pesquisando suas
                  necessidades.
                </p>
              </div>
              <div className="tv-stage">
                <span className="st st-soon">#4 · Não iniciado</span>
                <p>
                  Implementação das necessidades e modularização para cada
                  organização.
                </p>
              </div>
              <div className="tv-stage wide">
                <span className="st st-soon">#5 · Não iniciado</span>
                <p>
                  Expansão para o restante do estado e adaptação do sistema em
                  um app de celular.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tv-section tv-paper" id="valor">
        <div className="tv-shell">
          <PageHead num="08" />
          <h2
            className="tv-rv"
            style={{
              textAlign: "center",
              fontSize: "clamp(2.1rem, 5vw, 3.4rem)",
            }}
          >
            Qual o valor?
          </h2>
          <div className="tv-plans tv-rv" style={{ marginTop: 48 }}>
            <div className="tv-plan">
              <h3>Paramaçônicas</h3>
              <div className="region">ODM | FDJ | APJ</div>
              <p>
                Acesso a toda a plataforma, com modularização para encaixar na
                rotina.
              </p>
              <span className="tv-price">R$ 0,00</span>
            </div>
            <div className="tv-plan">
              <h3>Lojas Maçônicas</h3>
              <div className="region">Sob medida</div>
              <p>
                Análise dos módulos necessários e conversas para ajustar às
                demandas.
              </p>
              <span className="tv-price talk">Mediante consulta</span>
            </div>
          </div>
          <p
            className="tv-rv"
            style={{
              textAlign: "center",
              marginTop: 52,
              fontFamily: "var(--display)",
              fontSize: "clamp(1.2rem, 3vw, 1.7rem)",
            }}
          >
            E o que preciso para começar a usar?
          </p>
        </div>
      </section>

      <section className="tv-section tv-dark" id="iniciar">
        <div className="tv-glow-gold" aria-hidden />
        <div className="tv-glow-blue" aria-hidden />
        <div className="tv-shell">
          <PageHead num="09" dark />
          <div className="tv-grid-2 tv-rv">
            <div>
              <h2 style={{ fontSize: "clamp(2.1rem, 5vw, 3.4rem)" }}>
                Como iniciar
              </h2>
              <p className="tv-lead" style={{ marginTop: 20 }}>
                Se o projeto se adequar à rotina da sua organização, estes são
                os próximos passos.
              </p>
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  to="/auth/adicionar-organizacao"
                  className="tv-btn tv-btn-gold"
                >
                  Solicitar inclusão
                </Link>
                <a className="tv-btn tv-btn-ghost" href="#contato">
                  Falar com a equipe
                </a>
              </div>
            </div>
            <div className="tv-steps">
              <div className="tv-step">
                <span className="n">1</span>
                <p>
                  Solicitar a inclusão da organização e o cadastro inicial da
                  liderança (MC, HR, VM).
                </p>
              </div>
              <div className="tv-step">
                <span className="n">2</span>
                <p>
                  Após o acesso inicial, cadastrar os demais membros e o
                  calendário.
                </p>
              </div>
              <div className="tv-step">
                <span className="n">3</span>
                <p>
                  Configurar tesouraria, secretaria e as demais áreas da
                  instituição.
                </p>
              </div>
              <div className="tv-step">
                <span className="n">4</span>
                <p>Sugerir melhorias e aprimoramentos.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tv-section tv-navy" id="apoiar">
        <div className="tv-glow-gold" aria-hidden />
        <div className="tv-shell">
          <PageHead num="10" dark />
          <div
            className="tv-grid-2 tv-rv"
            style={{ alignItems: "end", marginBottom: 36 }}
          >
            <div>
              <p className="tv-kicker">Projeto de código aberto</p>
              <h2
                style={{
                  fontSize: "clamp(2rem, 4.8vw, 3.2rem)",
                  marginTop: 12,
                  lineHeight: 1.08,
                }}
              >
                Ajude a manter o
                <br />
                Templo Virtual no ar
              </h2>
            </div>
            <p className="tv-lead">
              O sistema é gratuito para as paramaçônicas e segue assim. O que
              existe de custo fica por conta de servidor, domínio, backups e
              envio de mensagens. Quem puder contribuir ajuda a manter tudo
              funcionando e a acelerar os próximos módulos.
            </p>
          </div>
          <div className="tv-support tv-rv">
            <div
              className="tv-card"
              style={{ borderColor: "rgba(255,199,44,.38)" }}
            >
              <p className="tv-kicker">Doação</p>
              <h3>Doar via Pix</h3>
              <p>
                Qualquer valor entra direto no custeio da plataforma. Sem
                cadastro, sem mensalidade e sem valor mínimo.
              </p>
              <div className="tv-pix">
                <span className="tv-pix-key">{PIX_KEY}</span>
                <button
                  type="button"
                  className="tv-btn tv-btn-gold"
                  onClick={() => void copyPix()}
                >
                  {pixCopied ? "Chave copiada" : "Copiar chave"}
                </button>
              </div>
            </div>
            <div className="tv-card">
              <p className="tv-kicker">Código</p>
              <h3>Contribuir com código</h3>
              <p>
                O repositório é público. Abra uma issue, mande um pull request
                ou peça ingresso na comissão de Tecnologia e Inovação.
              </p>
              <ul className="tv-ways">
                <li>TanStack Start, TypeScript e Supabase</li>
                <li>Issues marcadas para quem está começando</li>
                <li>Revisão feita junto com a equipe</li>
              </ul>
              <a
                className="tv-link"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                Ver repositório →
              </a>
            </div>
            <div className="tv-card">
              <p className="tv-kicker">Tempo</p>
              <h3>Ajudar de outras formas</h3>
              <p>
                Nem toda contribuição é dinheiro ou código. Boa parte do que
                existe hoje veio de conversa com quem usa.
              </p>
              <ul className="tv-ways">
                <li>Indicar o sistema para outra organização</li>
                <li>Relatar um erro ou sugerir melhoria</li>
                <li>Doar horas de design, texto ou suporte</li>
              </ul>
              <a className="tv-link" href="#contato">
                Mandar uma sugestão →
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="tv-section tv-paper" id="contato">
        <div className="tv-shell">
          <PageHead num="11" />
          <div className="tv-faq tv-rv">
            <div>
              <h2 style={{ fontSize: "clamp(2.2rem, 5vw, 3.2rem)" }}>FAQ</h2>
              <p style={{ opacity: 0.6, margin: "6px 0 22px" }}>
                Perguntas comuns.
              </p>
              {FAQ.map((item, i) => (
                <div
                  key={item.q}
                  className={cn("tv-qa", faqOpen === i && "open")}
                >
                  <button
                    type="button"
                    aria-expanded={faqOpen === i}
                    onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                  >
                    <span className="lz" aria-hidden />
                    {item.q}
                  </button>
                  <div className="ans">
                    <p style={{ margin: 0 }}>{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h2
                style={{
                  fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                  lineHeight: 1.15,
                }}
              >
                Dúvidas, sugestões
                <br />
                ou implementação
              </h2>
              <p style={{ opacity: 0.6, margin: "8px 0 18px" }}>
                Nossos contatos:
              </p>
              <div className="tv-contacts">
                <div className="tv-pcard">
                  <img
                    className="tv-ava"
                    src="/capitulos/fotosDevs/pedro.svg"
                    alt="Pedro Bossle"
                    width={120}
                    height={150}
                  />
                  <div className="nm">Pedro Bossle</div>
                  <div className="rl">Programador e idealizador</div>
                  <a href="https://wa.me/5554996742031">(54) 9.9674-2031</a>
                  <a href="mailto:pedro.bossle.s@gmail.com">
                    pedro.bossle.s@gmail.com
                  </a>
                </div>
                <div className="tv-pcard">
                  <img
                    className="tv-ava"
                    src="/capitulos/fotosDevs/lucas.svg"
                    alt="Lucas Borges"
                    width={120}
                    height={150}
                  />
                  <div className="nm">Lucas Borges</div>
                  <div className="rl">Programador e idealizador</div>
                  <a href="https://wa.me/5554984101106">(54) 9.8410-1106</a>
                  <a href="mailto:lucasboeiraborges@gmail.com">
                    lucasboeiraborges@gmail.com
                  </a>
                </div>
              </div>
              <div style={{ marginTop: 28, textAlign: "center" }}>
                <Link
                  to="/auth/adicionar-organizacao"
                  className="tv-btn tv-btn-navy"
                >
                  Quero adicionar minha organização
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="tv-foot">
        <a className="tv-brand" href="#top">
          <img src="/favicon-white.svg" alt="" width={28} height={28} />
          <span>
            Templo <em>Virtual</em>
          </span>
        </a>
        <span>
          Gestão para ordens paramaçônicas e lojas maçônicas · Caxias do Sul, RS
        </span>
        <a href="/documentacao" style={{ color: "var(--gold)" }}>
          Documentação
        </a>
      </footer>
    </div>
  );
}
