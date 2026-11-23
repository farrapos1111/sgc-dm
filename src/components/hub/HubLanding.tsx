import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { REALM_CARD_BLURB, REALMS, realmEntryUrl, type Realm } from "@/lib/realm";
import { getSupademoDemoId, supademoEmbedUrl, type SupademoSlotId } from "@/lib/supademo";
import { cn } from "@/lib/utils";
import { useHubHostGuard } from "@/components/hub/useHubSession";
import "./hub-landing.css";

const GITHUB_URL = "https://github.com/farrapos1111/sgc-dm";
const JOIN_PATH = "/auth/adicionar-organizacao";
const PIX_KEY = "pix@templovirtual.com.br";

const NAV_LINKS = [
  { href: "#ordens", label: "Ordens" },
  { href: "#sistema", label: "O sistema" },
  { href: "#plataforma", label: "Plataforma" },
  { href: "#valor", label: "Valor" },
  { href: "#contato", label: "Contato" },
] as const;

const REALM_INFO: Record<Realm, { name: string; emblem: string }> = {
  odm: { name: "Ordem DeMolay", emblem: "/esferas/odm.webp" },
  fdj: { name: "Filhas de Jó", emblem: "/esferas/fdj.webp" },
  loja: { name: "Lojas Maçônicas", emblem: "/esferas/loja.webp" },
};

type Shot = { src: string; label: string };

type Module = {
  slot: SupademoSlotId;
  tab: string;
  title: string;
  text: string;
  points: string[];
  shots: Shot[];
};

const MODULES: Module[] = [
  {
    slot: "overview",
    tab: "Início",
    title: "O dia da organização numa tela",
    text: "O painel abre com o que importa agora: próximo compromisso, saldo do mês, mensalidades pendentes e aniversariantes.",
    points: [
      "Chave do dia para registrar presença",
      "Saldo do mês vindo direto do fluxo de caixa",
      "Aniversariantes e próximos eventos",
    ],
    shots: [{ src: "/shots/overview.png", label: "Painel inicial" }],
  },
  {
    slot: "secretaria",
    tab: "Secretaria",
    title: "Membros, atas, ofícios e frequência",
    text: "O cadastro de cada membro concentra o histórico. A frequência é lançada por reunião, com justificativa para as ausências.",
    points: [
      "Cadastro completo de membros",
      "Atas e ofícios com numeração",
      "Frequência com justificativas",
    ],
    shots: [{ src: "/shots/secretaria.png", label: "Frequência" }],
  },
  {
    slot: "tesouraria",
    tab: "Tesouraria",
    title: "Caixa e mensalidades em dia",
    text: "Entradas e saídas organizadas por categoria e a situação de cada membro mês a mês, prontas para a prestação de contas.",
    points: [
      "Fluxo de caixa com exportação em Excel e PDF",
      "Mensalidades por competência",
      "Controle de atrasos e cobranças",
    ],
    shots: [
      { src: "/shots/tesouraria.png", label: "Fluxo de caixa" },
      { src: "/shots/Mensalidades.png", label: "Mensalidades" },
    ],
  },
  {
    slot: "gestao",
    tab: "Gestão",
    title: "Calendário, cargos e comissões",
    text: "O calendário da gestão destaca as datas obrigatórias da ordem. Cargos e comissões ficam registrados por período.",
    points: [
      "Calendário com datas obrigatórias",
      "Cargos e comissões por gestão",
      "Chave do dia para cada reunião",
    ],
    shots: [{ src: "/shots/gestao.png", label: "Calendário" }],
  },
  {
    slot: "comissoes",
    tab: "Eventos",
    title: "Eventos, ingressos e comandas",
    text: "A comissão de eventos controla ingressos, consumo e caixa do evento, com recibo e Pix na hora.",
    points: [
      "Ingressos e check-in por QR Code",
      "Comandas virtuais com recibo",
      "Financeiro do evento integrado ao caixa",
    ],
    shots: [{ src: "/shots/comissoes.png", label: "Comanda de evento" }],
  },
];

const PILLARS = [
  {
    title: "Acessibilidade",
    text: "Qualquer membro da administração opera o sistema, do celular ou do computador, com poucos cliques.",
  },
  {
    title: "Transparência",
    text: "Código aberto e registros de cada alteração, para que a prestação de contas seja simples.",
  },
  {
    title: "Otimização",
    text: "Tarefas de secretaria e tesouraria que levavam horas são resolvidas em minutos.",
  },
] as const;

