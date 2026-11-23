import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Gavel,
  Home,
  LayoutGrid,
  LogOut,
  MapPin,
  Plus,
  Receipt,
  RotateCcw,
  Ticket,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HomeView, type HomeViewProps } from "@/components/home/HomeView";
import { cn } from "@/lib/utils";
import {
  brl,
  DEMO_TODAY,
  DUE_META,
  EVENT_COLORS,
  initialDues,
  initials,
  MONTHS_LONG,
  MONTHS_SHORT,
  ORG_KINDS,
  ORGS,
  memberById,
  type CashEntry,
  type DemoEvent,
  type DemoOrg,
  type DueStatus,
  type Investigation,
  type OrgKind,
  type SocialEvent,
} from "./demo-data";
import {
  Avatar,
  Chip,
  FilterChips,
  Panel,
  PrimaryButton,
  ScreenHeader,
  SearchBox,
  SoftButton,
} from "./demo-ui";
import { fieldClass, notInDemo } from "./demo-helpers";
import { ProfileScreen } from "./DemoProfile";
import { EventsScreen } from "./DemoEvents";
import { InvestigationsScreen } from "./DemoInvestigations";
import "./demo.css";

export type DemoScreen =
  | "inicio"
  | "membros"
  | "perfil"
  | "chamada"
  | "sindicancias"
  | "caixa"
  | "mensalidades"
  | "calendario"
  | "eventos"
  | "mais";

const SCREENS: DemoScreen[] = [
  "inicio",
  "membros",
  "perfil",
  "chamada",
  "sindicancias",
  "caixa",
  "mensalidades",
  "calendario",
  "eventos",
  "mais",
];

type Route = { org: OrgKind; screen: DemoScreen; id: string | null };
type Go = (screen: DemoScreen, id?: string | null) => void;

type NavItem = { id: DemoScreen; label: string; icon: ComponentType<{ className?: string }> };

const NAV_SECTIONS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ id: "inicio", label: "Início", icon: Home }] },
  {
    label: "Secretaria",
    items: [
      { id: "membros", label: "Membros", icon: Users },
      { id: "chamada", label: "Chamada", icon: CheckSquare },
      { id: "sindicancias", label: "Sindicâncias", icon: Gavel },
    ],
  },
  {
    label: "Tesouraria",
    items: [
      { id: "caixa", label: "Fluxo de caixa", icon: Wallet },
      { id: "mensalidades", label: "Mensalidades", icon: Receipt },
    ],
  },
  { label: "Gestão", items: [{ id: "calendario", label: "Calendário", icon: CalendarDays }] },
  { label: "Comissões", items: [{ id: "eventos", label: "Eventos", icon: Ticket }] },
];

const MOBILE_TABS: (NavItem & { central?: boolean })[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "membros", label: "Membros", icon: Users },
  { id: "chamada", label: "Chamada", icon: CheckSquare, central: true },
  { id: "caixa", label: "Caixa", icon: Wallet },
  { id: "mais", label: "Mais", icon: LayoutGrid },
];

/** Rotas reais do app que, dentro da demonstração, viram telas locais. */
const LINK_TO_SCREEN: [string, DemoScreen][] = [
  ["/tesouraria/mensalidades", "mensalidades"],
  ["/tesouraria/fluxo", "caixa"],
  ["/sindicancias", "sindicancias"],
  ["/presencas", "chamada"],
  ["/membros", "membros"],
  ["/calendario", "calendario"],
  ["/eventos", "eventos"],
  ["/perfil", "perfil"],
];

