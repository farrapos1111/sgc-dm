import {
  Home,
  Users,
  Calendar,
  CalendarDays,
  ClipboardList,
  FileText,
  Wallet,
  Receipt,
  Landmark,
  MoreHorizontal,
  Ticket,
  QrCode,
  FolderSearch,
  Gavel,
  UtensilsCrossed,
  ListChecks,
  Settings,
  Briefcase,
  Globe2,
  Map,
  Building2,
  LayoutGrid,
  Banknote,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { can, type Permission } from "@/lib/permissions";

export type NavPath =
  | "/inicio"
  | "/perfil"
  | "/membros"
  | "/atas"
  | "/presencas"
  | "/tesouraria/fluxo"
  | "/tesouraria/mensalidades"
  | "/tesouraria/cobrancas"
  | "/calendario"
  | "/gestao"
  | "/configuracoes"
  | "/eventos"
  | "/eventos/checkins"
  | "/sindicancias/fichas"
  | "/sindicancias/processos"
  | "/hospitalaria/cardapios"
  | "/hospitalaria/escala"
  | "/mais"
  | "/regional"
  | "/regional/calendario"
  | "/regional/membros"
  | "/regional/capitulos"
  | "/regional/regioes"
  | "/regional/estados"
  | "/regional/liderancas";

export type NavItem = {
  to: NavPath;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Item único (sem submenus). */
  to?: NavPath;
  items?: NavItem[];
  /** Visível para quem tem esta permissão (ou para todos se ausente). */
  permission?: Permission;
  /** Setor pertencente a uma comissão — visibilidade vem de useCommissionAccess. */
  commission?: string;
};

export const NAV_GROUPS: NavGroup[] = [
  { id: "inicio", label: "Início", icon: Home, to: "/inicio" },
  { id: "perfil", label: "Perfil", icon: UserRound, to: "/perfil" },
  {
    id: "secretaria",
    label: "Secretaria",
    icon: FileText,
    items: [
      { to: "/membros", label: "Membros", icon: Users },
      { to: "/atas", label: "Atas", icon: FileText },
      { to: "/presencas", label: "Presenças", icon: ClipboardList },
    ],
  },
  {
    id: "tesouraria",
    label: "Tesouraria",
    icon: Wallet,
    items: [
      { to: "/tesouraria/fluxo", label: "Fluxo de Caixa", icon: Wallet },
      { to: "/tesouraria/mensalidades", label: "Mensalidades", icon: Receipt },
      { to: "/tesouraria/cobrancas", label: "Cobranças", icon: Banknote },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: Landmark,
    items: [
      { to: "/calendario", label: "Calendário", icon: CalendarDays },
      { to: "/gestao", label: "Cargos e Comissões", icon: Briefcase },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
  {
    id: "com-eventos",
    label: "Com. de Eventos",
    icon: Calendar,
    commission: "eventos",
    items: [
      { to: "/eventos", label: "Eventos", icon: Ticket },
      { to: "/eventos/checkins", label: "Check-ins", icon: QrCode },
    ],
  },
  {
    id: "com-sindicancias",
    label: "Com. de Sindicâncias",
    icon: FolderSearch,
    commission: "sindicancias",
    items: [
      { to: "/sindicancias/fichas", label: "Fichas", icon: FolderSearch },
      { to: "/sindicancias/processos", label: "Processos", icon: Gavel },
    ],
  },
  {
    id: "hospitalaria",
    label: "Hospitalaria",
    icon: UtensilsCrossed,
    commission: "hospitalaria",
    items: [
      { to: "/hospitalaria/cardapios", label: "Cardápios", icon: UtensilsCrossed },
      { to: "/hospitalaria/escala", label: "Escala de Serviço", icon: ListChecks },
    ],
  },
];

/** Navegação exibida quando o usuário está em um escopo regional/estadual. */
export const ORG_NAV_GROUPS: NavGroup[] = [
  { id: "org-panorama", label: "Panorama", icon: LayoutGrid, to: "/regional" },
  { id: "org-perfil", label: "Perfil", icon: UserRound, to: "/perfil" },
  {
    id: "org-acompanhamento",
    label: "Acompanhamento",
    icon: Globe2,
    items: [
      { to: "/regional/calendario", label: "Calendário", icon: CalendarDays },
      { to: "/regional/membros", label: "Membros", icon: Users },
    ],
  },
  {
    id: "org-gestao",
    label: "Gestão estadual",
    icon: Map,
    items: [
      { to: "/regional/estados", label: "Estados", icon: Globe2 },
      { to: "/regional/capitulos", label: "Instituições", icon: Building2 },
      { to: "/regional/regioes", label: "Regiões", icon: Map },
      { to: "/regional/liderancas", label: "Lideranças", icon: Users },
    ],
  },
];

/** Grupos do escopo org: gestão estadual para GME ou super admin. */
export function visibleOrgGroups(
  canManageOrg: boolean,
  isSuperAdmin = false,
): NavGroup[] {
  return ORG_NAV_GROUPS.filter(
    (g) => g.id !== "org-gestao" || canManageOrg,
  ).map((g) => {
    if (g.id !== "org-gestao" || isSuperAdmin) return g;
    return {
      ...g,
      items: (g.items ?? []).filter((i) => i.to !== "/regional/estados"),
    };
  });
}

/** Atalhos da barra inferior no mobile em escopo regional/estadual. */
export const ORG_MOBILE_TABS: NavItem[] = [
  { to: "/regional", label: "Panorama", icon: LayoutGrid },
  { to: "/regional/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/perfil", label: "Perfil", icon: UserRound },
  { to: "/mais", label: "Mais", icon: MoreHorizontal },
];

/** Atalhos da barra inferior no mobile. */
export const MOBILE_TABS: NavItem[] = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/perfil", label: "Perfil", icon: UserRound },
  { to: "/mais", label: "Mais", icon: MoreHorizontal },
];

/** Atalhos da barra inferior (capítulo ou org). */
export function visibleMobileTabs(isOrgScope: boolean): NavItem[] {
  return isOrgScope ? ORG_MOBILE_TABS : MOBILE_TABS;
}

/**
 * Grupos para a página /mais: remove rotas já cobertas pela barra inferior
 * para não duplicar atalhos.
 */
export function mobileOverflowGroups(groups: NavGroup[], tabs: NavItem[]): NavGroup[] {
  const tabPaths = new Set<string>(
    tabs.map((t) => t.to).filter((to) => to !== "/mais"),
  );
  return groups
    .map((g) => {
      if (g.to) {
        return tabPaths.has(g.to) ? null : g;
      }
      const items = (g.items ?? []).filter((i) => !tabPaths.has(i.to));
      if (items.length === 0) return null;
      return { ...g, items };
    })
    .filter((g): g is NavGroup => g !== null);
}

export function visibleGroups(
  roleName: string | null,
  canViewCommission: (code: string) => boolean,
): NavGroup[] {
  return NAV_GROUPS.filter((g) => {
    if (g.permission && !can(roleName, g.permission)) return false;
    if (g.commission && !canViewCommission(g.commission)) return false;
    return true;
  });
}
