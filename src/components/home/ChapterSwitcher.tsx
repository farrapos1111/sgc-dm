import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Check, LayoutGrid } from "lucide-react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { useChapterLogo } from "@/lib/chapter-logo";
import { compareOrgNumbers, ORG_TYPE_LABELS, normalizeOrgType } from "@/lib/org-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Menu "Trocar instituição" do Início (mobile): abre no lugar, com o logo de
 * cada instituição e as visões regionais, sem voltar à tela de seleção.
 */
export function ChapterSwitcher({ trigger }: { trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { active, memberships, setActiveChapterId } = useActiveChapter();
  const { scopes, setActiveScopeKey } = useOrgScope();

  const chapters = useMemo(() => {
    const byId = new Map<string, (typeof memberships)[number]>();
    for (const m of memberships) if (!byId.has(m.chapter_id)) byId.set(m.chapter_id, m);
    return [...byId.values()].sort((a, b) =>
      compareOrgNumbers(a.chapter.number ?? "", b.chapter.number ?? ""),
    );
  }, [memberships]);

  function pickChapter(id: string) {
    setOpen(false);
    setActiveScopeKey(null);
    if (id !== active?.chapter_id) {
      setActiveChapterId(id);
      const m = chapters.find((c) => c.chapter_id === id);
      toast.message(`${m?.chapter.name ?? "Instituição"} selecionada`);
    }
    void navigate({ to: "/inicio" });
  }

  function pickScope(key: string) {
    setOpen(false);
    setActiveScopeKey(key);
    void navigate({ to: "/regional" });
  }

  return (
    <ChapterSwitcherMenu
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      chapters={chapters.map((m) => ({
        id: m.chapter_id,
        name: m.chapter.name,
        number: m.chapter.number ?? "",
        subtitle: [ORG_TYPE_LABELS[normalizeOrgType(m.chapter.org_type)], m.chapter.city]
          .filter(Boolean)
          .join(" · "),
        logoPath: m.chapter.logo_url,
        color: m.chapter.primary_color,
        selected: m.chapter_id === active?.chapter_id,
      }))}
      scopes={scopes.map((s) => ({
        id: s.key,
        name: s.label,
        number: "",
        subtitle: ORG_ROLE_LABELS[s.orgRole],
        logoPath: s.logoUrl ?? null,
        color: s.primaryColor ?? null,
        selected: false,
      }))}
      onPickChapter={pickChapter}
      onPickScope={pickScope}
      onOpenMenu={() => {
        setOpen(false);
        void navigate({ to: "/mais" });
      }}
    />
  );
}

export type SwitcherEntry = {
  id: string;
  name: string;
  number: string;
  subtitle: string;
  logoPath: string | null;
  color: string | null;
  selected: boolean;
};

export function ChapterSwitcherMenu({
  trigger,
  open,
  onOpenChange,
  chapters,
  scopes,
  onPickChapter,
  onPickScope,
  onOpenMenu,
}: {
  trigger: ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: SwitcherEntry[];
  scopes: SwitcherEntry[];
  onPickChapter: (id: string) => void;
  onPickScope: (id: string) => void;
  onOpenMenu: () => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[calc(100vw-32px)] max-w-[360px] rounded-[20px] border-0 bg-tv-surface p-2 text-tv-text shadow-[0_12px_32px_rgba(20,20,20,0.18)]"
      >
        <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-tv-text-2">
          Suas instituições
        </p>
        <ul className="max-h-[60vh] overflow-y-auto">
          {chapters.map((c) => (
            <li key={c.id}>
              <ChapterRow {...c} onSelect={() => onPickChapter(c.id)} />
            </li>
          ))}
          {scopes.length > 0 && (
            <>
              <li className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-tv-text-2">
                Visões regionais
              </li>
              {scopes.map((c) => (
                <li key={c.id}>
                  <ChapterRow {...c} onSelect={() => onPickScope(c.id)} />
                </li>
              ))}
            </>
          )}
        </ul>
        <button
          type="button"
          onClick={onOpenMenu}
          className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold text-tv-primary hover:bg-tv-bg"
        >
          <LayoutGrid className="h-5 w-5" />
          Menu completo e opções
        </button>
      </PopoverContent>
    </Popover>
  );
}

function ChapterRow({
  name,
  number,
  subtitle,
  logoPath,
  color,
  selected,
  onSelect,
}: {
  name: string;
  number: string;
  subtitle: string;
  logoPath: string | null;
  color: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const logo = useChapterLogo(logoPath);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-colors",
        selected ? "bg-tv-soft" : "hover:bg-tv-bg",
      )}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-tv-border bg-white text-sm font-bold text-white"
        style={logo ? undefined : { backgroundColor: color ?? "var(--chapter-primary)" }}
      >
        {logo ? (
          <img src={logo} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          (name[0] ?? "?").toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className={cn("block truncate text-[15px] font-semibold", selected && "text-tv-ink")}>
          {name}
          {number ? ` nº ${number}` : ""}
        </span>
        {subtitle ? (
          <span className="block truncate text-[13px] text-tv-text-2">{subtitle}</span>
        ) : null}
      </span>
      {selected ? <Check className="h-5 w-5 shrink-0 text-tv-primary" aria-label="Atual" /> : null}
    </button>
  );
}