function parseHash(): Route {
  const parts =
    typeof window === "undefined"
      ? []
      : window.location.hash.replace(/^#/, "").split("/").filter(Boolean);
  let org: OrgKind = "odm";
  if (parts[0] && (ORG_KINDS as string[]).includes(parts[0])) org = parts.shift() as OrgKind;
  const screen = SCREENS.includes(parts[0] as DemoScreen) ? (parts[0] as DemoScreen) : "inicio";
  return { org, screen, id: parts[1] ?? null };
}

function writeHash(r: Route) {
  window.history.replaceState(null, "", `#${r.org}/${r.screen}${r.id ? `/${r.id}` : ""}`);
}

/* ------------------------------------------------------------------ */

export function DemoApp() {
  const [route, setRoute] = useState<Route>({ org: "odm", screen: "inicio", id: null });
  const [resetKey, setResetKey] = useState(0);
  const [chooser, setChooser] = useState(false);
  const org = ORGS[route.org];

  useEffect(() => {
    setRoute(parseHash());
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Tema da organização no <html>, para valer também em diálogos (portal).
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.dataset.demoOrg = route.org;
    return () => {
      delete el.dataset.demoOrg;
    };
  }, [route.org]);

  const go: Go = (screen, id = null) => {
    const next = { ...route, screen, id };
    setRoute(next);
    writeHash(next);
    window.scrollTo({ top: 0 });
  };

  function switchOrg(kind: OrgKind) {
    setChooser(false);
    if (kind === route.org) return;
    // Perfis e sindicâncias abertas são de outra organização: volta para a lista.
    const keep: DemoScreen = route.screen === "perfil" ? "membros" : route.screen;
    const next: Route = { org: kind, screen: keep, id: null };
    setRoute(next);
    writeHash(next);
    toast(`Vendo como ${ORGS[kind].viewAs}`, {
      description: `${ORGS[kind].short}: membros, cargos e valores próprios.`,
    });
  }

  function reset() {
    setResetKey((k) => k + 1);
    toast.success("Demonstração reiniciada", {
      description: "Os dados fictícios voltaram ao estado inicial.",
    });
  }

  return (
    <div className="tv-demo min-h-screen bg-tv-bg font-sans text-tv-text">
      <DemoBanner org={org} onReset={reset} onSwitch={switchOrg} />
      <DemoWorkspace
        key={`${route.org}-${resetKey}`}
        org={org}
        route={route}
        go={go}
        openChooser={() => setChooser(true)}
      />
      <Dialog open={chooser} onOpenChange={setChooser}>
        <DialogContent className="rounded-[22px] border-0 bg-tv-surface p-5 text-tv-text sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Ver a demonstração como
            </DialogTitle>
            <DialogDescription className="text-tv-text-2">
              Cada organização tem cargos, graus, termos e valores próprios.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {ORG_KINDS.map((k) => {
              const o = ORGS[k];
              const on = k === route.org;
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => switchOrg(k)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[16px] border p-3 text-left",
                      on ? "border-tv-primary bg-tv-soft" : "border-tv-border hover:bg-tv-bg",
                    )}
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-white p-1.5">
                      <img src={o.emblem} alt="" className="h-full w-full object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{o.viewAs}</span>
                      <span className="block text-[13px] text-tv-text-2">{o.short}</span>
                    </span>
                    {on ? <Check className="h-5 w-5 text-tv-primary" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DemoBanner({
  org,
  onReset,
  onSwitch,
}: {
  org: DemoOrg;
  onReset: () => void;
  onSwitch: (k: OrgKind) => void;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-2 bg-[#17181A] px-3 text-sm text-white sm:px-5">
      <span className="hidden rounded-full bg-[#FFC72C] px-2.5 py-1 text-xs font-bold text-[#17181A] sm:inline">
        Demonstração
      </span>
      <label className="flex min-w-0 items-center gap-2">
        <span className="hidden text-white/70 md:inline">Ver como</span>
        <span className="sr-only md:hidden">Ver a demonstração como</span>
        <select
          value={org.kind}
          onChange={(e) => onSwitch(e.target.value as OrgKind)}
          className="min-h-9 min-w-0 max-w-[190px] rounded-[10px] border border-white/20 bg-white/10 px-2 font-semibold text-white outline-none [&>option]:text-[#17181A]"
        >
          {ORG_KINDS.map((k) => (
            <option key={k} value={k}>
              {ORGS[k].viewAs}
            </option>
          ))}
        </select>
      </label>
      <span className="hidden min-w-0 truncate text-white/70 xl:inline">
        Dados fictícios. Nada do que você fizer aqui é salvo.
      </span>
      <span className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className="flex min-h-9 items-center gap-1.5 rounded-[10px] px-2.5 font-semibold text-white/90 hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Recomeçar</span>
          <span className="sr-only sm:hidden">Recomeçar demonstração</span>
        </button>
        <Link
          to="/auth/adicionar-organizacao"
          className="hidden min-h-9 items-center rounded-[10px] bg-white px-3 font-semibold text-[#17181A] lg:flex"
        >
          Solicitar acesso
        </Link>
        <a
          href="/"
          className="flex min-h-9 items-center gap-1.5 rounded-[10px] px-2.5 font-semibold text-white/90 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair
        </a>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Marks = Record<string, "P" | "A" | "">;

function DemoWorkspace({
  org,
  route,
  go,
  openChooser,
}: {
  org: DemoOrg;
  route: Route;
  go: Go;
  openChooser: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [cash, setCash] = useState<CashEntry[]>(org.cash);
  const [dues, setDues] = useState<Record<string, DueStatus[]>>(() => initialDues(org));
  const [social, setSocial] = useState<SocialEvent>(org.social);
  const [investigations, setInvestigations] = useState<Investigation[]>(org.investigations);
  const [marks, setMarks] = useState<Marks>(() => {
    const m: Marks = {};
    org.members.forEach((mem, i) => {
      if (mem.status !== "Ativo") return;
      m[mem.id] = i < 8 ? (i % 4 === 3 ? "A" : "P") : "";
    });
    return m;
  });
  const [reasons, setReasons] = useState<Record<string, string>>({ m04: "Viagem com a família" });
  const [closed, setClosed] = useState(false);

  const totals = useMemo(() => {
    const inc = cash.filter((c) => c.type === "in").reduce((s, c) => s + c.value, 0);
    const out = cash.filter((c) => c.type === "out").reduce((s, c) => s + c.value, 0);
    const yearIn = org.yearBefore.in + inc;
    const yearOut = org.yearBefore.out + out;
    return {
      monthIn: inc,
      monthOut: out,
      yearIn,
      yearOut,
      balance: org.yearBefore.opening + yearIn - yearOut,
    };
  }, [cash, org]);

  const dueStats = useMemo(() => {
    let paid = 0;
    let open = 0;
    let late = 0;
    let pendingMembers = 0;
    for (const m of org.members) {
      let pending = false;
      for (const s of dues[m.id] ?? []) {
        if (s === "P") paid++;
        if (s === "A") {
          open++;
          pending = true;
        }
        if (s === "T") {
          late++;
          pending = true;
        }
      }
      if (pending) pendingMembers++;
    }
    const counted = paid + open + late;
    return {
      paid,
      open,
      late,
      pendingMembers,
      pct: counted ? Math.round((paid / counted) * 100) : 0,
    };
  }, [dues, org]);

  const openProfile = (id: string) => go("perfil", id);

  /** Links do HomeView (rotas do app real) viram navegação local. */
  function interceptLinks(e: MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest("a[href]");
    if (!a) return;
    e.preventDefault();
    const path = (a.getAttribute("href") ?? "").split("?")[0];
    const hit = LINK_TO_SCREEN.find(([p]) => path === p || path.startsWith(`${p}/`));
    if (!hit) return notInDemo();
    if (hit[1] === "perfil") go("perfil", org.user.memberId);
    else go(hit[1]);
  }

  let content: ReactNode;
  switch (route.screen) {
    case "inicio":
      content = (
        <div onClickCapture={interceptLinks}>
          <HomeView
            {...homeProps({
              org,
              hidden,
              setHidden,
              totals,
              dueStats,
              investigations,
              social,
              openChooser,
            })}
          />
        </div>
      );
      break;
    case "membros":
      content = <MembersScreen org={org} openProfile={openProfile} />;
      break;
    case "perfil": {
      const member =
        memberById(org, route.id ?? org.user.memberId) ?? memberById(org, org.user.memberId)!;
      const isMe = member.id === org.user.memberId;
      content = (
        <ProfileScreen
          org={org}
          member={member}
          dues={dues[member.id] ?? []}
          isMe={isMe}
          onBack={() => go(isMe ? "inicio" : "membros")}
        />
      );
      break;
    }
    case "chamada":
      content = (
        <AttendanceScreen
          org={org}
          marks={marks}
          setMarks={setMarks}
          reasons={reasons}
          setReasons={setReasons}
          closed={closed}
          setClosed={setClosed}
          openProfile={openProfile}
        />
      );
      break;
    case "sindicancias":
      content = (
        <InvestigationsScreen
          org={org}
          list={investigations}
          setList={setInvestigations}
          openId={route.id}
          setOpenId={(id) => go("sindicancias", id)}
          openProfile={openProfile}
        />
      );
      break;
    case "caixa":
      content = (
        <CashScreen
          org={org}
          cash={cash}
          setCash={setCash}
          totals={totals}
          hidden={hidden}
          setHidden={setHidden}
        />
      );
      break;
    case "mensalidades":
      content = (
        <DuesScreen
          org={org}
          dues={dues}
          setDues={setDues}
          stats={dueStats}
          openProfile={openProfile}
        />
      );
      break;
    case "calendario":
      content = <CalendarScreen org={org} />;
      break;
    case "eventos":
      content = <EventsScreen org={org} event={social} setEvent={setSocial} />;
      break;
    default:
      content = <MoreScreen org={org} go={go} openChooser={openChooser} />;
  }

  const wide = route.screen === "mensalidades" || route.screen === "caixa";

  return (
    <>
      <DemoSidebar org={org} route={route} go={go} openChooser={openChooser} />
      <div className="flex min-h-screen flex-col pt-12 md:pl-[264px]">
        <main className="relative flex-1 px-4 pb-28 pt-4 sm:px-6 md:px-8 md:pb-12 md:pt-6">
          <div className={cn("mx-auto w-full", wide ? "max-w-[1400px]" : "max-w-[1120px]")}>
            <div key={`${route.screen}-${route.id ?? ""}`} className="page-enter">
              {content}
            </div>
          </div>
        </main>
      </div>
      <DemoTabBar route={route} go={go} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function OrgMark({ org, className }: { org: DemoOrg; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center bg-white p-1", className)} aria-hidden>
      <img src={org.emblem} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

function DemoSidebar({
  org,
  route,
  go,
  openChooser,
}: {
  org: DemoOrg;
  route: Route;
  go: Go;
  openChooser: () => void;
}) {
  const me = memberById(org, org.user.memberId)!;
  return (
    <aside className="fixed bottom-0 left-0 top-12 z-30 hidden w-[264px] flex-col border-r border-[#E8E8E4] bg-tv-sidebar px-3.5 py-5 text-tv-text md:flex dark:border-tv-border">
      <button
        type="button"
        onClick={openChooser}
        className="flex items-center gap-2.5 rounded-[12px] px-1.5 py-1 text-left hover:bg-tv-bg"
        aria-label={`${org.short}. Trocar organização`}
      >
        <OrgMark org={org} className="h-10 w-10 rounded-[12px] border border-tv-border" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs font-medium text-tv-text-2">Templo Virtual</span>
          <span className="block truncate text-[15px] font-bold">
            {org.short.replace(`${org.orgType} `, "")}
          </span>
        </span>
        <ArrowLeftRight className="h-4 w-4 shrink-0 text-tv-text-2" aria-hidden />
      </button>

      <nav
        aria-label="Menu principal"
        className="-mx-1 mt-[18px] flex flex-1 flex-col gap-3.5 overflow-y-auto px-1"
      >
        {NAV_SECTIONS.map((sec) => (
          <div key={sec.label ?? "root"} className="flex flex-col gap-0.5">
            {sec.label ? (
              <span className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6E75] dark:text-tv-text-2">
                {sec.label}
              </span>
            ) : null}
            {sec.items.map((it) => {
              const on =
                it.id === route.screen ||
                (it.id === "membros" &&
                  route.screen === "perfil" &&
                  route.id !== org.user.memberId);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => go(it.id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-[42px] items-center gap-3 rounded-[10px] px-3 text-left text-[15px] transition-colors duration-150",
                    on
                      ? "bg-tv-soft font-bold text-tv-ink"
                      : "font-medium text-[#2A2C31] hover:bg-tv-bg dark:text-tv-text",
                  )}
                >
                  <it.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 truncate">{it.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-3.5 border-t border-[#EEEEEA] pt-3.5 dark:border-tv-border">
        <button
          type="button"
          onClick={() => go("perfil", me.id)}
          className="flex w-full items-center gap-2.5 rounded-[12px] p-1 text-left hover:bg-tv-bg"
        >
          <Avatar name={me.name} size={40} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{me.name}</span>
            <span className="block truncate text-xs text-tv-text-2">{org.user.role}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function DemoTabBar({ route, go }: { route: Route; go: Go }) {
  const inMais = !["inicio", "membros", "chamada", "caixa"].includes(route.screen);
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-start border-t border-[#E6E6E2] bg-tv-surface px-1.5 pt-2 md:hidden dark:border-tv-border"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      {MOBILE_TABS.map((tab) => {
        const on = tab.id === "mais" ? inMais : tab.id === route.screen;
        const Icon = tab.icon;
        if (tab.central) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              aria-current={on ? "page" : undefined}
              className="group -mt-[22px] flex flex-col items-center gap-1"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border-4 border-tv-surface bg-tv-primary text-white shadow-[0_6px_16px_rgba(20,20,20,0.18)] transition-transform group-active:scale-95">
                <Icon className="h-[26px] w-[26px]" />
              </span>
              <span
                className={cn("text-xs font-semibold", on ? "text-tv-primary" : "text-tv-text-2")}
              >
                {tab.label}
              </span>
            </button>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => go(tab.id)}
            aria-current={on ? "page" : undefined}
            className="group flex min-h-[52px] flex-col items-center justify-center gap-1"
          >
            <span
              className={cn(
                "grid h-[30px] w-[52px] place-items-center rounded-full transition-colors group-active:scale-90",
                on ? "bg-tv-soft text-tv-primary" : "text-tv-text-2",
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
            </span>
            <span
              className={cn(
                "text-xs",
                on ? "font-bold text-tv-primary" : "font-medium text-tv-text-2",
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Início (HomeView real com dados fictícios)                          */
/* ------------------------------------------------------------------ */

function homeProps({
  org,
  hidden,
  setHidden,
  totals,
  dueStats,
  investigations,
  social,
  openChooser,
}: {
  org: DemoOrg;
  hidden: boolean;
  setHidden: (fn: (v: boolean) => boolean) => void;
  totals: { monthIn: number; monthOut: number; balance: number };
  dueStats: { open: number; late: number; pendingMembers: number; pct: number };
  investigations: Investigation[];
  social: SocialEvent;
  openChooser: () => void;
}): HomeViewProps {
  const today = DEMO_TODAY.getDate();
  const me = memberById(org, org.user.memberId)!;
  const birthdays = org.members
    .filter((m) => m.birthday.endsWith("/11"))
    .map((m) => ({ m, day: Number(m.birthday.slice(0, 2)) }))
    .sort((a, b) => a.day - b.day)
    .map(({ m, day }) => ({
      id: m.id,
      initials: initials(m.name),
      name: m.name,
      info: `${day < today ? "fez" : "faz"} aniversário em ${m.birthday}`,
      today: day === today,
      past: day < today,
    }));
  const result = totals.monthIn - totals.monthOut;
  const nextEv = org.events.find((e) => e.day > today) ?? null;
  const open = investigations.filter((i) => i.status === "Em andamento");

  return {
    greeting: "Boa tarde",
    firstName: me.name.split(" ")[0],
    roleLine: `${org.user.role} · ${org.name}`,
    dateLine: "Segunda-feira, 23 de novembro de 2026",
    chapterLabel: org.short,
    chapterMark: <OrgMark org={org} className="h-full w-full rounded-full" />,
    onSwitchChapter: openChooser,
    switchLabel: "Trocar organização",
    hidden,
    onToggleHidden: () => setHidden((v) => !v),
    ongoing: [],
    sindicancias: open.map((i) => {
      const done = i.investigators.filter((x) => x.verdict).length;
      const mine = i.investigators.find((x) => x.memberId === org.user.memberId);
      return {
        id: i.id,
        title: `Sindicância de ${i.candidate}`,
        when: `Prazo até ${i.deadline}`,
        badge:
          mine && !mine.verdict
            ? "Falta o seu parecer"
            : `${done} de ${i.investigators.length} pareceres`,
        highlight: Boolean(mine && !mine.verdict),
      };
    }),
    next: nextEv
      ? {
          title: nextEv.title,
          typeLabel: nextEv.type,
          when: `${weekday(nextEv.day)}, ${String(nextEv.day).padStart(2, "0")}/11 · ${nextEv.time}`,
          inDays: `em ${nextEv.day - today} dias`,
          location: nextEv.place,
          copyLabel: "Copiar chave do dia",
          canCopy: true,
          onCopy: () =>
            toast.success("Chave do dia copiada", {
              description:
                "Na versão completa, os membros usam essa chave para registrar presença.",
            }),
          chamadaTo: "/presencas",
        }
      : null,
    shortcutsMobile: [
      { label: "Membros", to: "/membros", icon: Users },
      { label: "Chamada", to: "/presencas", icon: CheckSquare },
      { label: "Caixa", to: "/tesouraria/fluxo", icon: Wallet },
      { label: "Mensalidades", to: "/tesouraria/mensalidades", icon: Receipt },
      { label: "Calendário", to: "/calendario", icon: CalendarDays },
      { label: "Eventos", to: "/eventos", icon: Ticket },
      { label: "Sindicâncias", to: "/sindicancias", icon: Gavel },
      { label: "Perfil", to: "/perfil", icon: UserRound },
    ],
    shortcutsDesktop: [
      { label: "Chamada", to: "/presencas", icon: CheckSquare },
      { label: "Caixa", to: "/tesouraria/fluxo", icon: Wallet },
      { label: "Mensalidades", to: "/tesouraria/mensalidades", icon: Receipt },
      { label: "Eventos", to: "/eventos", icon: Ticket },
      { label: "Sindicâncias", to: "/sindicancias", icon: Gavel },
    ],
    finance: {
      saldo: brl(totals.balance),
      resultado: brl(result),
      resultadoNegative: result < 0,
      monthName: "novembro",
      entradas: brl(totals.monthIn),
      saidas: brl(totals.monthOut),
    },
    dues: {
      aberto: brl((dueStats.open + dueStats.late) * org.dueValue),
      atrasado: dueStats.late ? brl(dueStats.late * org.dueValue) : null,
      pendentes: dueStats.pendingMembers,
      pendingMembersLabel: `${dueStats.pendingMembers} ${org.memberWord.many} com pendência`,
      pctRecebido: dueStats.pct,
      year: 2026,
    },
    notices: [
      {
        id: "n1",
        label: "Mensalidades atrasadas",
        detail: `${dueStats.late} competências em atraso`,
        to: "/tesouraria/mensalidades",
      },
      ...(open.some((i) =>
        i.investigators.some((x) => x.memberId === org.user.memberId && !x.verdict),
      )
        ? [{ id: "n2", label: "Sindicância aguardando o seu parecer", to: "/sindicancias" }]
        : []),
    ],
    birthdays,
    birthdayMonth: "novembro",
    nextEvent: {
      name: social.title,
      when: social.date.split(" · ")[0].split(", ")[1] ?? social.date,
      info: `${social.guests.length} ingressos vendidos`,
    },
    canCreateEvent: true,
    minutes: org.minutes,
  };
}

function weekday(day: number) {
  const w = new Date(2026, 10, day).toLocaleDateString("pt-BR", { weekday: "long" });
  return w.charAt(0).toUpperCase() + w.slice(1).replace("-feira", "");
}

/* ------------------------------------------------------------------ */
/* Membros                                                             */
/* ------------------------------------------------------------------ */

function MembersScreen({ org, openProfile }: { org: DemoOrg; openProfile: (id: string) => void }) {
  const [q, setQ] = useState("");
  const options = ["Todos", ...org.grades] as const;
  const [grade, setGrade] = useState<string>("Todos");
  const list = org.members.filter(
    (m) =>
      (grade === "Todos" || m.grade === grade) &&
      m.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const title = org.kind === "loja" ? "Quadro de obreiros" : "Membros";

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Secretaria"
        title={title}
        subtitle={`${org.members.length} ${org.memberWord.many} cadastrados`}
        actions={
          <PrimaryButton onClick={notInDemo}>
            <Plus className="h-[18px] w-[18px]" aria-hidden />
            Novo cadastro
          </PrimaryButton>
        }
      />
      <div className="flex flex-wrap gap-2.5">
        <SearchBox value={q} onChange={setQ} label="Buscar pelo nome" />
        <FilterChips options={options} value={grade} onChange={setGrade} />
      </div>
      {list.length === 0 ? (
        <Panel className="text-center text-tv-text-2">Ninguém encontrado com esse filtro.</Panel>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => openProfile(m.id)}
                className="flex w-full items-start gap-3 rounded-[18px] bg-tv-surface p-4 text-left transition-shadow hover:shadow-[0_4px_14px_rgba(20,20,20,0.07)]"
              >
                <Avatar name={m.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{m.name}</span>
                  <span className="block truncate text-[13px] text-tv-text-2">
                    {m.role ?? "Sem cargo nesta gestão"}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <Chip>{m.grade}</Chip>
                    <Chip tone={m.status === "Ativo" ? "in" : "warn"}>{m.status}</Chip>
                    <Chip tone={m.attendance >= 75 ? "neutral" : "warn"}>
                      Frequência {m.attendance}%
                    </Chip>
                  </span>
                </span>
                <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-tv-text-2" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chamada                                                             */
/* ------------------------------------------------------------------ */

const ATT_FILTERS = ["Todos", "Sem marcar"] as const;

function AttendanceScreen({
  org,
  marks,
  setMarks,
  reasons,
  setReasons,
  closed,
  setClosed,
  openProfile,
}: {
  org: DemoOrg;
  marks: Marks;
  setMarks: (fn: (m: Marks) => Marks) => void;
  reasons: Record<string, string>;
  setReasons: (fn: (r: Record<string, string>) => Record<string, string>) => void;
  closed: boolean;
  setClosed: (v: boolean) => void;
  openProfile: (id: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof ATT_FILTERS)[number]>("Todos");
  const [q, setQ] = useState("");
  const session = org.events.find((e) => e.day === org.sessionDay)!;
  const me = memberById(org, org.user.memberId)!;
  const ids = Object.keys(marks);
  const present = ids.filter((id) => marks[id] === "P").length;
  const absent = ids.filter((id) => marks[id] === "A").length;
  const unmarked = ids.length - present - absent;
  const list = org.members.filter(
    (m) =>
      m.id in marks &&
      (filter === "Todos" || marks[m.id] === "") &&
      m.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const set = (id: string, v: "P" | "A") =>
    setMarks((cur) => ({ ...cur, [id]: cur[id] === v ? "" : v }));

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Chamada"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {session.title}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-[13px] font-bold tracking-normal",
                closed ? "bg-tv-line text-[#3F4249] dark:text-tv-text" : "bg-[#DDF0E5] text-tv-in",
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full", closed ? "bg-[#8A8D93]" : "bg-[#1F7A4D]")}
              />
              {closed ? "Chamada encerrada" : "Chamada aberta"}
            </span>
          </span>
        }
        subtitle={`Sessão ritualística · ${weekday(session.day)}, ${session.day}/11/2026 · ${session.time} · Obrigatória`}
      />

      <div className="flex flex-wrap items-start gap-[18px]">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-3">
          <div className="flex flex-wrap gap-2.5">
            <SearchBox value={q} onChange={setQ} label="Buscar pelo nome" />
            <FilterChips options={ATT_FILTERS} value={filter} onChange={setFilter} />
          </div>
          {list.length === 0 ? (
            <Panel className="text-center text-tv-text-2">Todos já foram marcados.</Panel>
          ) : (
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {list.map((m) => {
                const v = marks[m.id];
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-[16px] border bg-tv-surface py-3 pl-4 pr-3",
                      v === "" ? "border-[#E9D58A]" : "border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openProfile(m.id)}
                        className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-tight hover:underline"
                      >
                        {m.name}
                      </button>
                      <button
                        type="button"
                        disabled={closed}
                        aria-pressed={v === "P"}
                        onClick={() => set(m.id, "P")}
                        className={cn(
                          "flex min-h-10 items-center gap-1 rounded-[10px] border px-3 text-sm font-semibold disabled:opacity-60",
                          v === "P"
                            ? "border-[#1F7A4D] bg-[#1F7A4D] text-white"
                            : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] dark:border-tv-border dark:text-tv-text",
                        )}
                      >
                        <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                        Veio
                      </button>
                      <button
                        type="button"
                        disabled={closed}
                        aria-pressed={v === "A"}
                        onClick={() => set(m.id, "A")}
                        className={cn(
                          "flex min-h-10 items-center gap-1 rounded-[10px] border px-3 text-sm font-semibold disabled:opacity-60",
                          v === "A"
                            ? "border-[#B42318] bg-[#B42318] text-white"
                            : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] dark:border-tv-border dark:text-tv-text",
                        )}
                      >
                        <X className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                        Faltou
                      </button>
                    </div>
                    {v === "A" ? (
                      <input
                        type="text"
                        aria-label={`Motivo da falta de ${m.name}`}
                        placeholder="Motivo da falta (opcional)"
                        value={reasons[m.id] ?? ""}
                        disabled={closed}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReasons((r) => ({ ...r, [m.id]: val }));
                        }}
                        className="mt-2.5 min-h-10 w-full rounded-[10px] border border-tv-border bg-tv-bg px-3 text-sm outline-none"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
          <Panel>
            <span className="block text-[15px] font-bold">Resumo</span>
            <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[14px] bg-tv-in-bg px-1 py-3">
                <span className="block font-display text-[26px] font-extrabold text-tv-in">
                  {present}
                </span>
                <span className="text-xs font-semibold text-tv-in">Presentes</span>
              </div>
              <div className="rounded-[14px] bg-tv-out-bg px-1 py-3">
                <span className="block font-display text-[26px] font-extrabold text-tv-out">
                  {absent}
                </span>
                <span className="text-xs font-semibold text-tv-out">Faltaram</span>
              </div>
              <div className="rounded-[14px] bg-tv-bg px-1 py-3">
                <span className="block font-display text-[26px] font-extrabold">{unmarked}</span>
                <span className="text-xs font-semibold text-[#3F4249] dark:text-tv-text-2">
                  Sem marcar
                </span>
              </div>
            </div>
            <div className="mt-3.5 flex h-2.5 overflow-hidden rounded-full bg-[#EEEEEA] dark:bg-tv-line">
              <div className="bg-[#1F7A4D]" style={{ width: `${(present / ids.length) * 100}%` }} />
              <div className="bg-[#C8463A]" style={{ width: `${(absent / ids.length) * 100}%` }} />
            </div>
            {closed ? (
              <button
                type="button"
                onClick={() => setClosed(false)}
                className="mt-4 min-h-[46px] w-full rounded-[12px] bg-tv-soft text-[15px] font-semibold text-tv-ink"
              >
                Reabrir chamada
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setMarks((cur) => {
                      const next: Marks = { ...cur };
                      Object.keys(next).forEach((id) => {
                        if (next[id] === "") next[id] = "P";
                      });
                      return next;
                    })
                  }
                  className="mt-4 min-h-[46px] w-full rounded-[12px] bg-tv-soft text-[15px] font-semibold text-tv-ink"
                >
                  Marcar os restantes como presentes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClosed(true);
                    toast.success("Chamada encerrada", {
                      description: `Presentes: ${present}. Faltas: ${absent}.`,
                    });
                  }}
                  className="mt-2 min-h-12 w-full rounded-[12px] bg-tv-primary text-[15px] font-bold text-white"
                >
                  Encerrar chamada
                </button>
              </>
            )}
            <p className="mt-2.5 text-center text-[13px] text-tv-text-2">
              Cada marcação é salva na hora
            </p>
          </Panel>
          <Panel className="flex flex-col gap-2 text-sm text-[#3F4249] dark:text-tv-text-2">
            <span className="text-[15px] font-bold text-tv-text">Sessão</span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden />
              {session.place}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden />
              Início às {session.time}
            </span>
            <span>
              Presidida por {me.name} ({org.user.role})
            </span>
            <button
              type="button"
              onClick={notInDemo}
              className="flex min-h-8 items-center gap-1.5 font-semibold text-tv-primary"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Abrir {org.minutesWord.toLowerCase()} desta sessão
            </button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fluxo de caixa                                                      */
/* ------------------------------------------------------------------ */

const CASH_FILTERS = ["Todos", "Entradas", "Saídas"] as const;

function CashScreen({
  org,
  cash,
  setCash,
  totals,
  hidden,
  setHidden,
}: {
  org: DemoOrg;
  cash: CashEntry[];
  setCash: (fn: (c: CashEntry[]) => CashEntry[]) => void;
  totals: { monthIn: number; monthOut: number; yearIn: number; yearOut: number; balance: number };
  hidden: boolean;
  setHidden: (fn: (v: boolean) => boolean) => void;
}) {
  const [filter, setFilter] = useState<(typeof CASH_FILTERS)[number]>("Todos");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const money = (v: number) => (hidden ? "R$ ••••" : brl(v));
  const result = totals.yearIn - totals.yearOut;
  const list = cash.filter(
    (c) =>
      (filter === "Todos" || (filter === "Entradas" ? c.type === "in" : c.type === "out")) &&
      `${c.desc} ${c.category}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const EyeIcon = hidden ? EyeOff : Eye;

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Tesouraria"
        title="Fluxo de caixa"
        actions={
          <>
            <SoftButton onClick={() => setHidden((v) => !v)}>
              <EyeIcon className="h-[18px] w-[18px]" aria-hidden />
              {hidden ? "Mostrar valores" : "Ocultar valores"}
            </SoftButton>
            <SoftButton onClick={notInDemo}>
              <Download className="h-[18px] w-[18px]" aria-hidden />
              Exportar
            </SoftButton>
            <PrimaryButton onClick={() => setFormOpen((v) => !v)}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Novo lançamento
            </PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="col-span-2 bg-tv-primary text-white lg:col-span-1">
          <span className="text-sm opacity-85">Saldo atual do caixa</span>
          <span className="mt-1 block font-display text-[28px] font-extrabold">
            {money(totals.balance)}
          </span>
          <span className="text-[13px] opacity-80">
            Inclui {money(org.yearBefore.opening)} de 2025
          </span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">Entradas em 2026</span>
          <span className="mt-1 block font-display text-[20px] font-extrabold text-tv-in sm:text-[22px]">
            {money(totals.yearIn)}
          </span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">Saídas em 2026</span>
          <span className="mt-1 block font-display text-[20px] font-extrabold text-tv-out sm:text-[22px]">
            {money(totals.yearOut)}
          </span>
        </Panel>
        <Panel className="col-span-2 lg:col-span-1">
          <span className="text-sm text-tv-text-2">Resultado de 2026</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold">
            {money(result)}
          </span>
          <span className="text-[13px] text-tv-text-2">
            {result >= 0 ? "Entrou mais do que saiu" : "Saiu mais do que entrou"}
          </span>
        </Panel>
      </div>

      {formOpen ? (
        <NewEntryForm
          org={org}
          onCancel={() => setFormOpen(false)}
          onSave={(entry) => {
            setCash((c) => [entry, ...c]);
            setFormOpen(false);
            toast.success("Lançamento adicionado", {
              description: `${entry.desc}: ${brl(entry.value)}`,
            });
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        <SearchBox value={q} onChange={setQ} label="Buscar descrição ou categoria" />
        <FilterChips options={CASH_FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="overflow-hidden rounded-[20px] bg-tv-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tv-line px-5 py-4">
          <span className="text-[15px] font-bold">
            Novembro de 2026{" "}
            <span className="font-medium text-tv-text-2">· {list.length} lançamentos</span>
          </span>
          <span className="flex gap-3 text-sm font-semibold">
            <span className="text-tv-in">Entradas {money(totals.monthIn)}</span>
            <span className="text-tv-out">Saídas {money(totals.monthOut)}</span>
          </span>
        </div>
        <div className="hidden grid-cols-[72px_1fr_110px_140px_48px] gap-3 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.06em] text-tv-text-2 md:grid">
          <span>Data</span>
          <span>Descrição</span>
          <span>Tipo</span>
          <span className="text-right">Valor</span>
          <span className="sr-only">Ações</span>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-tv-text-2">Nenhum lançamento com esse filtro.</p>
        ) : (
          <ul>
            {list.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[1fr_auto_40px] items-center gap-x-3 gap-y-1 border-t border-tv-line px-5 py-3 md:grid-cols-[72px_1fr_110px_140px_48px]"
              >
                <span className="hidden text-sm text-tv-text-2 md:block">{c.date}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{c.desc}</span>
                  <span className="block text-[13px] text-tv-text-2">
                    <span className="md:hidden">{c.date} · </span>
                    {c.category}
                  </span>
                </span>
                <span className="hidden md:block">
                  <Chip tone={c.type === "in" ? "in" : "out"}>
                    {c.type === "in" ? "Entrada" : "Saída"}
                  </Chip>
                </span>
                <span
                  className={cn(
                    "text-right text-[15px] font-bold",
                    c.type === "in" ? "text-tv-in" : "text-tv-out",
                  )}
                >
                  {c.type === "in" ? "+ " : "− "}
                  {money(c.value)}
                </span>
                <button
                  type="button"
                  aria-label={`Excluir lançamento ${c.desc}`}
                  onClick={() => {
                    setCash((all) => all.filter((x) => x.id !== c.id));
                    toast("Lançamento excluído", { description: c.desc });
                  }}
                  className="grid h-10 w-10 place-items-center rounded-[10px] text-tv-text-2 hover:bg-tv-bg"
                >
                  <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewEntryForm({
  org,
  onSave,
  onCancel,
}: {
  org: DemoOrg;
  onSave: (e: CashEntry) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"in" | "out">("in");
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const cats = type === "in" ? org.cashIn : org.cashOut;
  const [category, setCategory] = useState(cats[0]);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const num = Number(value.replace(/\./g, "").replace(",", "."));
    if (!desc.trim()) return setError("Escreva uma descrição para o lançamento.");
    if (!Number.isFinite(num) || num <= 0)
      return setError("Informe um valor maior que zero, como 25,00.");
    onSave({
      id: `n${Date.now()}`,
      date: "23/11",
      desc: desc.trim(),
      category: cats.includes(category) ? category : cats[0],
      type,
      value: Math.round(num * 100) / 100,
    });
  }

  return (
    <form onSubmit={submit} className="rounded-[20px] bg-tv-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">Novo lançamento</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-[10px] hover:bg-tv-bg"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div
        className="mt-3 inline-flex gap-1 rounded-[14px] bg-[#E9E9E5] p-1 dark:bg-tv-line"
        role="group"
        aria-label="Tipo"
      >
        {(["in", "out"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              setCategory((t === "in" ? org.cashIn : org.cashOut)[0]);
            }}
            className={cn(
              "min-h-10 rounded-[10px] px-4 text-sm font-semibold",
              type === t
                ? "bg-tv-surface shadow-[0_1px_3px_rgba(20,20,20,0.12)]"
                : "text-[#4A4D54] dark:text-tv-text-2",
            )}
          >
            {t === "in" ? "Entrada" : "Saída"}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Descrição
          <input
            className={fieldClass}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ex.: Compra de materiais"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Valor (R$)
          <input
            className={fieldClass}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Categoria
          <select
            className={fieldClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-tv-out">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <PrimaryButton type="submit">Salvar lançamento</PrimaryButton>
        <SoftButton onClick={onCancel}>Cancelar</SoftButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Mensalidades                                                        */
/* ------------------------------------------------------------------ */

const CYCLE: DueStatus[] = ["P", "A", "T", "I"];

function DuesScreen({
  org,
  dues,
  setDues,
  stats,
  openProfile,
}: {
  org: DemoOrg;
  dues: Record<string, DueStatus[]>;
  setDues: (fn: (d: Record<string, DueStatus[]>) => Record<string, DueStatus[]>) => void;
  stats: { paid: number; open: number; late: number; pendingMembers: number; pct: number };
  openProfile: (id: string) => void;
}) {
  function cycle(id: string, month: number) {
    setDues((d) => {
      const row = [...(d[id] ?? [])];
      const cur = row[month];
      if (cur === "-") return d;
      row[month] = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      return { ...d, [id]: row };
    });
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Tesouraria"
        title="Mensalidades 2026"
        subtitle={`Valor mensal de ${brl(org.dueValue)}. Toque numa competência para mudar a situação.`}
        actions={
          <>
            <SoftButton
              onClick={() =>
                toast.success("Cobrança enviada", {
                  description: `${stats.pendingMembers} ${org.memberWord.many} com pendência vão receber o aviso com o Pix.`,
                })
              }
            >
              <Receipt className="h-[18px] w-[18px]" aria-hidden />
              Cobrar pendentes
            </SoftButton>
            <SoftButton onClick={notInDemo}>
              <Download className="h-[18px] w-[18px]" aria-hidden />
              Exportar
            </SoftButton>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <span className="text-sm text-tv-text-2">Recebido no ano</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold text-tv-in">
            {brl(stats.paid * org.dueValue)}
          </span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">Em aberto</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold">
            {brl(stats.open * org.dueValue)}
          </span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">Atrasado</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold text-[#7E3F00] dark:text-tv-warn">
            {brl(stats.late * org.dueValue)}
          </span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">Recebido até agora</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold">{stats.pct}%</span>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEEEEA] dark:bg-tv-line">
            <div className="h-full rounded-full bg-tv-primary" style={{ width: `${stats.pct}%` }} />
          </div>
        </Panel>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Legenda">
        {(["P", "A", "T", "I"] as const).map((s) => (
          <li
            key={s}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
            style={{ background: DUE_META[s].bg, color: DUE_META[s].fg }}
          >
            <b>{DUE_META[s].short}</b> {DUE_META[s].label}
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-[20px] bg-tv-surface">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="text-xs font-bold text-tv-text-2">
              <th scope="col" className="sticky left-0 z-10 bg-tv-surface px-4 py-3 text-left">
                Nome
              </th>
              {MONTHS_SHORT.map((m) => (
                <th key={m} scope="col" className="px-1 py-3 text-center">
                  {m}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right">
                Em aberto
              </th>
            </tr>
          </thead>
          <tbody>
            {org.members.map((m) => {
              const row = dues[m.id] ?? [];
              const owed = row.filter((s) => s === "A" || s === "T").length * org.dueValue;
              return (
                <tr key={m.id} className="border-t border-tv-line">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[210px] bg-tv-surface px-4 py-2 text-left font-semibold"
                  >
                    <button
                      type="button"
                      onClick={() => openProfile(m.id)}
                      className="block max-w-full truncate text-left hover:underline"
                    >
                      {m.name}
                    </button>
                  </th>
                  {row.map((s, i) => (
                    <td key={i} className="px-0.5 py-1.5 text-center">
                      {s === "-" ? (
                        <span
                          className="text-tv-text-2"
                          aria-label={`${MONTHS_LONG[i]}: ainda não vence`}
                        >
                          ·
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cycle(m.id, i)}
                          aria-label={`${m.name}, ${MONTHS_LONG[i]}: ${DUE_META[s].label}. Toque para mudar.`}
                          title={`${MONTHS_LONG[i]}: ${DUE_META[s].label}`}
                          className="h-9 w-11 rounded-[8px] text-xs font-bold transition-transform active:scale-90"
                          style={{ background: DUE_META[s].bg, color: DUE_META[s].fg }}
                        >
                          {DUE_META[s].short}
                        </button>
                      )}
                    </td>
                  ))}
                  <td
                    className={cn(
                      "px-4 py-2 text-right font-bold",
                      owed ? "text-[#B42318] dark:text-tv-out" : "text-tv-text-2",
                    )}
                  >
                    {brl(owed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

function CalendarScreen({ org }: { org: DemoOrg }) {
  const [selected, setSelected] = useState<DemoEvent | null>(
    org.events.find((e) => e.day === org.sessionDay) ?? null,
  );
  const firstWeekday = new Date(2026, 10, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: 30 }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const today = DEMO_TODAY.getDate();

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Gestão"
        title="Calendário"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-[12px] border border-tv-border bg-tv-surface">
              <button
                type="button"
                onClick={notInDemo}
                aria-label="Mês anterior"
                className="grid h-11 w-11 place-items-center"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <span className="px-1 text-sm font-semibold">Novembro de 2026</span>
              <button
                type="button"
                onClick={notInDemo}
                aria-label="Próximo mês"
                className="grid h-11 w-11 place-items-center"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <PrimaryButton onClick={notInDemo}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Novo evento
            </PrimaryButton>
          </>
        }
      />

      <div className="rounded-[16px] border border-[#F0C9C4] bg-tv-out-bg p-4 text-sm text-tv-out dark:border-transparent">
        <p className="font-bold">Datas obrigatórias do semestre</p>
        <p className="mt-1">{org.mandatory}</p>
      </div>

      <div className="flex flex-wrap items-start gap-[18px]">
        <div className="hidden min-w-0 flex-[3_1_560px] overflow-hidden rounded-[20px] bg-tv-surface md:block">
          <div className="grid grid-cols-7 border-b border-tv-line text-center text-xs font-bold text-tv-text-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <span key={d} className="py-2.5">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const evs = day ? org.events.filter((e) => e.day === day) : [];
              return (
                <div
                  key={i}
                  className="min-h-[96px] border-b border-r border-tv-line p-1.5 [&:nth-child(7n)]:border-r-0"
                >
                  {day ? (
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold",
                        day === today ? "bg-tv-primary text-white" : "text-tv-text-2",
                      )}
                    >
                      {day}
                    </span>
                  ) : null}
                  <div className="mt-1 flex flex-col gap-1">
                    {evs.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelected(e)}
                        aria-pressed={selected?.id === e.id}
                        className={cn(
                          "truncate rounded-[6px] px-1.5 py-1 text-left text-[11px] font-semibold",
                          selected?.id === e.id && "ring-2 ring-tv-primary",
                        )}
                        style={{
                          background: EVENT_COLORS[e.type].bg,
                          color: EVENT_COLORS[e.type].fg,
                        }}
                      >
                        {e.time} {e.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
          {selected ? (
            <Panel>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: EVENT_COLORS[selected.type].bg,
                  color: EVENT_COLORS[selected.type].fg,
                }}
              >
                {selected.type}
              </span>
              <h2 className="mt-3 font-display text-xl font-bold">{selected.title}</h2>
              <div className="mt-2 flex flex-col gap-1.5 text-[15px] text-[#3F4249] dark:text-tv-text-2">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  {weekday(selected.day)}, {String(selected.day).padStart(2, "0")}/11/2026 às{" "}
                  {selected.time}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {selected.place}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  toast.success("Convite enviado", {
                    description: `Na versão completa, os ${org.memberWord.many} recebem o convite por e-mail com o arquivo de agenda.`,
                  })
                }
                className="mt-4 min-h-[46px] w-full rounded-[12px] bg-tv-soft text-[15px] font-semibold text-tv-ink"
              >
                Enviar convite
              </button>
            </Panel>
          ) : null}
          <Panel className="p-0">
            <p className="px-5 pb-1 pt-4 text-[15px] font-bold">Agenda de novembro</p>
            <ul>
              {org.events.map((e) => (
                <li key={e.id} className="border-t border-tv-line first:border-0">
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-5 py-2.5 text-left",
                      selected?.id === e.id && "bg-tv-soft",
                      e.day < today && "opacity-60",
                    )}
                  >
                    <span className="w-9 shrink-0 text-center">
                      <span className="block font-display text-lg font-extrabold leading-none">
                        {e.day}
                      </span>
                      <span className="text-[11px] text-tv-text-2">nov</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{e.title}</span>
                      <span className="block text-[13px] text-tv-text-2">
                        {e.time} · {e.type}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mais (mobile)                                                       */
/* ------------------------------------------------------------------ */

function MoreScreen({ org, go, openChooser }: { org: DemoOrg; go: Go; openChooser: () => void }) {
  const items: { id: DemoScreen; label: string; detail: string; icon: NavItem["icon"] }[] = [
    {
      id: "mensalidades",
      label: "Mensalidades",
      detail: "Situação de cada um, mês a mês",
      icon: Receipt,
    },
    { id: "eventos", label: "Eventos", detail: "Ingressos, check-in e comandas", icon: Ticket },
    {
      id: "sindicancias",
      label: "Sindicâncias",
      detail: `Pareceres sobre ${org.memberWord.candidate.toLowerCase()}s`,
      icon: Gavel,
    },
    {
      id: "calendario",
      label: "Calendário",
      detail: "Sessões, reuniões e eventos",
      icon: CalendarDays,
    },
    {
      id: "perfil",
      label: "Meu perfil",
      detail: "Dados, frequência e carteirinha",
      icon: UserRound,
    },
  ];
  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader title="Mais" />
      <ul className="overflow-hidden rounded-[20px] bg-tv-surface">
        {items.map((it) => (
          <li key={it.id} className="border-t border-tv-line first:border-0">
            <button
              type="button"
              onClick={() => go(it.id, it.id === "perfil" ? org.user.memberId : null)}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-tv-soft text-tv-primary">
                <it.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{it.label}</span>
                <span className="block text-[13px] text-tv-text-2">{it.detail}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-tv-text-2" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={openChooser}
        className="flex items-center gap-3 rounded-[20px] bg-tv-surface p-4 text-left"
      >
        <OrgMark org={org} className="h-11 w-11 rounded-[12px] border border-tv-border" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Ver como outra organização</span>
          <span className="block text-[13px] text-tv-text-2">Agora: {org.viewAs}</span>
        </span>
        <ArrowLeftRight className="h-5 w-5 text-tv-text-2" aria-hidden />
      </button>
    </div>
  );
}
