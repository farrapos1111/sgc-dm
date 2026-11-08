import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { consoleSearchPeople } from "@/lib/console/console.functions";
import { ConsoleTitle, REALM_DOT, REALM_NAMES } from "@/components/console/console-ui";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/console/_app/pessoas/")({
  component: PeoplePage,
});

function PeoplePage() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 350);
    return () => window.clearTimeout(t);
  }, [input]);

  const { data, isFetching, error } = useQuery({
    queryKey: ["console", "people", q],
    queryFn: () => consoleSearchPeople({ data: { q } }),
    enabled: q.length >= 2,
  });

  return (
    <div>
      <ConsoleTitle title="Pessoas" subtitle="Busque contas e fichas em todas as esferas." />
      <div className="relative mb-5 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nome, e-mail completo, ID DeMolay, ID FDJ ou ID maçônico"
          className="pl-9"
        />
      </div>

      {q.length < 2 ? (
        <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>
      ) : error ? (
        <p className="text-sm text-destructive">{String(error)}</p>
      ) : (
        <div className={`grid gap-4 lg:grid-cols-2 ${isFetching ? "opacity-70" : ""}`}>
          <Card className="p-0">
            <p className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Contas ({data?.accounts.length ?? 0})
            </p>
            <ul className="divide-y divide-border">
              {(data?.accounts ?? []).map((a) => (
                <li key={a.userId}>
                  <Link
                    to="/console/pessoas/$userId"
                    params={{ userId: a.userId }}
                    className="block px-4 py-2.5 hover:bg-muted/50"
                  >
                    <p className="truncate text-sm font-medium">{a.fullName ?? "Sem nome"}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.email ?? a.userId}</p>
                  </Link>
                </li>
              ))}
              {!data?.accounts.length && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma conta.
                </li>
              )}
            </ul>
          </Card>
          <Card className="p-0">
            <p className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Fichas sem conta ({data?.fichasSemConta.length ?? 0})
            </p>
            <ul className="divide-y divide-border">
              {(data?.fichasSemConta ?? []).map((f) => (
                <li key={`${f.esfera}-${f.id}`}>
                  <Link
                    to="/console/instituicoes/$id"
                    params={{ id: f.chapterId }}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50"
                  >
                    <span className={`h-2 w-2 rounded-full ${REALM_DOT[f.esfera]}`} />
                    <span className="flex-1 truncate text-sm">{f.fullName}</span>
                    <span className="text-xs text-muted-foreground">{REALM_NAMES[f.esfera]}</span>
                  </Link>
                </li>
              ))}
              {!data?.fichasSemConta.length && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma ficha solta.
                </li>
              )}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
