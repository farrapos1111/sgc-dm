import { useChapterLogo } from "@/lib/chapter-logo";
import { cn } from "@/lib/utils";

/**
 * Avatar da logo do capítulo.
 * O tamanho externo vem só de `className` (ex.: h-12 w-12) — igual aos outros.
 * Com logo: object-contain + padding interno, sem cortar.
 */
export function ChapterLogoAvatar({
  logoPath,
  logoUrl: logoUrlProp,
  number,
  color,
  className,
  imgClassName,
}: {
  logoPath?: string | null;
  /** URL já resolvida (assinada). Se omitida, resolve a partir de logoPath. */
  logoUrl?: string | null;
  number?: string | null;
  color?: string | null;
  className?: string;
  imgClassName?: string;
}) {
  const signed = useChapterLogo(logoUrlProp ? null : logoPath);
  const logoUrl = logoUrlProp || signed;
  const fallback = (number ?? "").slice(-3) || "SG";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden text-xs font-bold text-white",
        logoUrl ? "bg-white dark:bg-zinc-900" : null,
        className,
      )}
      style={logoUrl ? undefined : { backgroundColor: color || "#9E1B32" }}
      aria-hidden
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={cn(
            "absolute inset-0 m-auto box-border h-full w-full object-contain p-1.5",
            imgClassName,
          )}
        />
      ) : (
        <span className="grid h-full w-full place-items-center">{fallback}</span>
      )}
    </div>
  );
}
