import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { consoleListChapters } from "@/lib/console/console.functions";
import {
  ActiveBadge,
  ConsoleTitle,
  REALM_DOT,
  REALM_NAMES,
  RealmTag,
} from "@/components/console/console-ui";
import { ChapterFormDialog } from "@/components/console/ChapterFormDialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/console/_app/instituicoes/")({
  component: ChaptersPage,
});

const REALM_FILTERS = ["todas", "odm", "fdj", "loja", "outros"] as const;

function ChaptersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [realm, setRealm] = useState<(typeof REALM_FILTERS)[number]>("todas");
  const [onlyActive, setOnlyActive] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["console", "chapters"],
    queryFn: () => consoleListChapters(),
  });

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.items ?? []).filter((c) => {
      const r = c.realm ?? "outros";
      if (realm !== "todas" && r !== realm) return false;
      if (onlyActive && !c.active) return false;
      if (!term) return true;
      return `${c.name} ${c.number} ${c.city ?? ""} ${c.region?.name ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [data, q, realm, onlyActive]);

  if (isPending) return <PageSkeleton />;

  return (
    <div>
      <ConsoleTitle
        title="Instituições"
        subtitle={`${data?.items.length ?? 0} cadastradas em todas as esferas`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova instituição
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {REALM_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRealm(r)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                realm === r
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r !== "todas" && <span className={`h-2 w-2 rounded-full ${REALM_DOT[r]}`} />}
              {r === "todas" ? "Todas" : REALM_NAMES[r]}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Só ativas
          </label>
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, número, cidade"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="divide-y divide-border overflow-hidden p-0">
        {items.map((c) => (
          <Link
            key={c.id}
            to="/console/instituicoes/$id"
            params={{ id: c.id }}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {c.name} <span className="text-muted-foreground">nº {c.number}</span>
              </p>
              <p className="flex flex-wrap items-center gap-x-2 truncate text-xs text-muted-foreground">
                <RealmTag realm={c.realm} orgType={c.org_type} />
                {[c.city, c.state?.uf, c.region?.name].filter(Boolean).join(" · ")}
              </p>
            </div>
            <ActiveBadge active={c.active} />
          </Link>
        ))}
        {!items.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">Nada encontrado.</p>
        )}
      </Card>

      {creating && (
        <ChapterFormDialog
          initial={null}
          onClose={() => setCreating(false)}
          onSaved={(id) => navigate({ to: "/console/instituicoes/$id", params: { id } })}
        />
      )}
    </div>
  );
}
