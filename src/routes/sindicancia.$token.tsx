import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SindicanciaParticipationView } from "@/components/investigations/SindicanciaParticipationView";
import {
  resolveSindicanciaParticipation,
  type SindicanciaParticipationPayload,
} from "@/lib/investigations.functions";

const storageKey = (token: string) => `sgcdm.sind-part.${token}`;

export const Route = createFileRoute("/sindicancia/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Participação — Sindicância" },
      {
        name: "description",
        content: "Acesso de participante à sindicância em andamento.",
      },
    ],
  }),
  component: PublicSindicanciaPage,
});

function PublicSindicanciaPage() {
  const { token } = Route.useParams();
  const [demolayId, setDemolayId] = useState("");
  const [session, setSession] = useState<SindicanciaParticipationPayload | null>(
    null,
  );
  const [unlockedId, setUnlockedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(storageKey(token));
  });
  const [closed, setClosed] = useState(false);
  const resumed = useRef(false);

  const unlock = useMutation({
    mutationFn: (id: string) =>
      resolveSindicanciaParticipation({ data: { token, demolayId: id } }),
    onSuccess: (payload, id) => {
      sessionStorage.setItem(storageKey(token), id);
      setUnlockedId(id);
      setSession(payload);
    },
    onError: (e: unknown) => {
      sessionStorage.removeItem(storageKey(token));
      setUnlockedId(null);
      setSession(null);
      toast.error(
        e instanceof Error
          ? e.message
          : "Este ID não é participante desta sindicância",
      );
    },
  });

  useEffect(() => {
    if (!unlockedId || resumed.current) return;
    resumed.current = true;
    unlock.mutate(unlockedId);
  }, [unlockedId, unlock]);

  const accent = session?.primaryColor || "var(--chapter-primary)";

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Comissão de Sindicâncias
            </p>
            <h1 className="text-lg font-semibold">
              {session?.eventTitle || "Participação na sindicância"}
            </h1>
            {session?.chapterName ? (
              <p className="text-xs text-muted-foreground">{session.chapterName}</p>
            ) : null}
          </div>
          <ThemeToggle />
        </div>
        <div className="h-0.5" style={{ backgroundColor: accent }} />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {closed ? (
          <Card className="rounded-[12px] p-5">
            <p className="text-sm">
              A ata foi concluída. Este link não abre mais as ferramentas.
            </p>
          </Card>
        ) : session && unlockedId ? (
          <Card className="rounded-[12px] p-5">
            <SindicanciaParticipationView
              token={token}
              demolayId={unlockedId}
              session={session}
              onClosed={() => {
                sessionStorage.removeItem(storageKey(token));
                setSession(null);
                setUnlockedId(null);
                setClosed(true);
              }}
            />
          </Card>
        ) : unlock.isPending && unlockedId && !session ? (
          <Card className="rounded-[12px] p-5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Conferindo o ID…
            </p>
          </Card>
        ) : (
          <Card className="rounded-[12px] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4" /> Identificação
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Informe o ID DeMolay. Só abre a ferramenta se você for o
              sindicante, o escrivão de parecer ou o tio/senior desta
              sindicância.
            </p>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const id = demolayId.trim();
                if (!id) return;
                unlock.mutate(id);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="demolay-id">ID DeMolay</Label>
                <Input
                  id="demolay-id"
                  value={demolayId}
                  autoComplete="off"
                  onChange={(e) => setDemolayId(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={unlock.isPending || !demolayId.trim()}>
                {unlock.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Entrar
              </Button>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
