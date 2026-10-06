import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TermSelect } from "@/components/TermSelect";
import { getPublicNominata } from "@/lib/public-conference.functions";
import { chapterFoundedAt, currentTerm, termOptions } from "@/lib/terms";

export const Route = createFileRoute("/$org/nominata")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Nominata — Templo Virtual" }],
  }),
  component: PublicNominataPage,
});

const COMMISSION_ROLES = [
  { value: "presidente", label: "Presidente" },
  { value: "vice", label: "Vice" },
  { value: "membro", label: "Membro" },
  { value: "auxiliar_senior", label: "Auxiliar Sênior" },
] as const;

type SortKey = "default" | "name_asc" | "name_desc";

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function PublicNominataPage() {
  const { token } = usePublicLobby();
  const [term, setTerm] = useState(currentTerm());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-nominata", token, term.year, term.semester],
    queryFn: () =>
      getPublicNominata({
        data: { token, year: term.year, semester: term.semester },
      }),
    enabled: Boolean(token),
    retry: false,
  });

  const terms = useMemo(
    () =>
      termOptions({
        foundedAt: chapterFoundedAt({
          settings: { founded_at: data?.chapter.founded_at ?? undefined },
        }),
      }),
    [data?.chapter.founded_at],
  );

  const q = normalizeSearch(search);
  const byPosition = useMemo(() => {
    const map = new Map<number, { id: string; member_name: string }[]>();
    for (const row of data?.assignments ?? []) {
      const list = map.get(row.position_id) ?? [];
      list.push(row);
      map.set(row.position_id, list);
    }
    return map;
  }, [data?.assignments]);

  const positions = useMemo(() => {
    let list = (data?.positions ?? []).filter((p) => p.role_group !== "comissoes");
    if (q) {
      list = list.filter((p) => {
        if (normalizeSearch(p.label).includes(q)) return true;
        return (byPosition.get(p.id) ?? []).some((a) =>
          normalizeSearch(a.member_name).includes(q),
        );
      });
    }
    if (sortKey === "name_asc") {
      list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    } else if (sortKey === "name_desc") {
      list.sort((a, b) => b.label.localeCompare(a.label, "pt-BR"));
    } else {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return list;
  }, [data?.positions, byPosition, q, sortKey]);

  const commissionRoles = data?.commission_roles ?? [];

  function holdersFor(role: string, includeAll: boolean) {
    return commissionRoles
      .filter((row) => row.role === role)
      .filter((row) => {
        if (!q || includeAll) return true;
        return (
          normalizeSearch(row.member_name).includes(q) ||
          normalizeSearch(row.commission_label).includes(q)
        );
      })
      .slice()
      .sort((a, b) => a.member_name.localeCompare(b.member_name, "pt-BR"));
  }

  const chapter = data?.chapter;
  const accent = chapter?.primary_color || "#9E1B32";
  const hasGrouped = positions.some((p) => p.role_group != null);
  const sections = hasGrouped
    ? ([
        { id: "ritualisticos", label: "Ritualísticos" },
        { id: "conselho", label: "Conselho" },
        { id: "comissoes", label: "Funções de comissão" },
        { id: "outros", label: "Outros" },
      ] as const)
    : ([{ id: "all", label: "Cargos" }] as const);

  if (!token || error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta nominata pública é inválida ou foi revogada.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <header
        className="border-b border-border px-4 py-5 sm:px-6"
        style={{ borderTop: `3px solid ${accent}` }}
      >
        <div className="mx-auto flex max-w-[1680px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nominata · visualização pública
            </p>
            <h1 className="text-xl font-semibold sm:text-2xl">
              {chapter
                ? `${chapter.name} nº ${chapter.number}`
                : isLoading
                  ? "Carregando…"
                  : "Nominata"}
            </h1>
            {chapter?.city ? (
              <p className="text-sm text-muted-foreground">{chapter.city}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9 shrink-0" />
            <TermSelect value={term} terms={terms} onChange={setTerm} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6">
        <LobbyBackLink />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro ou cargo…"
              aria-label="Buscar membro ou cargo"
              className="pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Ordem padrão</SelectItem>
              <SelectItem value="name_asc">Nome A–Z</SelectItem>
              <SelectItem value="name_desc">Nome Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : (
          <div
            className={
              hasGrouped ? "grid grid-cols-1 gap-4 xl:grid-cols-3" : "grid grid-cols-1 gap-4"
            }
          >
            {sections.map((section) => {
              const scopePositions =
                section.id === "all"
                  ? positions
                  : section.id === "outros"
                    ? positions.filter((p) => p.role_group == null)
                    : section.id === "comissoes"
                      ? []
                      : positions.filter((p) => p.role_group === section.id);
              const visibleRoles = COMMISSION_ROLES.filter((role) => {
                if (!q) return true;
                if (normalizeSearch(role.label).includes(q)) return true;
                return holdersFor(role.value, false).length > 0;
              });
              if (section.id === "comissoes") {
                if (q && visibleRoles.length === 0) return null;
              } else if (
                hasGrouped &&
                scopePositions.length === 0 &&
                (q || section.id === "outros")
              ) {
                return null;
              }
              return (
                <Card key={section.id} className="rounded-[12px] p-5">
                  <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                    {section.label}
                  </h2>
                  {section.id === "comissoes" ? (
                    <ul className="divide-y divide-border text-sm">
                      {visibleRoles.map((role) => {
                        const roleMatches = !q || normalizeSearch(role.label).includes(q);
                        const holders = holdersFor(role.value, roleMatches);
                        return (
                          <li key={role.value} className="py-2.5">
                            <div className="font-medium">{role.label}</div>
                            {holders.length > 0 ? (
                              <ul className="mt-0.5 space-y-0.5">
                                {holders.map((row) => (
                                  <li
                                    key={row.id}
                                    className="truncate text-xs text-muted-foreground"
                                  >
                                    {row.member_name}
                                    {" · "}
                                    {row.commission_label}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Ninguém nesta vigência
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : scopePositions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum cargo correspondente à busca.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {scopePositions.map((position) => {
                        const assigned = (byPosition.get(position.id) ?? []).filter(
                          (row) => !q || normalizeSearch(row.member_name).includes(q) || normalizeSearch(position.label).includes(q),
                        );
                        const occupied = (byPosition.get(position.id) ?? []).length > 0;
                        return (
                          <li key={position.id} className="py-2.5">
                            <div className="font-medium">{position.label}</div>
                            {assigned.length > 0 ? (
                              <ul className="mt-0.5 space-y-0.5">
                                {assigned.map((row) => (
                                  <li
                                    key={row.id}
                                    className="truncate text-xs text-muted-foreground"
                                  >
                                    {row.member_name}
                                  </li>
                                ))}
                              </ul>
                            ) : occupied && q ? (
                              <div className="text-xs text-muted-foreground">
                                Ocupado (sem membro na busca)
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Vago</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
