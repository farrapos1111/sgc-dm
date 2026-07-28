import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  DOCS_SIDEBAR_NAV,
  type DocsCategorySlug,
} from "@/lib/docs-catalog";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type DocsSidebarProps = {
  activeSlug: DocsCategorySlug | "hub";
  onNavigate?: () => void;
  className?: string;
};

export function DocsSidebar({ activeSlug, onNavigate, className }: DocsSidebarProps) {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(typeof window !== "undefined" ? window.location.hash.slice(1) : "");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [activeSlug]);

  return (
    <nav className={cn("flex flex-col gap-1 py-1", className)} aria-label="Navegação da documentação">
      <Link
        to="/documentacao"
        onClick={onNavigate}
        className={cn(
          "mb-3 rounded-md px-3 py-2 text-sm font-semibold no-underline transition-colors",
          activeSlug === "hub"
            ? "bg-[#9E1B32]/10 text-[#9E1B32]"
            : "text-foreground hover:bg-muted",
        )}
      >
        Visão geral
      </Link>

      {DOCS_SIDEBAR_NAV.map(({ category, sections }) => {
        const isActive = activeSlug === category.slug;
        const Icon = category.icon;

        return (
          <SidebarGroup
            key={category.slug}
            defaultOpen={isActive || activeSlug === "hub"}
            forceOpen={isActive}
          >
            <div className="mb-1">
              <div className="flex items-center gap-0.5">
                <Link
                  to={category.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide no-underline transition-colors hover:bg-muted",
                    isActive ? "text-[#9E1B32]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{category.shortLabel}</span>
                </Link>
                <CollapsibleTrigger
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&[data-state=open]>svg]:rotate-180"
                  aria-label={`Expandir ${category.shortLabel}`}
                >
                  <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent>
                <ul className="mt-0.5 space-y-0.5 border-l border-border ml-3 pl-0">
                  <li>
                    <Link
                      to={category.to}
                      onClick={onNavigate}
                      className={cn(
                        "relative block border-l-2 border-transparent py-1.5 pl-3 -ml-px text-sm no-underline transition-colors",
                        isActive && !hash
                          ? "border-[#9E1B32] font-medium text-[#9E1B32]"
                          : "text-foreground/80 hover:text-foreground",
                      )}
                    >
                      Introdução
                    </Link>
                  </li>
                  {sections.map((section) => {
                    const sectionActive = isActive && hash === section.id;
                    return (
                      <li key={section.id}>
                        <a
                          href={`${category.to}#${section.id}`}
                          onClick={onNavigate}
                          className={cn(
                            "relative block border-l-2 border-transparent py-1.5 pl-3 -ml-px text-sm no-underline transition-colors",
                            sectionActive
                              ? "border-[#9E1B32] font-medium text-[#9E1B32]"
                              : "text-foreground/70 hover:text-foreground",
                          )}
                        >
                          {section.text}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </div>
          </SidebarGroup>
        );
      })}
    </nav>
  );
}

function SidebarGroup({
  children,
  defaultOpen,
  forceOpen,
}: {
  children: ReactNode;
  defaultOpen: boolean;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {children}
    </Collapsible>
  );
}
