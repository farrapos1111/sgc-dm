import { a as __toESM } from "../_runtime.mjs";
import { c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, j as redirect, m as createFileRoute, p as lazyRouteComponent, s as Scripts, v as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as require_jsx_runtime } from "../_libs/@radix-ui/react-accordion+[...].mjs";
import { t as supabase } from "./client-DPlc1Qcb.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { a as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { n as themeInitScript, r as useTheme, t as ThemeProvider } from "./ThemeContext-NlVC_MCf.mjs";
import { t as Route$32 } from "./eventos._id-Cg9Vj5Dt.mjs";
import { t as category } from "./guia-BGd2792G.mjs";
import { t as Route$33 } from "./membros._id-BLnQw5l0.mjs";
import { t as Route$34 } from "./membros._id_.editar-DNck63eM.mjs";
import { t as Route$35 } from "./ongoing._id-gTygAUtx.mjs";
import { t as category$1 } from "./open-source-CPp1QJll.mjs";
import { t as Route$36 } from "./regional.index-CmkLbDal.mjs";
import { t as Route$37 } from "./route-CYW4OTTW.mjs";
import { t as category$2 } from "./tecnica-Wxa_q0LB.mjs";
import { t as Route$38 } from "./sindicancias.fichas-Dr3GHnbk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-CJ283Z3Y.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-CuEV5A6F.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
	const message = error instanceof Response ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` : error instanceof Error ? error.message : String(error);
	window.__lovableReportRuntimeError?.({
		message,
		stack: error instanceof Error ? error.stack : void 0,
		filename: window.location.pathname
	});
}
var Toaster$1 = ({ ...props }) => {
	const { resolved } = useTheme();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		theme: resolved,
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Página não encontrada"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "A página que você procura não existe ou foi movida."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Ir para início"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "Esta página não carregou"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Algo deu errado. Tente novamente ou volte ao início."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Tentar novamente"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Ir para início"
					})]
				})
			]
		})
	});
}
var Route$31 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "SG-CDM — Sistema Gerenciador de Capítulos DeMolay" },
			{
				name: "description",
				content: "Gestão de capítulos DeMolay: multi-capítulo, papéis e controle de acesso."
			},
			{
				property: "og:title",
				content: "SG-CDM — Sistema Gerenciador de Capítulos DeMolay"
			},
			{
				property: "og:description",
				content: "Gestão de capítulos DeMolay: multi-capítulo, papéis e controle de acesso."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "pt-BR",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: themeInitScript } })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$31.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ThemeProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {
			richColors: true,
			position: "top-right"
		})] })
	});
}
var $$splitComponentImporter$28 = () => import("./auth-Bu8GAd_T.mjs");
var Route$30 = createFileRoute("/auth")({
	ssr: false,
	head: () => ({ meta: [{ title: "Entrar — SG-CDM" }, {
		name: "description",
		content: "Acesso ao Sistema Gerenciador de Capítulos DeMolay."
	}] }),
	beforeLoad: async () => {
		const { data } = await supabase.auth.getUser();
		if (data.user) throw redirect({ to: "/" });
	},
	component: lazyRouteComponent($$splitComponentImporter$28, "component")
});
var $$splitComponentImporter$27 = () => import("./route-q8eak_VB.mjs");
var Route$29 = createFileRoute("/documentacao")({ component: lazyRouteComponent($$splitComponentImporter$27, "component") });
var Route$28 = createFileRoute("/_authenticated/")({ beforeLoad: () => {
	throw redirect({ to: "/inicio" });
} });
var $$splitComponentImporter$26 = () => import("./route-BN8v4-nz.mjs");
var Route$27 = createFileRoute("/_authenticated/_shell")({ component: lazyRouteComponent($$splitComponentImporter$26, "component") });
var $$splitComponentImporter$25 = () => import("./selecionar-capitulo-D_X-FnII.mjs");
var Route$26 = createFileRoute("/_authenticated/selecionar-capitulo")({
	head: () => ({ meta: [{ title: "Selecionar capítulo — SG-CDM" }, {
		name: "description",
		content: "Escolha o capítulo com o qual deseja trabalhar."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
var $$splitComponentImporter$24 = () => import("./documentacao-CP7VcZIJ.mjs");
var Route$25 = createFileRoute("/documentacao/")({
	head: () => ({ meta: [{ title: "Documentação — SG-CDM" }, {
		name: "description",
		content: "Documentação do SG-CDM: técnica, guia do usuário e tutorial de contribuição open source."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$24, "component")
});
var $$splitComponentImporter$23 = () => import("./guia-BZpmdRK_.mjs");
var Route$24 = createFileRoute("/documentacao/guia")({
	head: () => ({ meta: [{ title: `${category.label} — SG-CDM` }, {
		name: "description",
		content: category.description
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$23, "component")
});
var $$splitComponentImporter$22 = () => import("./open-source-CCfG8_37.mjs");
var Route$23 = createFileRoute("/documentacao/open-source")({
	head: () => ({ meta: [{ title: `${category$1.label} — SG-CDM` }, {
		name: "description",
		content: category$1.description
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$22, "component")
});
var $$splitComponentImporter$21 = () => import("./tecnica-jWJnI2q9.mjs");
var Route$22 = createFileRoute("/documentacao/tecnica")({
	head: () => ({ meta: [{ title: `${category$2.label} — SG-CDM` }, {
		name: "description",
		content: category$2.description
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
var $$splitComponentImporter$20 = () => import("./atas-D4LPyK8j.mjs");
var Route$21 = createFileRoute("/_authenticated/_shell/atas")({
	head: () => ({ meta: [
		{ title: "Atas — SG-CDM" },
		{
			name: "description",
			content: "Acompanhe a ata atual, filtre atas por situação e gerencie os modelos padrão do capítulo."
		},
		{
			property: "og:title",
			content: "Atas — SG-CDM"
		},
		{
			property: "og:description",
			content: "Ata atual, histórico por situação e modelos editáveis do capítulo."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
var $$splitComponentImporter$19 = () => import("./calendario-DMNdC_SU.mjs");
var Route$20 = createFileRoute("/_authenticated/_shell/calendario")({
	head: () => ({ meta: [{ title: "Calendário — SG-CDM" }, {
		name: "description",
		content: "Calendário unificado de sessões, eventos e filantropia do capítulo."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
/** Todas as datas (chaves locais) cobertas pelo item — itens que viram o dia aparecem em ambas. */
var $$splitComponentImporter$18 = () => import("./configuracoes-BwV1NlVx.mjs");
/** Texto legível sobre a cor escolhida (luminância relativa). */
var Route$19 = createFileRoute("/_authenticated/_shell/configuracoes")({
	head: () => ({ meta: [
		{ title: "Configurações do capítulo — SG-CDM" },
		{
			name: "description",
			content: "Defina a logo do capítulo usada nos documentos e no cabeçalho do sistema."
		},
		{
			property: "og:title",
			content: "Configurações do capítulo — SG-CDM"
		},
		{
			property: "og:description",
			content: "Logo do capítulo, identidade visual e dados da sede."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
var Route$18 = createFileRoute("/_authenticated/_shell/financeiro")({ beforeLoad: () => {
	throw redirect({ to: "/tesouraria/fluxo" });
} });
var $$splitComponentImporter$17 = () => import("./gestao-CP0Gtj0Y.mjs");
var Route$17 = createFileRoute("/_authenticated/_shell/gestao")({
	head: () => ({ meta: [{ title: "Gestão de cargos e comissões — SG-CDM" }, {
		name: "description",
		content: "Quadro de cargos do capítulo e comissões por vigência."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./inicio-DI9q-0MB.mjs");
var Route$16 = createFileRoute("/_authenticated/_shell/inicio")({
	head: () => ({ meta: [{ title: "Início — SG-CDM" }, {
		name: "description",
		content: "Dashboard do capítulo ativo."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./mais-BUf_T9xB.mjs");
var Route$15 = createFileRoute("/_authenticated/_shell/mais")({
	head: () => ({ meta: [{ title: "Mais — SG-CDM" }, {
		name: "description",
		content: "Opções e sessão."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./presencas-C5P49Gi4.mjs");
var Route$14 = createFileRoute("/_authenticated/_shell/presencas")({
	head: () => ({ meta: [{ title: "Presenças e frequência — SG-CDM" }, {
		name: "description",
		content: "Controle de presenças, ausências, justificativas e frequência dos membros."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./eventos.index-DFPeulSf.mjs");
var Route$13 = createFileRoute("/_authenticated/_shell/eventos/")({
	head: () => ({ meta: [{ title: "Eventos — SG-CDM" }] }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./eventos.checkins-CfV3QXbb.mjs");
var Route$12 = createFileRoute("/_authenticated/_shell/eventos/checkins")({
	head: () => ({ meta: [{ title: "Check-ins — SG-CDM" }, {
		name: "description",
		content: "Histórico de check-ins dos eventos do capítulo."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var $$splitComponentImporter$11 = () => import("./eventos.novo-_W-hBv2-.mjs");
var Route$11 = createFileRoute("/_authenticated/_shell/eventos/novo")({
	head: () => ({ meta: [{ title: "Novo evento — SG-CDM" }] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("./hospitalaria.cardapios-BffBHCa_.mjs");
var Route$10 = createFileRoute("/_authenticated/_shell/hospitalaria/cardapios")({
	head: () => ({ meta: [{ title: "Cardápios — SG-CDM" }, {
		name: "description",
		content: "Cardápios da hospitalaria do capítulo."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./hospitalaria.escala-Bpp9WtBv.mjs");
var Route$9 = createFileRoute("/_authenticated/_shell/hospitalaria/escala")({
	head: () => ({ meta: [{ title: "Escala de Serviço — SG-CDM" }, {
		name: "description",
		content: "Escala de serviço da hospitalaria do capítulo."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./membros.index-ByUMJvDL.mjs");
var Route$8 = createFileRoute("/_authenticated/_shell/membros/")({
	head: () => ({ meta: [{ title: "Membros — SG-CDM" }] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./membros.novo-FIWimXIZ.mjs");
var Route$7 = createFileRoute("/_authenticated/_shell/membros/novo")({
	head: () => ({ meta: [{ title: "Novo membro — SG-CDM" }] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./regional.calendario-NeQeWs4G.mjs");
var Route$6 = createFileRoute("/_authenticated/_shell/regional/calendario")({
	component: lazyRouteComponent($$splitComponentImporter$6, "component"),
	head: () => ({ meta: [
		{ title: "Calendário unificado | SG-CDM" },
		{
			name: "description",
			content: "Agenda unificada das instituições da região ou do estado, com filtro por capítulo e tipo."
		},
		{
			property: "og:title",
			content: "Calendário unificado | SG-CDM"
		},
		{
			property: "og:description",
			content: "Veja sessões, eventos e filantropias de todas as instituições do escopo."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] })
});
var $$splitComponentImporter$5 = () => import("./regional.capitulos-z5LH02q1.mjs");
var Route$5 = createFileRoute("/_authenticated/_shell/regional/capitulos")({
	component: lazyRouteComponent($$splitComponentImporter$5, "component"),
	head: () => ({ meta: [
		{ title: "Gestão de instituições | SG-CDM" },
		{
			name: "description",
			content: "Cadastro e edição das instituições do estado: nome, número, cidade e região."
		},
		{
			property: "og:title",
			content: "Gestão de instituições | SG-CDM"
		},
		{
			property: "og:description",
			content: "Grande Mestre Estadual gerencia instituições e suas regiões."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] })
});
var $$splitComponentImporter$4 = () => import("./regional.membros-BXUWQVzC.mjs");
var Route$4 = createFileRoute("/_authenticated/_shell/regional/membros")({
	component: lazyRouteComponent($$splitComponentImporter$4, "component"),
	head: () => ({ meta: [
		{ title: "Membros do escopo | SG-CDM" },
		{
			name: "description",
			content: "Consulta de membros das instituições da região ou do estado, somente leitura."
		},
		{
			property: "og:title",
			content: "Membros do escopo | SG-CDM"
		},
		{
			property: "og:description",
			content: "Busque membros de todas as instituições sob sua liderança."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] })
});
var $$splitComponentImporter$3 = () => import("./regional.regioes-qBF3YSYs.mjs");
var Route$3 = createFileRoute("/_authenticated/_shell/regional/regioes")({
	component: lazyRouteComponent($$splitComponentImporter$3, "component"),
	head: () => ({ meta: [
		{ title: "Gestão de regiões | SG-CDM" },
		{
			name: "description",
			content: "Criação e edição das regiões do estado e das instituições vinculadas a cada uma."
		},
		{
			property: "og:title",
			content: "Gestão de regiões | SG-CDM"
		},
		{
			property: "og:description",
			content: "Organize as regiões do estado e acompanhe suas instituições."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] })
});
var $$splitComponentImporter$2 = () => import("./sindicancias.processos-yqIpIt4P.mjs");
var Route$2 = createFileRoute("/_authenticated/_shell/sindicancias/processos")({
	head: () => ({ meta: [{ title: "Processos de Sindicância — SG-CDM" }, {
		name: "description",
		content: "Acompanhamento dos processos da comissão de sindicâncias."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./tesouraria.fluxo-CmI8psQP.mjs");
var Route$1 = createFileRoute("/_authenticated/_shell/tesouraria/fluxo")({
	head: () => ({ meta: [
		{ title: "Fluxo de Caixa — SG-CDM" },
		{
			name: "description",
			content: "Entradas, saídas, importação e relatórios financeiros do capítulo."
		},
		{
			property: "og:title",
			content: "Fluxo de Caixa — SG-CDM"
		},
		{
			property: "og:description",
			content: "Controle financeiro mensal do capítulo DeMolay."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./tesouraria.mensalidades-Q4SxHOnK.mjs");
var Route = createFileRoute("/_authenticated/_shell/tesouraria/mensalidades")({
	head: () => ({ meta: [{ title: "Mensalidades — SG-CDM" }, {
		name: "description",
		content: "Controle das mensalidades dos membros do capítulo."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var AuthenticatedRouteRoute = Route$37.update({
	id: "/_authenticated",
	getParentRoute: () => Route$31
});
var AuthRoute = Route$30.update({
	id: "/auth",
	path: "/auth",
	getParentRoute: () => Route$31
});
var DocumentacaoRouteRoute = Route$29.update({
	id: "/documentacao",
	path: "/documentacao",
	getParentRoute: () => Route$31
});
var AuthenticatedIndexRoute = Route$28.update({
	id: "/",
	path: "/",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedShellRouteRoute = Route$27.update({
	id: "/_shell",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedSelecionarCapituloRoute = Route$26.update({
	id: "/selecionar-capitulo",
	path: "/selecionar-capitulo",
	getParentRoute: () => AuthenticatedRouteRoute
});
var DocumentacaoIndexRoute = Route$25.update({
	id: "/",
	path: "/",
	getParentRoute: () => DocumentacaoRouteRoute
});
var DocumentacaoGuiaRoute = Route$24.update({
	id: "/guia",
	path: "/guia",
	getParentRoute: () => DocumentacaoRouteRoute
});
var DocumentacaoOpenSourceRoute = Route$23.update({
	id: "/open-source",
	path: "/open-source",
	getParentRoute: () => DocumentacaoRouteRoute
});
var DocumentacaoTecnicaRoute = Route$22.update({
	id: "/tecnica",
	path: "/tecnica",
	getParentRoute: () => DocumentacaoRouteRoute
});
var AuthenticatedShellAtasRoute = Route$21.update({
	id: "/atas",
	path: "/atas",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellCalendarioRoute = Route$20.update({
	id: "/calendario",
	path: "/calendario",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellConfiguracoesRoute = Route$19.update({
	id: "/configuracoes",
	path: "/configuracoes",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellFinanceiroRoute = Route$18.update({
	id: "/financeiro",
	path: "/financeiro",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellGestaoRoute = Route$17.update({
	id: "/gestao",
	path: "/gestao",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellInicioRoute = Route$16.update({
	id: "/inicio",
	path: "/inicio",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellMaisRoute = Route$15.update({
	id: "/mais",
	path: "/mais",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellPresencasRoute = Route$14.update({
	id: "/presencas",
	path: "/presencas",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellEventosIndexRoute = Route$13.update({
	id: "/eventos/",
	path: "/eventos/",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellEventosIdRoute = Route$32.update({
	id: "/eventos/$id",
	path: "/eventos/$id",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellEventosCheckinsRoute = Route$12.update({
	id: "/eventos/checkins",
	path: "/eventos/checkins",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellEventosNovoRoute = Route$11.update({
	id: "/eventos/novo",
	path: "/eventos/novo",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellHospitalariaCardapiosRoute = Route$10.update({
	id: "/hospitalaria/cardapios",
	path: "/hospitalaria/cardapios",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellHospitalariaEscalaRoute = Route$9.update({
	id: "/hospitalaria/escala",
	path: "/hospitalaria/escala",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellMembrosIndexRoute = Route$8.update({
	id: "/membros/",
	path: "/membros/",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellMembrosIdRoute = Route$33.update({
	id: "/membros/$id",
	path: "/membros/$id",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellMembrosNovoRoute = Route$7.update({
	id: "/membros/novo",
	path: "/membros/novo",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellOngoingIdRoute = Route$35.update({
	id: "/ongoing/$id",
	path: "/ongoing/$id",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellRegionalIndexRoute = Route$36.update({
	id: "/regional/",
	path: "/regional/",
	getParentRoute: () => AuthenticatedShellRouteRoute
});
var AuthenticatedShellRouteRouteChildren = {
	AuthenticatedShellAtasRoute,
	AuthenticatedShellCalendarioRoute,
	AuthenticatedShellConfiguracoesRoute,
	AuthenticatedShellFinanceiroRoute,
	AuthenticatedShellGestaoRoute,
	AuthenticatedShellInicioRoute,
	AuthenticatedShellMaisRoute,
	AuthenticatedShellPresencasRoute,
	AuthenticatedShellEventosIdRoute,
	AuthenticatedShellEventosCheckinsRoute,
	AuthenticatedShellEventosNovoRoute,
	AuthenticatedShellHospitalariaCardapiosRoute,
	AuthenticatedShellHospitalariaEscalaRoute,
	AuthenticatedShellMembrosIdRoute,
	AuthenticatedShellMembrosNovoRoute,
	AuthenticatedShellOngoingIdRoute,
	AuthenticatedShellRegionalCalendarioRoute: Route$6.update({
		id: "/regional/calendario",
		path: "/regional/calendario",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellRegionalCapitulosRoute: Route$5.update({
		id: "/regional/capitulos",
		path: "/regional/capitulos",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellRegionalMembrosRoute: Route$4.update({
		id: "/regional/membros",
		path: "/regional/membros",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellRegionalRegioesRoute: Route$3.update({
		id: "/regional/regioes",
		path: "/regional/regioes",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellSindicanciasFichasRoute: Route$38.update({
		id: "/sindicancias/fichas",
		path: "/sindicancias/fichas",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellSindicanciasProcessosRoute: Route$2.update({
		id: "/sindicancias/processos",
		path: "/sindicancias/processos",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellTesourariaFluxoRoute: Route$1.update({
		id: "/tesouraria/fluxo",
		path: "/tesouraria/fluxo",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellTesourariaMensalidadesRoute: Route.update({
		id: "/tesouraria/mensalidades",
		path: "/tesouraria/mensalidades",
		getParentRoute: () => AuthenticatedShellRouteRoute
	}),
	AuthenticatedShellEventosIndexRoute,
	AuthenticatedShellMembrosIndexRoute,
	AuthenticatedShellRegionalIndexRoute,
	AuthenticatedShellMembrosIdEditarRoute: Route$34.update({
		id: "/membros/$id_/editar",
		path: "/membros/$id/editar",
		getParentRoute: () => AuthenticatedShellRouteRoute
	})
};
var AuthenticatedRouteRouteChildren = {
	AuthenticatedShellRouteRoute: AuthenticatedShellRouteRoute._addFileChildren(AuthenticatedShellRouteRouteChildren),
	AuthenticatedSelecionarCapituloRoute,
	AuthenticatedIndexRoute
};
var AuthenticatedRouteRouteWithChildren = AuthenticatedRouteRoute._addFileChildren(AuthenticatedRouteRouteChildren);
var DocumentacaoRouteRouteChildren = {
	DocumentacaoGuiaRoute,
	DocumentacaoOpenSourceRoute,
	DocumentacaoTecnicaRoute,
	DocumentacaoIndexRoute
};
var rootRouteChildren = {
	AuthenticatedRouteRoute: AuthenticatedRouteRouteWithChildren,
	DocumentacaoRouteRoute: DocumentacaoRouteRoute._addFileChildren(DocumentacaoRouteRouteChildren),
	AuthRoute
};
var routeTree = Route$31._addFileChildren(rootRouteChildren)._addFileTypes();
var QUERY_STALE_MS = 6e4;
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient({ defaultOptions: { queries: {
			staleTime: QUERY_STALE_MS,
			refetchOnWindowFocus: false
		} } }) },
		scrollRestoration: true,
		defaultPreloadStaleTime: QUERY_STALE_MS
	});
};
//#endregion
export { getRouter };
