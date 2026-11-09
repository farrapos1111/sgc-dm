import type { ReactNode } from "react";

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
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:mb-6">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm text-tv-text-2">{eyebrow}</p> : null}
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
