import type { ReactNode } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Raízes da barra de abas: no celular não mostram "voltar". */
const TAB_ROOTS = new Set(["/inicio", "/membros", "/presencas", "/tesouraria/fluxo", "/perfil", "/regional"]);

/** Seção do menu deduzida pela rota, quando a tela não informa `eyebrow`. */
const SECTION_BY_PREFIX: [string, string][] = [
  ["/membros", "Secretaria"],
  ["/atas", "Secretaria"],
  ["/oficios", "Secretaria"],
  ["/presencas", "Secretaria"],
  ["/tesouraria", "Tesouraria"],
  ["/calendario", "Gestão"],
  ["/gestao", "Gestão"],
  ["/configuracoes", "Gestão"],
  ["/eventos", "Comissão de Eventos"],
  ["/sindicancias", "Comissão de Sindicâncias"],
  ["/hospitalaria", "Hospitalaria"],
  ["/regional", "Gestão regional"],
];

/** Cabeçalho de página do redesign: seção (opcional), título grande, subtítulo e ações. */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Seção do menu acima do título (ex.: "Secretaria"). */
  eyebrow?: string;
}) {
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const router = useRouter();
  const showBack = !TAB_ROOTS.has(pathname);
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else void router.navigate({ to: pathname === "/mais" ? "/inicio" : "/mais" });
  }
  const section =
    eyebrow ?? SECTION_BY_PREFIX.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1];
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:mb-6">
      <div className="min-w-0">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Voltar"
            className="-ml-2 mb-1 grid h-11 w-11 place-items-center rounded-full text-tv-text hover:bg-tv-surface md:hidden"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : null}
        {section ? <p className="text-sm text-tv-text-2">{section}</p> : null}
        <h1 className="mt-0.5 truncate font-display text-[28px] font-extrabold tracking-[-0.02em] text-tv-text lg:text-[32px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-[15px] text-tv-text-2">{subtitle}</p> : null}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2.5 sm:w-auto">{actions}</div>
      )}
    </header>
  );
}
