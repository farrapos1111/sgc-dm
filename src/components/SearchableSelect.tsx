import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn, matchesLooseSearch } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  /** Agrupa opções no dropdown (ex.: categoria). */
  group?: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nenhum resultado.",
  minQueryLength = 0,
  minQueryHint,
  className,
  disabled,
}: {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Só lista opções após digitar pelo menos N caracteres. */
  minQueryLength?: number;
  minQueryHint?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);
  const queryReady = query.trim().length >= minQueryLength;

  const filtered = useMemo(() => {
    if (!queryReady) return [];
    return options.filter(
      (o) =>
        matchesLooseSearch(o.label, query) ||
        (o.group ? matchesLooseSearch(o.group, query) : false),
    );
  }, [options, query, queryReady]);

  const grouped = useMemo(() => {
    const hasGroups = filtered.some((o) => o.group);
    if (!hasGroups) {
      return [{ heading: undefined as string | undefined, items: filtered }];
    }
    const map = new Map<string, SearchableOption[]>();
    const ungrouped: SearchableOption[] = [];
    for (const o of filtered) {
      if (!o.group) {
        ungrouped.push(o);
        continue;
      }
      const list = map.get(o.group) ?? [];
      list.push(o);
      map.set(o.group, list);
    }
    const result = [...map.entries()].map(([heading, items]) => ({
      heading,
      items,
    }));
    if (ungrouped.length > 0) {
      result.push({ heading: undefined, items: ungrouped });
    }
    return result;
  }, [filtered]);

  const emptyMessage =
    !queryReady && minQueryLength > 0
      ? (minQueryHint ?? `Digite ao menos ${minQueryLength} letras.`)
      : emptyText;

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {grouped.map((g, i) => (
              <CommandGroup
                key={g.heading ?? `__ungrouped-${i}`}
                heading={g.heading}
              >
                {g.items.map((o) => {
                  const isSelected = o.value === value;
                  return (
                    <CommandItem
                      key={o.value}
                      value={o.value}
                      onSelect={() => {
                        onChange(o.value);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