const GOVERNANCE: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "Acesso por cargo",
    text: "Cada pessoa vê e altera apenas o que o seu cargo permite. A troca de gestão atualiza as permissões.",
    icon: <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />,
  },
  {
    title: "Dados separados por organização",
    text: "Cada instituição tem o próprio espaço. Nenhuma organização enxerga os dados de outra.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="7" rx="1.5" />
        <rect x="3" y="13" width="18" height="7" rx="1.5" />
      </>
    ),
  },
  {
    title: "Histórico de alterações",
    text: "Lançamentos financeiros e comandas guardam quem fez cada mudança e quando.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    title: "Código aberto",
    text: "O código-fonte é público e pode ser auditado por qualquer pessoa ou instituição.",
    icon: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  },
];

const STEPS = [
  "A liderança solicita a inclusão da organização (MC, HR, VM ou equivalente).",
  "Após a aprovação, a administração cadastra os membros e o calendário.",
  "Tesouraria, secretaria e demais áreas são configuradas conforme a rotina.",
  "A equipe acompanha a implantação e recebe sugestões de melhoria.",
] as const;

const FAQ = [
  {
    q: "Quais ordens são atendidas?",
    a: "Ordem DeMolay (Capítulos, Colégios Alumni, Castelos e Priorados), Filhas de Jó, Estrela do Oriente e Lojas Maçônicas. Ordem do Arco-Íris e Ação Paramaçônica Juvenil estão em implantação.",
  },
  {
    q: "Quanto custa para uma organização paramaçônica?",
    a: "Nada. Organizações paramaçônicas usam a plataforma inteira sem custo. Para Lojas Maçônicas, o escopo é definido em conjunto.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O sistema foi desenhado primeiro para o celular e funciona da mesma forma no computador.",
  },
  {
    q: "Como os dados são protegidos?",
    a: "O acesso é individual e limitado pelo cargo de cada pessoa, os dados de cada organização ficam separados e as alterações relevantes ficam registradas.",
  },
  {
    q: "Como apoiar a manutenção da plataforma?",
    a: `Organizações e pessoas que quiserem contribuir com os custos de servidor e domínio podem fazer uma doação via Pix para ${PIX_KEY}. Contribuições de código são bem-vindas no repositório público.`,
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

/** Emblema da Estrela do Oriente: estrela de cinco pontas invertida com as cinco cores. */
function EasternStarEmblem() {
  const R = 46;
  const r = 19;
  const cx = 50;
  const cy = 52;
  // Ponta de baixo azul; em sentido horário: amarelo, branco, verde e vermelho.
  const colors = ["#2a5bd7", "#f2c230", "#f2f2f2", "#1f8a4c", "#c8262e"];
  const pt = (rad: number, ang: number) =>
    `${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`;
  const points = colors.map((color, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const step = Math.PI / 5;
    return { color, d: `M${cx},${cy} L${pt(r, a - step)} L${pt(R, a)} L${pt(r, a + step)} Z` };
  });
  const pent = colors
    .map((_, i) => pt(r, Math.PI / 2 + Math.PI / 5 + (i * 2 * Math.PI) / 5))
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden>
      {points.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} stroke="#8a6d1d" strokeWidth="1.2" />
      ))}
      <polygon points={pent} fill="#13306e" stroke="#c9a227" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r="5" fill="#c9a227" />
    </svg>
  );
}

