import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import type { DocsCategorySlug } from "@/lib/docs-catalog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type DocsLayoutProps = {
  children: ReactNode;
  activeSlug?: DocsCategorySlug | "hub";
};

export function DocsLayout({ children, activeSlug = "hub" }: DocsLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF8] text-foreground dark:bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-[#FAFAF8]/95 backdrop-blur dark:bg-background/95">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu da documentação"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link to="/documentacao" className="flex items-center gap-2.5 no-underline">
            <img
              src="/favicon.svg"
              alt=""
              className="h-8 w-8"
              width={32}
              height={32}
            />
            <span className="text-sm font-semibold text-foreground">
              Templo Virtual <span className="font-normal text-muted-foreground">Docs</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link
              to="/auth"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[280px] shrink-0 overflow-y-auto border-r border-border/80 bg-[#FAFAF8] px-3 py-5 dark:bg-background lg:block">
          <DocsSidebar activeSlug={activeSlug} />
        </aside>

        <div className="min-w-0 flex-1">
          <main className="px-4 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
          <footer className="border-t border-border/80 px-4 py-6 text-center text-xs text-muted-foreground sm:px-8">
            Templo Virtual · licença{" "}
            <a
              href="https://github.com/farrapos1111/sgc-dm/blob/main/LICENSE"
              className="underline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              AGPL-3.0
            </a>
          </footer>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle className="text-base">Documentação</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-3 py-4">
            <DocsSidebar activeSlug={activeSlug} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
