import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, Lock, XCircle } from "lucide-react";
import {
  getPublicMinute,
  minutePublicShareStorageKey,
  submitPublicMinuteVote,
} from "@/lib/minutes-share.functions";
import { formatDateTimeBR } from "@/lib/format";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/ata/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ata — SG-CDM" },
      {
        name: "description",
        content: "Leitura pública da ata da sessão.",
      },
    ],
  }),
  component: PublicAtaPage,
});

function PublicAtaPage() {
  const { token } = Route.useParams();
  const storageKey = minutePublicShareStorageKey(token);

  const [passwordInput, setPasswordInput] = useState("");
  const [unlockedPassword, setUnlockedPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(storageKey) ?? "";
  });
  const [email, setEmail] = useState("");
  const [decision, setDecision] = useState<"aprovada" | "reprovada" | null>(null);
  const [justification, setJustification] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const minuteQuery = useQuery({
    queryKey: ["public-minute", token, unlockedPassword],
    queryFn: () =>
      getPublicMinute({ data: { token, password: unlockedPassword } }),
    enabled: unlockedPassword.length > 0,
    retry: false,
  });

  const unlock = useMutation({
    mutationFn: async (password: string) => {
      const payload = await getPublicMinute({ data: { token, password } });
      return { password, payload };
    },
    onSuccess: ({ password }) => {
      sessionStorage.setItem(storageKey, password);
      setUnlockedPassword(password);
      toast.success("Acesso liberado nesta sessão");
    },
    onError: (e: Error) => toast.error(e.message || "Senha incorreta"),
  });

  const vote = useMutation({
    mutationFn: () => {
      if (!decision) throw new Error("Escolha aprovada ou reprovada");
      return submitPublicMinuteVote({
        data: {
          token,
          password: unlockedPassword,
          email,
          decision,
          justification: decision === "reprovada" ? justification : null,
        },
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success(
        decision === "aprovada" ? "Aprovação registrada" : "Reprovação registrada",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao registrar feedback"),
  });

  const accent =
    minuteQuery.data?.chapter.primary_color || "#9E1B32";

  if (!unlockedPassword) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> Ata da sessão
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-lg px-4 py-10">
          <div className="mb-4">
            <h1 className="text-lg font-semibold">Acesso protegido</h1>
            <p className="text-sm text-muted-foreground">
              Informe a senha compartilhada pelo capítulo para ler a ata.
            </p>
          </div>
          <Card className="space-y-4 rounded-[12px] p-5">
            <div>
              <Label className="mb-1.5 block text-sm">Senha</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={passwordInput}
                  placeholder="Senha"
                  autoComplete="current-password"
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (passwordInput.trim()) unlock.mutate(passwordInput.trim());
                    }
                  }}
                />
                <Button
                  type="button"
                  style={{ backgroundColor: accent }}
                  disabled={unlock.isPending || !passwordInput.trim()}
                  onClick={() => unlock.mutate(passwordInput.trim())}
                >
                  {unlock.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" /> Entrar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (minuteQuery.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (minuteQuery.error || !minuteQuery.data) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> Ata da sessão
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-lg px-4 py-10">
          <Card className="rounded-[12px] p-5">
            <p className="text-sm text-muted-foreground">
              {(minuteQuery.error as Error | null)?.message ??
                "Link indisponível ou senha inválida."}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem(storageKey);
                setUnlockedPassword("");
              }}
            >
              Tentar outra senha
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const { minute, chapter, event } = minuteQuery.data;
  const votingOpen = minute.voting_open;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> {chapter.name}
            {chapter.number ? ` nº ${chapter.number}` : ""}
          </div>
          <p className="text-xs text-muted-foreground">
            {event.title} · {formatDateTimeBR(event.start_at)}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <Card className="rounded-[12px] p-5">
          <h1 className="mb-3 text-base font-semibold">Ata da sessão</h1>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {minute.content || "—"}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Atualizada em {formatDateTimeBR(minute.updated_at)}
          </p>
        </Card>

        <Card className="rounded-[12px] p-5">
          <h2 className="mb-1 text-sm font-semibold">Seu feedback</h2>
          {!votingOpen ? (
            <p className="text-sm text-muted-foreground">
              Consulta encerrada — a ata já saiu do rascunho.
            </p>
          ) : submitted ? (
            <p className="flex items-center gap-2 text-sm" style={{ color: "#047857" }}>
              <CheckCircle2 className="h-4 w-4" />
              Feedback registrado. Obrigado!
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Informe seu e-mail e registre se aprova ou reprova a ata. Isso é um
                feedback ao capítulo e não substitui as assinaturas oficiais.
              </p>
              <div>
                <Label className="mb-1.5 block text-sm">E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  placeholder="seu@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={decision === "aprovada" ? "default" : "outline"}
                  style={
                    decision === "aprovada"
                      ? { backgroundColor: "#047857" }
                      : undefined
                  }
                  onClick={() => setDecision("aprovada")}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprovada
                </Button>
                <Button
                  type="button"
                  variant={decision === "reprovada" ? "default" : "outline"}
                  style={
                    decision === "reprovada"
                      ? { backgroundColor: "#B91C1C" }
                      : undefined
                  }
                  onClick={() => setDecision("reprovada")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reprovada
                </Button>
              </div>

              {decision === "reprovada" && (
                <div>
                  <Label className="mb-1.5 block text-sm">Justificativa</Label>
                  <Textarea
                    value={justification}
                    rows={4}
                    placeholder="Descreva o motivo da reprovação…"
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </div>
              )}

              <Button
                type="button"
                className="w-full sm:w-auto"
                style={{ backgroundColor: accent }}
                disabled={
                  vote.isPending ||
                  !email.trim() ||
                  !decision ||
                  (decision === "reprovada" && !justification.trim())
                }
                onClick={() => vote.mutate()}
              >
                {vote.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                  </>
                ) : (
                  "Enviar feedback"
                )}
              </Button>
            </div>
          )}
        </Card>

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          SG-CDM · visão pública da ata
        </p>
      </main>
    </div>
  );
}
