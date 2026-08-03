import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type MemberLite = {
  id: string;
  full_name: string;
  kind?: string | null;
};

type Props = {
  label: string;
  members: MemberLite[];
  /** Filtra por kinds; omitido = todos */
  kinds?: Array<"demolay_ativo" | "senior" | "macom">;
  memberId: string | null;
  placeholder?: string;
  hint?: string;
  onChange: (memberId: string | null, fullName: string) => void;
};

export function MemberSearchSelect({
  label,
  members,
  kinds,
  memberId,
  placeholder = "Buscar membro…",
  hint,
  onChange,
}: Props) {
  const selected = members.find((m) => m.id === memberId) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const pool = useMemo(() => {
    if (!kinds?.length) return members;
    const set = new Set<string>(kinds);
    return members.filter((m) => m.kind && set.has(m.kind));
  }, [members, kinds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return pool.slice(0, 12);
    return pool
      .filter((m) => m.full_name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [pool, query]);

  if (selected) {
    return (
      <div>
        <Label className="mb-1.5 block text-sm">{label}</Label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">
            {selected.full_name}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              onChange(null, "");
              setQuery("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {hint ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      <Input
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // delay so click on option registers
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
      {open && (
        <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-popover text-sm shadow-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-muted-foreground">
              Nenhum membro encontrado
            </li>
          ) : (
            filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(m.id, m.full_name);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{m.full_name}</span>
                  {m.kind ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {kindLabel(m.kind)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function kindLabel(kind: string): string {
  if (kind === "senior") return "Senior";
  if (kind === "macom") return "Tio";
  if (kind === "demolay_ativo") return "DeMolay";
  return kind;
}
