import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { REALM_CARD_BLURB, REALMS, realmEntryUrl, type Realm } from "@/lib/realm";
import { getSupademoDemoId, supademoEmbedUrl, type SupademoSlotId } from "@/lib/supademo";
import { cn } from "@/lib/utils";
import { useHubHostGuard } from "@/components/hub/useHubSession";
import "./hub-landing.css";

const PIX_KEY = "pix@templovirtual.com.br";
const GITHUB_URL = "https://github.com/farrapos1111/sgc-dm";
const JOIN_PATH = "/auth/adicionar-organizacao";

const NAV_LINKS = [
  { href: "#ordens", label: "Ordens" },
  { href: "#sistema", label: "O sistema" },
  { href: "#cronograma", label: "Cronograma" },
  { href: "#valor", label: "Valor" },
  { href: "#apoiar", label: "Apoiar" },
  { href: "#contato", label: "Contato" },
] as const;

const REALM_INFO: Record<Realm, { name: string; emblem: string }> = {
  odm: { name: "Ordem DeMolay", emblem: "/esferas/odm.webp" },
  fdj: { name: "Filhas de Jó", emblem: "/esferas/fdj.webp" },
  loja: { name: "Lojas Maçônicas", emblem: "/esferas/loja.webp" },
};

type Module = {
  slot: SupademoSlotId;
  tab: string;
  title: string;
  text: string;
  points: string[];
};

const MODULES: Module[] = [
  {
    slot: "overview",
    tab: "Início",
    title: "O dia da sua organização numa tela",
    text: "O painel abre com o que importa agora: próximo compromisso, saldo do mês, mensalidades pendentes e aniversariantes.",
    points: [
      "Chave do dia para registrar presença",
      "Saldo do mês vindo direto do fluxo de caixa",
      "Aniversariantes e próximos eventos",
    ],
  },
  {
    slot: "secretaria",
    tab: "Secretaria",
    title: "Membros, atas e ofícios sem papelada",
    text: "O cadastro de cada membro concentra o histórico. Atas e ofícios ficam organizados e fáceis de encontrar.",
    points: [
      "Cadastro completo de membros",
      "Atas e ofícios com numeração",
      "Frequência de cada reunião",
    ],
  },
  {
    slot: "tesouraria",
    tab: "Tesouraria",
    title: "Caixa e mensalidades em dia",
    text: "Lance entradas e saídas, acompanhe quem está em dia e gere relatórios para prestar contas.",
    points: [
      "Fluxo de caixa com relatórios",
      "Mensalidades por competência",
      "Cobranças para quem está pendente",
    ],
  },
  {
    slot: "gestao",
    tab: "Gestão",
    title: "Calendário e nominata da gestão",
    text: "Planeje a gestão com o calendário compartilhado e mantenha a nominata de cada período registrada.",
    points: ["Calendário com convites", "Nominata por gestão", "Chave do dia para cada reunião"],
  },
  {
    slot: "comissoes",
    tab: "Comissões",
    title: "Eventos e comissões organizados",
    text: "Cada comissão tem seu espaço: eventos, manutenção, novos membros e hospitalaria.",
    points: [
      "Comandas virtuais nos eventos",
      "Fichas de indicação",
      "Questionários de sindicância",
    ],
  },
];

const PILLARS = [
  {
    title: "Acessibilidade",
    text: "Todo mundo consegue usar. Poucos cliques, pensado primeiro para o celular.",
  },
  {
    title: "Transparência",
    text: "Código aberto, com espaço para quem quiser olhar, sugerir ou contribuir.",
  },
  {
    title: "Otimização",
    text: "Rápido de operar, com respostas instantâneas mesmo em conexão fraca.",
  },
] as const;

const ROADMAP = [
  { state: "done", label: "Concluída", text: "Escopo inicial e montagem do projeto base." },
  {
    state: "done",
    label: "Concluída",
    text: "Validação no dia a dia do Capítulo Farrapos nº 1111.",
  },
  {
    state: "now",
    label: "Em andamento",
    text: "Testes com outras paramaçônicas, ouvindo as necessidades de cada uma.",
  },
  {
    state: "next",
    label: "Próxima",
    text: "Implementar o que surgir dos testes e modularizar por organização.",
  },
  {
    state: "next",
    label: "Próxima",
    text: "Expansão para o restante do estado e versão como app de celular.",
  },
] as const;

const STEPS = [
  "Solicite a inclusão da organização e o cadastro da liderança (MC, HR ou VM).",
  "Com o primeiro acesso, cadastre os demais membros e o calendário.",
  "Configure a tesouraria, a secretaria e as outras áreas.",
  "Use no dia a dia e envie sugestões de melhoria.",
] as const;

