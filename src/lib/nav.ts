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
} from "lucide-react";
import type { ComponentType } from "react";
import { can, type Permission } from "@/lib/permissions";

export type NavPath =
  | "/inicio"
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
  | "/regional/regioes";

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
      { to: "/regional/capitulos", label: "Instituições", icon: Building2 },
      { to: "/regional/regioes", label: "Regiões", icon: Map },
    ],
  },
];

/** Grupos do escopo org: gestão estadual é exclusiva do GME. */
export function visibleOrgGroups(isGme: boolean): NavGroup[] {
  return ORG_NAV_GROUPS.filter((g) => g.id !== "org-gestao" || isGme);
}

/** Atalhos da barra inferior no mobile em escopo regional/estadual. */
export const ORG_MOBILE_TABS: NavItem[] = [
  { to: "/regional", label: "Panorama", icon: LayoutGrid },
  { to: "/regional/calendario", label: "Agenda", icon: CalendarDays },
  { to: "/regional/membros", label: "Membros", icon: Users },
  { to: "/mais", label: "Mais", icon: MoreHorizontal },
];

/** Atalhos da barra inferior no mobile. */
export const MOBILE_TABS: NavItem[] = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/membros", label: "Membros", icon: Users },
  { to: "/tesouraria/fluxo", label: "Caixa", icon: Wallet },
  { to: "/eventos", label: "Eventos", icon: Calendar },
  { to: "/mais", label: "Mais", icon: MoreHorizontal },
];

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
