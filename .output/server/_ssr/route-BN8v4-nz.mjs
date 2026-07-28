import { a as __toESM } from "../_runtime.mjs";
import { _ as useNavigate, f as Outlet, g as Link, l as useRouterState, v as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
import { n as useActiveChapter } from "./ActiveChapterContext-Bm8gqppb.mjs";
import { A as Map, G as Gavel, I as ListChecks, K as FolderSearch, M as LogOut, O as Moon, Q as Earth, R as LayoutGrid, S as Receipt, U as House, Z as Ellipsis, d as Sun, dt as Calendar, ft as CalendarDays, h as Settings, ht as Briefcase, i as Users, lt as ChevronDown, mt as Building2, n as Wallet, nt as ClipboardList, q as FileText, r as UtensilsCrossed, u as Ticket, w as QrCode, z as Landmark } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-BkEeRci-.mjs";
import { i as SelectItem, n as SelectContent, o as SelectTrigger, s as SelectValue, t as Select } from "./select-DG_6GgLn.mjs";
import { t as can } from "./permissions-CaTke9AP.mjs";
import { r as useTheme } from "./ThemeContext-NlVC_MCf.mjs";
import { t as useCommissionAccess } from "./useCommissionAccess-BnP5Bq5-.mjs";
import { t as PageSkeleton } from "./PageSkeleton-ZHfLWY70.mjs";
import { n as ROLE_PREFIX, u as useOrgScope } from "./OrgScopeContext-BWQf9cDC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-BN8v4-nz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NAV_GROUPS = [
	{
		id: "inicio",
		label: "Início",
		icon: House,
		to: "/inicio"
	},
	{
		id: "secretaria",
		label: "Secretaria",
		icon: FileText,
		items: [
			{
				to: "/membros",
				label: "Membros",
				icon: Users
			},
			{
				to: "/atas",
				label: "Atas",
				icon: FileText
			},
			{
				to: "/presencas",
				label: "Presenças",
				icon: ClipboardList
			}
		]
	},
	{
		id: "tesouraria",
		label: "Tesouraria",
		icon: Wallet,
		items: [{
			to: "/tesouraria/fluxo",
			label: "Fluxo de Caixa",
			icon: Wallet
		}, {
			to: "/tesouraria/mensalidades",
			label: "Mensalidades",
			icon: Receipt
		}]
	},
	{
		id: "gestao",
		label: "Gestão",
		icon: Landmark,
		items: [
			{
				to: "/calendario",
				label: "Calendário",
				icon: CalendarDays
			},
			{
				to: "/gestao",
				label: "Cargos e Comissões",
				icon: Briefcase
			},
			{
				to: "/configuracoes",
				label: "Configurações",
				icon: Settings
			}
		]
	},
	{
		id: "com-eventos",
		label: "Com. de Eventos",
		icon: Calendar,
		commission: "eventos",
		items: [{
			to: "/eventos",
			label: "Eventos",
			icon: Ticket
		}, {
			to: "/eventos/checkins",
			label: "Check-ins",
			icon: QrCode
		}]
	},
	{
		id: "com-sindicancias",
		label: "Com. de Sindicâncias",
		icon: FolderSearch,
		commission: "sindicancias",
		items: [{
			to: "/sindicancias/fichas",
			label: "Fichas",
			icon: FolderSearch
		}, {
			to: "/sindicancias/processos",
			label: "Processos",
			icon: Gavel
		}]
	},
	{
		id: "hospitalaria",
		label: "Hospitalaria",
		icon: UtensilsCrossed,
		commission: "hospitalaria",
		items: [{
			to: "/hospitalaria/cardapios",
			label: "Cardápios",
			icon: UtensilsCrossed
		}, {
			to: "/hospitalaria/escala",
			label: "Escala de Serviço",
			icon: ListChecks
		}]
	}
];
/** Navegação exibida quando o usuário está em um escopo regional/estadual. */
var ORG_NAV_GROUPS = [
	{
		id: "org-panorama",
		label: "Panorama",
		icon: LayoutGrid,
		to: "/regional"
	},
	{
		id: "org-acompanhamento",
		label: "Acompanhamento",
		icon: Earth,
		items: [{
			to: "/regional/calendario",
			label: "Calendário",
			icon: CalendarDays
		}, {
			to: "/regional/membros",
			label: "Membros",
			icon: Users
		}]
	},
	{
		id: "org-gestao",
		label: "Gestão estadual",
		icon: Map,
		items: [{
			to: "/regional/capitulos",
			label: "Instituições",
			icon: Building2
		}, {
			to: "/regional/regioes",
			label: "Regiões",
			icon: Map
		}]
	}
];
/** Grupos do escopo org: gestão estadual é exclusiva do GME. */
function visibleOrgGroups(isGme) {
	return ORG_NAV_GROUPS.filter((g) => g.id !== "org-gestao" || isGme);
}
/** Atalhos da barra inferior no mobile em escopo regional/estadual. */
var ORG_MOBILE_TABS = [
	{
		to: "/regional",
		label: "Panorama",
		icon: LayoutGrid
	},
	{
		to: "/regional/calendario",
		label: "Agenda",
		icon: CalendarDays
	},
	{
		to: "/regional/membros",
		label: "Membros",
		icon: Users
	},
	{
		to: "/mais",
		label: "Mais",
		icon: Ellipsis
	}
];
/** Atalhos da barra inferior no mobile. */
var MOBILE_TABS = [
	{
		to: "/inicio",
		label: "Início",
		icon: House
	},
	{
		to: "/membros",
		label: "Membros",
		icon: Users
	},
	{
		to: "/tesouraria/fluxo",
		label: "Caixa",
		icon: Wallet
	},
	{
		to: "/eventos",
		label: "Eventos",
		icon: Calendar
	},
	{
		to: "/mais",
		label: "Mais",
		icon: Ellipsis
	}
];
function visibleGroups(roleName, canViewCommission) {
	return NAV_GROUPS.filter((g) => {
		if (g.permission && !can(roleName, g.permission)) return false;
		if (g.commission && !canViewCommission(g.commission)) return false;
		return true;
	});
}
function ThemeToggle({ className }) {
	const { resolved, toggle } = useTheme();
	const isDark = resolved === "dark";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: "ghost",
		size: "icon",
		onClick: toggle,
		"aria-label": isDark ? "Ativar modo claro" : "Ativar modo escuro",
		title: isDark ? "Modo claro" : "Modo escuro",
		className: `h-11 w-11 text-muted-foreground ${className ?? ""}`,
		children: isDark ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "h-5 w-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "h-5 w-5" })
	});
}
/** Rotas mais pesadas — prefetch ao passar o mouse/foco. */
var PRELOAD_ROUTES = [
	"/presencas",
	"/gestao",
	"/calendario",
	"/atas"
];
function AppShell({ children }) {
	const router = useRouter();
	const { active } = useActiveChapter();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isNavigating = useRouterState({ select: (s) => s.status === "pending" || s.isLoading === true });
	const { canView } = useCommissionAccess();
	const navigate = useNavigate();
	const { scopes, activeScope, setActiveScopeKey, isGme } = useOrgScope();
	const groups = (0, import_react.useMemo)(() => activeScope ? visibleOrgGroups(isGme) : visibleGroups(active?.role.name ?? null, canView), [
		activeScope,
		isGme,
		active?.role.name,
		canView
	]);
	const tabs = activeScope ? ORG_MOBILE_TABS : MOBILE_TABS;
	function handleScopeChange(value) {
		if (value === "chapter") {
			setActiveScopeKey(null);
			navigate({ to: "/inicio" });
			return;
		}
		setActiveScopeKey(value);
		navigate({ to: "/regional" });
	}
	const scopeSwitcher = scopes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
		value: activeScope?.key ?? "chapter",
		onValueChange: handleScopeChange,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
			className: "h-9 w-full text-xs",
			"aria-label": "Selecionar escopo",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
			value: "chapter",
			children: active.chapter.name
		}), scopes.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
			value: s.key,
			children: [
				ROLE_PREFIX[s.orgRole],
				" · ",
				s.label
			]
		}, s.key))] })]
	}) : null;
	const [pendingTo, setPendingTo] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setPendingTo(null);
	}, [pathname]);
	const primary = active?.chapter.primary_color || "#9E1B32";
	const chapterName = activeScope ? activeScope.label : active?.chapter.name ?? "SG-CDM";
	const chapterNum = activeScope ? "" : active?.chapter.number ?? "";
	const headerSubtitle = activeScope ? ROLE_PREFIX[activeScope.orgRole] : active?.role.label ?? "";
	async function handleSignOut() {
		if (typeof window !== "undefined") window.localStorage.removeItem("sgcdm.activeChapterId");
		await supabase.auth.signOut();
		window.location.assign("/auth");
	}
	const isActive = (to) => pathname === to || pathname.startsWith(to + "/");
	const navHighlight = (to) => pendingTo === to || isActive(to);
	function preloadRoute(to) {
		if (!PRELOAD_ROUTES.includes(to)) return;
		router.preloadRoute({ to }).catch(() => {});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background text-foreground",
		style: { ["--chapter-primary"]: primary },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 border-b border-border px-5 py-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-sm font-bold text-white",
						style: { backgroundColor: primary },
						children: chapterNum ? chapterNum.slice(-3) : "SG"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm font-semibold",
							children: chapterName
						}), chapterNum ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs text-muted-foreground",
							children: ["Nº ", chapterNum]
						}) : headerSubtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-xs text-muted-foreground",
							children: headerSubtitle
						})]
					})]
				}),
				scopeSwitcher && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-b border-border px-3 py-3",
					children: scopeSwitcher
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex-1 space-y-1 overflow-y-auto p-3",
					children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarGroup, {
						group,
						primary,
						isActive,
						isHighlighted: navHighlight,
						onNavigate: setPendingTo,
						onPreload: preloadRoute
					}, group.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t border-border p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center gap-2",
						children: [active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium",
								children: active.role.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-xs text-muted-foreground",
								children: active.chapter.city
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeToggle, { className: "shrink-0" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: handleSignOut,
						className: "w-full justify-start text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "mr-2 h-4 w-4" }), " Sair"]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-screen flex-col lg:pl-64",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-xs font-bold text-white",
							style: { backgroundColor: primary },
							children: chapterNum ? chapterNum.slice(-3) : "SG"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-semibold",
								children: chapterName
							}), headerSubtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-xs text-muted-foreground",
								children: headerSubtitle
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeToggle, { className: "shrink-0" })
					]
				}),
				scopeSwitcher && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-b border-border bg-card px-4 py-2 lg:hidden",
					children: scopeSwitcher
				}),
				(isNavigating || pendingTo) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "fixed left-0 right-0 top-0 z-50 h-0.5 origin-left animate-pulse lg:left-64",
					style: { backgroundColor: primary },
					role: "progressbar",
					"aria-label": "Carregando página"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "relative flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `mx-auto w-full max-w-6xl transition-opacity duration-150 ${isNavigating || pendingTo ? "pointer-events-none opacity-60" : "opacity-100"}`,
						children
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card lg:hidden",
					style: {
						paddingBottom: "env(safe-area-inset-bottom)",
						gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`
					},
					children: tabs.map((item) => {
						const Icon = item.icon;
						const highlighted = navHighlight(item.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							onClick: () => setPendingTo(item.to),
							onMouseEnter: () => preloadRoute(item.to),
							onFocus: () => preloadRoute(item.to),
							className: "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
							style: { color: highlighted ? primary : "var(--muted-foreground)" },
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
						}, item.to);
					})
				})
			]
		})]
	});
}
function SidebarGroup({ group, primary, isActive, isHighlighted, onNavigate, onPreload }) {
	const Icon = group.icon;
	const hasActiveChild = (group.items ?? []).some((i) => isActive(i.to));
	const [open, setOpen] = (0, import_react.useState)(hasActiveChild);
	const expanded = open || hasActiveChild;
	if (group.to) {
		const highlighted = isHighlighted(group.to);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: group.to,
			onClick: () => onNavigate(group.to),
			onMouseEnter: () => onPreload(group.to),
			onFocus: () => onPreload(group.to),
			className: "flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors",
			style: highlighted ? {
				backgroundColor: `${primary}14`,
				color: primary
			} : { color: "var(--muted-foreground)" },
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: group.label })]
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => setOpen((v) => !v),
		className: "flex min-h-[44px] w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/60",
		style: { color: hasActiveChild ? primary : "var(--foreground)" },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex-1 truncate text-left",
				children: group.label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: `h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}` })
		]
	}), expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-0.5 space-y-0.5 pl-4",
		children: (group.items ?? []).map((item) => {
			const ItemIcon = item.icon;
			const highlighted = isHighlighted(item.to);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: item.to,
				onClick: () => onNavigate(item.to),
				onMouseEnter: () => onPreload(item.to),
				onFocus: () => onPreload(item.to),
				className: "flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors",
				style: highlighted ? {
					backgroundColor: `${primary}14`,
					color: primary
				} : { color: "var(--muted-foreground)" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemIcon, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: item.label
				})]
			}, item.to);
		})
	})] });
}
function ShellLayout() {
	const { memberships, loading, active, activeChapterId } = useActiveChapter();
	const { scopes, activeScope, loading: orgLoading, setActiveScopeKey } = useOrgScope();
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		if (loading || orgLoading) return;
		if (memberships.length === 0 && scopes.length > 0 && !activeScope) setActiveScopeKey(scopes[0].key);
	}, [
		loading,
		orgLoading,
		memberships.length,
		scopes,
		activeScope,
		setActiveScopeKey
	]);
	(0, import_react.useEffect)(() => {
		if (loading) return;
		if (activeScope) return;
		if (memberships.length === 0) return;
		if (!activeChapterId && memberships.length > 1) navigate({ to: "/selecionar-capitulo" });
	}, [
		loading,
		memberships.length,
		activeChapterId,
		activeScope,
		navigate
	]);
	if (loading || orgLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Carregando…"
		})
	});
	if (memberships.length === 0 && scopes.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "max-w-md rounded-[12px] border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
			children: "Sua conta não está vinculada a nenhum capítulo. Contate o administrador do seu capítulo."
		})
	});
	if (!active && !activeScope) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Selecione um capítulo…"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
		fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageSkeleton, {}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	}) });
}
//#endregion
export { ShellLayout as component };