const FAQ = [
  {
    q: "Quanto custa para uma paramaçônica?",
    a: "Nada. Capítulos, Bethéis e demais paramaçônicas usam a plataforma inteira de graça.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O sistema foi desenhado primeiro para o celular e funciona igual no computador.",
  },
  {
    q: "Como posso contribuir?",
    a: "Com sugestões, doações via Pix ou entrando na comissão de Tecnologia e Inovação. As três formas estão em Apoiar o projeto.",
  },
  {
    q: "Existe uma comissão de Tecnologia?",
    a: "Sim. Se você tem interesse e conhecimento, peça para entrar pelos contatos desta página.",
  },
] as const;

const CONTACTS = [
  {
    name: "Pedro Bossle",
    photo: "/capitulos/fotosDevs/pedro.svg",
    phone: "(54) 9.9674-2031",
    wa: "https://wa.me/5554996742031",
    email: "pedro.bossle.s@gmail.com",
  },
  {
    name: "Lucas Borges",
    photo: "/capitulos/fotosDevs/lucas.svg",
    phone: "(54) 9.8410-1106",
    wa: "https://wa.me/5554984101106",
    email: "lucasboeiraborges@gmail.com",
  },
] as const;

function Mark({ size = 32 }: { size?: number }) {
  return <img src="/favicon-white.svg" alt="" width={size} height={size} />;
}

/** Coluna clássica em traço — ícone dos três pilares. */
function ColumnIcon() {
  return (
    <svg
      className="tv-col-icon"
      viewBox="0 0 48 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 6h40M8 12h32M10 12c0 4-4 4-4 8M38 12c0 4 4 4 4 8M6 20h36" />
      <path d="M12 20v62M20 20v62M28 20v62M36 20v62" />
      <path d="M8 82h32M4 90h40" />
    </svg>
  );
}

