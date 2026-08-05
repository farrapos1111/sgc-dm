import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { termLabel } from "@/lib/terms";

export type PositionHistoryItem = {
  label: string;
  term_year: number;
  term_semester: number;
  chapter_name: string;
  chapter_number?: string | null;
};

/** Formato: Cargo X - Gestão Y - Capítulo Z */
export function formatPositionHistoryLine(item: PositionHistoryItem): string {
  const gestao = termLabel(item.term_year, item.term_semester);
  const cap = item.chapter_number
    ? `${item.chapter_name} Nº ${item.chapter_number}`
    : item.chapter_name;
  return `${item.label} - ${gestao} - ${cap}`;
}

export function PositionHistoryCollapsible({
  items,
  title = "Histórico de cargos em outros capítulos",
}: {
  items: PositionHistoryItem[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span>{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-1.5 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={`${item.label}-${item.term_year}-${item.term_semester}-${i}`}>
              {formatPositionHistoryLine(item)}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