/** Coluna clássica em traço: ícone dos três pilares. */
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
  const [shotIdx, setShotIdx] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const mod = MODULES[active];
  const shot = mod.shots[shotIdx] ?? mod.shots[0];
  const demoId = getSupademoDemoId(mod.slot);

  function select(i: number) {
    setActive(i);
    setShotIdx(0);
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
                key={shot.src}
                src={shot.src}
                alt={`Tela de ${shot.label} no Templo Virtual`}
                width={1467}
                height={802}
                loading={active === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            )}
          </div>
          <figcaption>
            {mod.shots.length > 1 ? (
              <span className="tv-shot-switch" role="group" aria-label="Telas do módulo">
                {mod.shots.map((s, i) => (
                  <button
                    key={s.src}
                    type="button"
                    aria-pressed={i === shotIdx}
                    className={cn(i === shotIdx && "is-on")}
                    onClick={() => {
                      setShotIdx(i);
                      setDemoOpen(false);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </span>
            ) : (
              <span>{shot.label}</span>
            )}
            <span className="tv-screen-src">Capítulo Farrapos nº 1111</span>
          </figcaption>
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
            Plataforma de gestão para ordens paramaçônicas e lojas maçônicas: secretaria,
            tesouraria, calendário e comissões num só lugar.
          </p>
          <div className="tv-hero-cta">
            <Link to={JOIN_PATH} className="tv-btn tv-btn-gold">
              Solicitar acesso
            </Link>
            <a className="tv-btn tv-btn-ghost" href="#sistema">
              Conhecer o sistema
            </a>
          </div>
          <ul className="tv-hero-facts">
            <li>Sem custo para paramaçônicas</li>
            <li>Acesso por cargo</li>
            <li>Celular e computador</li>
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
                Cada ordem tem o próprio ambiente, com os cargos, ritos e módulos que a sua rotina
                usa.
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
                  <RealmArrow />
                </a>
              ))}
              <Link to={JOIN_PATH} className="tv-realm">
                <span className="tv-realm-emblem">
                  <EasternStarEmblem />
                </span>
                <span className="tv-realm-body">
                  <strong>Estrela do Oriente</strong>
                  <span>Gestão para Capítulos da Ordem da Estrela do Oriente.</span>
                  <span className="tv-realm-host">Implantação mediante solicitação</span>
                </span>
                <RealmArrow />
              </Link>
            </div>
            <p className="tv-soon">
              Ordem do Arco-Íris e Ação Paramaçônica Juvenil estão em implantação.
            </p>
          </div>
        </section>

        {/* ---------- Sistema ---------- */}
        <section className="tv-sec tv-night" id="sistema">
          <div className="tv-wrap">
            <div className="tv-head tv-head-light">
              <h2>Por dentro do sistema</h2>
              <p>Telas do Templo Virtual em uso real, com os dados de uma organização ativa.</p>
            </div>
            <ModuleShowcase />
          </div>
        </section>

        {/* ---------- Plataforma ---------- */}
        <section className="tv-sec tv-marble" id="plataforma">
          <div className="tv-wrap">
            <div className="tv-head">
              <h2>Três colunas sustentam a plataforma</h2>
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

        <section className="tv-sec tv-paper" id="seguranca">
          <div className="tv-wrap tv-split tv-split-gov">
            <div className="tv-head tv-head-left">
              <h2>Segurança e governança</h2>
              <p>
                Informações de membros e finanças pedem cuidado. A plataforma foi construída para
                que cada organização tenha controle sobre quem acessa o quê.
              </p>
              <a className="tv-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
                Ver o código-fonte no GitHub
              </a>
            </div>
            <ul className="tv-gov">
              {GOVERNANCE.map((g) => (
                <li key={g.title}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {g.icon}
                  </svg>
                  <div>
                    <h3>{g.title}</h3>
                    <p>{g.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Valor + Implantação ---------- */}
        <section className="tv-sec tv-indigo" id="valor">
          <div className="tv-wrap tv-split">
            <div>
              <div className="tv-head tv-head-light tv-head-left">
                <h2>Investimento</h2>
              </div>
              <div className="tv-prices">
                <div className="tv-price">
                  <div>
                    <h3>Organizações paramaçônicas</h3>
                    <p>
                      Capítulos, Bethéis e demais paramaçônicas. A plataforma inteira, com os
                      módulos que a rotina pede.
                    </p>
                  </div>
                  <strong>Sem custo</strong>
                </div>
                <div className="tv-price">
                  <div>
                    <h3>Lojas maçônicas</h3>
                    <p>Escopo definido em conjunto com a Loja, a partir dos módulos necessários.</p>
                  </div>
                  <strong className="tv-price-talk">Sob consulta</strong>
                </div>
              </div>
            </div>
            <div id="iniciar">
              <div className="tv-head tv-head-light tv-head-left">
                <h2>Implantação</h2>
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

        {/* ---------- FAQ + Contato ---------- */}
        <section className="tv-sec tv-marble" id="contato">
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
                <h2>Fale com a equipe</h2>
                <p>Dúvidas, demonstrações ou implantação na sua organização.</p>
              </div>
              <div className="tv-people">
                {CONTACTS.map((c) => (
                  <div key={c.name} className="tv-person">
                    <img src={c.photo} alt="" width={64} height={64} loading="lazy" />
                    <div>
                      <strong>{c.name}</strong>
                      <span>Fundador e desenvolvedor</span>
                      <a href={c.wa} target="_blank" rel="noreferrer">
                        WhatsApp {c.phone}
                      </a>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </div>
                  </div>
                ))}
              </div>
              <Link to={JOIN_PATH} className="tv-btn tv-btn-navy tv-btn-block">
                Solicitar inclusão da minha organização
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
          <p>
            Plataforma de gestão para ordens paramaçônicas e lojas maçônicas. Caxias do Sul, RS.
          </p>
          <nav aria-label="Rodapé">
            <a href="/documentacao">Documentação</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Código-fonte
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

function RealmArrow() {
  return (
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
  );
}