function ModuleShowcase() {
  const [active, setActive] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const mod = MODULES[active];
  const demoId = getSupademoDemoId(mod.slot);

  function select(i: number) {
    setActive(i);
    setDemoOpen(false);
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const last = MODULES.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    const btn = tabsRef.current[next];
    btn?.focus();
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  return (
    <div className="tv-show">
      <div className="tv-tabs" role="tablist" aria-label="Módulos do sistema" onKeyDown={onKey}>
        {MODULES.map((m, i) => (
          <button
            key={m.slot}
            ref={(el) => {
              tabsRef.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tv-tab-${m.slot}`}
            aria-selected={i === active}
            aria-controls="tv-panel"
            tabIndex={i === active ? 0 : -1}
            className={cn("tv-tab", i === active && "is-on")}
            onClick={() => select(i)}
          >
            {m.tab}
          </button>
        ))}
      </div>

      <div
        className="tv-panel"
        id="tv-panel"
        role="tabpanel"
        aria-labelledby={`tv-tab-${mod.slot}`}
      >
        <div className="tv-panel-text" key={mod.slot}>
          <h3>{mod.title}</h3>
          <p>{mod.text}</p>
          <ul className="tv-checks">
            {mod.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {demoId && !demoOpen ? (
            <button type="button" className="tv-btn tv-btn-line" onClick={() => setDemoOpen(true)}>
              Abrir demonstração interativa
            </button>
          ) : null}
        </div>
        <figure className="tv-screen">
          <div className="tv-screen-bar" aria-hidden>
            <i />
            <i />
            <i />
            <span>templovirtual.app</span>
          </div>
          <div className="tv-screen-view">
            {demoId && demoOpen ? (
              <iframe
                src={supademoEmbedUrl(demoId)}
                title={`Demonstração: ${mod.tab}`}
                loading="lazy"
                allow="clipboard-write; fullscreen"
                allowFullScreen
              />
            ) : (
              <img
                key={mod.slot}
                src={`/shots/${mod.slot}.png`}
                alt={`Tela de ${mod.tab} do Templo Virtual`}
                width={1467}
                height={802}
                loading={active === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            )}
          </div>
        </figure>
      </div>
    </div>
  );
}

export function HubLanding() {
  useHubHostGuard();
  const heroRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navStuck, setNavStuck] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setNavStuck(window.scrollY > 16);
      const h = heroRef.current?.offsetHeight ?? 600;
      setPastHero(window.scrollY > h * 0.75);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
    window.setTimeout(() => setPixCopied(false), 2400);
  }

  const close = () => setMenuOpen(false);

  return (
    <div className="tv-hub">
      <a className="tv-skip" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className={cn("tv-nav", navStuck && "is-stuck", menuOpen && "is-open")}>
        <a className="tv-brand" href="#top" onClick={close}>
          <Mark size={30} />
          <span>Templo Virtual</span>
        </a>
        <nav className="tv-nav-links" aria-label="Seções da página">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="tv-nav-actions">
          <Link to="/auth" className="tv-btn tv-btn-ghost tv-btn-sm">
            Entrar
          </Link>
          <Link to={JOIN_PATH} className="tv-btn tv-btn-gold tv-btn-sm tv-hide-sm">
            Solicitar acesso
          </Link>
          <button
            type="button"
            className="tv-burger"
            aria-expanded={menuOpen}
            aria-controls="tv-menu"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        id="tv-menu"
        className={cn("tv-menu", menuOpen && "is-open")}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <nav aria-label="Menu">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="tv-menu-cta">
          <Link to={JOIN_PATH} className="tv-btn tv-btn-gold tv-btn-block">
            Solicitar acesso
          </Link>
          <Link to="/auth" className="tv-btn tv-btn-ghost tv-btn-block">
            Entrar na minha conta
          </Link>
        </div>
      </div>

      {/* ---------- Hero: o pavimento mosaico ---------- */}
      <section className="tv-hero" id="top" ref={heroRef}>
        <div className="tv-hero-in">
          <img className="tv-hero-mark" src="/favicon-white.svg" alt="" width={72} height={72} />
          <h1>Templo Virtual</h1>
          <p className="tv-hero-sub">
            Secretaria, tesouraria, calendário e comissões da sua ordem paramaçônica ou loja
            maçônica, num só lugar.
          </p>
          <div className="tv-hero-cta">
            <Link to={JOIN_PATH} className="tv-btn tv-btn-gold">
              Solicitar acesso
            </Link>
            <a className="tv-btn tv-btn-ghost" href="#sistema">
              Ver o sistema
            </a>
          </div>
          <ul className="tv-hero-facts">
            <li>Gratuito para paramaçônicas</li>
            <li>Código aberto</li>
            <li>Feito para o celular</li>
          </ul>
        </div>
        <div className="tv-floor" aria-hidden>
          <div className="tv-floor-plane" />
        </div>
      </section>

      <main id="conteudo">
        {/* ---------- Ordens ---------- */}
        <section className="tv-sec tv-marble" id="ordens">
          <div className="tv-wrap">
            <div className="tv-head">
              <h2>Escolha a sua ordem</h2>
              <p>
                Cada ordem tem o próprio ambiente, com os módulos que a rotina dela usa. Entre pelo
                seu.
              </p>
            </div>
            <div className="tv-realms">
              {REALMS.map((realm) => (
                <a key={realm} className="tv-realm" href={realmEntryUrl(realm)}>
                  <span className="tv-realm-emblem">
                    <img
                      src={REALM_INFO[realm].emblem}
                      alt=""
                      width={120}
                      height={120}
                      loading="lazy"
                    />
                  </span>
                  <span className="tv-realm-body">
                    <strong>{REALM_INFO[realm].name}</strong>
                    <span>{REALM_CARD_BLURB[realm]}</span>
                    <span className="tv-realm-host">{realm}.templovirtual.app</span>
                  </span>
                  <svg
                    className="tv-realm-go"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              ))}
            </div>
            <p className="tv-soon">
              Ordem do Arco-Íris e Ação Paramaçônica Juvenil estão a caminho.
            </p>
          </div>
        </section>

        {/* ---------- Sistema ---------- */}
        <section className="tv-sec tv-night" id="sistema">
          <div className="tv-wrap">
            <div className="tv-head tv-head-light">
              <h2>Por dentro do sistema</h2>
              <p>
                Telas reais do Capítulo Farrapos nº 1111, que usa o Templo Virtual no dia a dia.
              </p>
            </div>
            <ModuleShowcase />
          </div>
        </section>

        {/* ---------- Pilares ---------- */}
        <section className="tv-sec tv-marble" id="pilares">
          <div className="tv-wrap">
            <div className="tv-head">
              <h2>Três colunas sustentam o projeto</h2>
            </div>
            <div className="tv-pillars">
              {PILLARS.map((p) => (
                <article key={p.title} className="tv-pillar">
                  <ColumnIcon />
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Cronograma ---------- */}
        <section className="tv-sec tv-paper" id="cronograma">
          <div className="tv-wrap">
            <div className="tv-head">
              <h2>Cronograma</h2>
              <p>Onde o projeto está e para onde vai.</p>
            </div>
            <ol className="tv-road">
              {ROADMAP.map((r, i) => (
                <li key={r.text} className={cn("tv-road-step", `is-${r.state}`)}>
                  <span className="tv-road-dot" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="tv-road-label">{r.label}</span>
                  <p>{r.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Valor + Como começar ---------- */}
        <section className="tv-sec tv-indigo" id="valor">
          <div className="tv-wrap tv-split">
            <div>
              <div className="tv-head tv-head-light tv-head-left">
                <h2>Quanto custa</h2>
              </div>
              <div className="tv-prices">
                <div className="tv-price">
                  <div>
                    <h3>Paramaçônicas</h3>
                    <p>
                      DeMolay, Filhas de Jó e APJ. A plataforma inteira, com os módulos que a sua
                      rotina pede.
                    </p>
                  </div>
                  <strong>Grátis</strong>
                </div>
                <div className="tv-price">
                  <div>
                    <h3>Lojas maçônicas</h3>
                    <p>Analisamos juntos os módulos necessários e ajustamos às demandas da Loja.</p>
                  </div>
                  <strong className="tv-price-talk">Sob consulta</strong>
                </div>
              </div>
            </div>
            <div id="iniciar">
              <div className="tv-head tv-head-light tv-head-left">
                <h2>Como começar</h2>
              </div>
              <ol className="tv-steps">
                {STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="tv-row">
                <Link to={JOIN_PATH} className="tv-btn tv-btn-gold">
                  Solicitar inclusão
                </Link>
                <a className="tv-btn tv-btn-ghost" href="#contato">
                  Falar com a equipe
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Apoiar ---------- */}
        <section className="tv-sec tv-marble" id="apoiar">
          <div className="tv-wrap">
            <div className="tv-head">
              <h2>Ajude a manter o Templo no ar</h2>
              <p>
                É gratuito para as paramaçônicas e vai continuar assim. Os custos são servidor,
                domínio, backups e envio de mensagens.
              </p>
            </div>
            <div className="tv-support">
              <div className="tv-pix">
                <h3>Doe via Pix</h3>
                <p>
                  Qualquer valor vai direto para o custeio da plataforma. Sem cadastro e sem valor
                  mínimo.
                </p>
                <div className="tv-pix-box">
                  <code>{PIX_KEY}</code>
                  <button
                    type="button"
                    className="tv-btn tv-btn-gold"
                    onClick={() => void copyPix()}
                  >
                    {pixCopied ? "Chave copiada" : "Copiar chave Pix"}
                  </button>
                </div>
                <span className="tv-sr" aria-live="polite">
                  {pixCopied ? "Chave Pix copiada" : ""}
                </span>
              </div>
              <div className="tv-way">
                <h3>Contribua com código</h3>
                <p>
                  O repositório é público: TanStack Start, TypeScript e Supabase. Abra uma issue ou
                  mande um pull request.
                </p>
                <a className="tv-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
                  Ver repositório no GitHub
                </a>
              </div>
              <div className="tv-way">
                <h3>Doe seu tempo</h3>
                <p>
                  Indique o sistema para outra organização, relate um erro ou ofereça horas de
                  design, texto ou suporte.
                </p>
                <a className="tv-link" href="#contato">
                  Enviar uma sugestão
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ + Contato ---------- */}
        <section className="tv-sec tv-paper" id="contato">
          <div className="tv-wrap tv-split">
            <div>
              <div className="tv-head tv-head-left">
                <h2>Perguntas frequentes</h2>
              </div>
              <div className="tv-faq">
                {FAQ.map((f, i) => (
                  <details key={f.q} open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div>
              <div className="tv-head tv-head-left">
                <h2>Fale com a gente</h2>
                <p>Dúvidas, sugestões ou implantação na sua organização.</p>
              </div>
              <div className="tv-people">
                {CONTACTS.map((c) => (
                  <div key={c.name} className="tv-person">
                    <img src={c.photo} alt="" width={64} height={64} loading="lazy" />
                    <div>
                      <strong>{c.name}</strong>
                      <span>Programador e idealizador</span>
                      <a href={c.wa} target="_blank" rel="noreferrer">
                        WhatsApp {c.phone}
                      </a>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </div>
                  </div>
                ))}
              </div>
              <Link to={JOIN_PATH} className="tv-btn tv-btn-navy tv-btn-block">
                Quero adicionar minha organização
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="tv-foot">
        <div className="tv-foot-band" aria-hidden />
        <div className="tv-wrap tv-foot-in">
          <a className="tv-brand" href="#top">
            <Mark size={26} />
            <span>Templo Virtual</span>
          </a>
          <p>Gestão para ordens paramaçônicas e lojas maçônicas. Caxias do Sul, RS.</p>
          <nav aria-label="Rodapé">
            <a href="/documentacao">Documentação</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link to="/auth">Entrar</Link>
          </nav>
        </div>
      </footer>

      <div
        className={cn("tv-dock", pastHero && !menuOpen && "is-on")}
        aria-hidden={!pastHero}
        inert={!pastHero}
      >
        <Link to="/auth" className="tv-btn tv-btn-ghost">
          Entrar
        </Link>
        <Link to={JOIN_PATH} className="tv-btn tv-btn-gold">
          Solicitar acesso
        </Link>
      </div>
    </div>
  );
}
