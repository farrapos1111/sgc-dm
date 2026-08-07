import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, Lock, XCircle } from "lucide-react";
import {
  getPublicMinute,
  getPublicMinuteByMember,
  minutePublicShareStorageKey,
  peekPublicMinute,
  readPublicMinuteUnlock,
  submitPublicMinuteVote,
  writePublicMinuteUnlock,
  type PublicMinutePayload,
  type PublicMinuteUnlock,
} from "@/lib/minutes-share.functions";
import { MINUTE_KIND_LABELS, isMinuteKind } from "@/lib/minute-kinds";
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
      { title: "Ata — Templo Virtual" },
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

  const [unlock, setUnlock] = useState<PublicMinuteUnlock | null>(() =>
    readPublicMinuteUnlock(storageKey),
  );
  const [unlockAttempt, setUnlockAttempt] = useState(0);
  const [lockedInfo, setLockedInfo] = useState<{
    kind: string;
    memberName: string;
  } | null>(null);

  const [demolayId, setDemolayId] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [email, setEmail] = useState("");
  const [decision, setDecision] = useState<"aprovada" | "reprovada" | null>(
    null,
  );
  const [justification, setJustification] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const peekQ = useQuery({
    queryKey: ["public-minute-peek", token],
    queryFn: () => peekPublicMinute({ data: { token } }),
    retry: false,
  });

  const minuteQuery = useQuery({
    queryKey: [
      "public-minute",
      token,
      unlock?.mode ?? null,
      unlockAttempt,
    ],
    queryFn: async (): Promise<PublicMinutePayload> => {
      if (!unlock) throw new Error("Sem acesso");
      if (unlock.mode === "password") {
        return getPublicMinute({
          data: { token, password: unlock.password },
        });
      }
      const res = await getPublicMinuteByMember({
        data: { token, demolayId: unlock.demolayId },
      });
      if (res.locked) {
        throw new Error("Seu grau não permite acesso a este tipo de ata");
      }
      return res;
    },
    enabled: !!unlock,
    retry: false,
  });

  const unlockAsMember = useMutation({
    mutationFn: async (id: string) => {
      const res = await getPublicMinuteByMember({
        data: { token, demolayId: id },
      });
      return { id, res };
    },
    onSuccess: ({ id, res }) => {
      if (res.locked) {
        setLockedInfo({
          kind: String(res.kind),
          memberName: res.member_name,
        });
        setUnlock(null);
        sessionStorage.removeItem(storageKey);
        toast.error("Ata trancada para o seu grau");
        return;
      }
      setLockedInfo(null);
      const next: PublicMinuteUnlock = { mode: "member", demolayId: id };
      writePublicMinuteUnlock(storageKey, next);
      const attempt = unlockAttempt + 1;
      setUnlockAttempt(attempt);
      queryClient.setQueryData(["public-minute", token, next.mode, attempt], res);
      setUnlock(next);
      toast.success(
        res.member_name
          ? `Olá, ${res.member_name}. Acesso liberado`
          : "Acesso liberado nesta sessão",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível entrar"),
  });

  const unlockWithPassword = useMutation({
    mutationFn: async (password: string) => {
      const payload = await getPublicMinute({ data: { token, password } });
      return { password, payload };
    },
    onSuccess: ({ password, payload }) => {
      setLockedInfo(null);
      const next: PublicMinuteUnlock = { mode: "password", password };
      writePublicMinuteUnlock(storageKey, next);
      const attempt = unlockAttempt + 1;
      setUnlockAttempt(attempt);
      queryClient.setQueryData(
        ["public-minute", token, next.mode, attempt],
        payload,
      );
      setUnlock(next);
      toast.success("Acesso liberado nesta sessão");
    },
    onError: (e: Error) => toast.error(e.message || "Senha incorreta"),
  });

  const vote = useMutation({
    mutationFn: () => {
      if (!decision) throw new Error("Escolha aprovada ou reprovada");
      if (!unlock) throw new Error("Sem acesso");
      return submitPublicMinuteVote({
        data: {
          token,
          password: unlock.mode === "password" ? unlock.password : null,
          demolayId: unlock.mode === "member" ? unlock.demolayId : null,
          email,
          decision,
          justification: decision === "reprovada" ? justification : null,
        },
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success(
        decision === "aprovada"
          ? "Aprovação registrada"
          : "Reprovação registrada",
      );
    },
    onError: (e: Error) =>
      toast.error(e.message || "Erro ao registrar feedback"),
  });

  const accent =
    minuteQuery.data?.chapter.primary_color ||
    peekQ.data?.chapter.primary_color ||
    "#9E1B32";

  const kindLabel = (() => {
    const k = minuteQuery.data?.minute.kind ?? peekQ.data?.kind ?? lockedInfo?.kind;
    if (isMinuteKind(k)) return MINUTE_KIND_LABELS[k];
    return typeof k === "string" ? k : null;
  })();

  function resetAccess() {
    sessionStorage.removeItem(storageKey);
    setUnlock(null);
    setLockedInfo(null);
    setPasswordInput("");
    setDemolayId("");
    setEmail("");
    setDecision(null);
    setJustification("");
    setSubmitted(false);
  }

  if (peekQ.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (peekQ.error) {
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
              {(peekQ.error as Error).message || "Link indisponível."}
            </p>
          </Card>
        </main>
      </div>
    );
  }

  if (lockedInfo) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> Ata da sessão
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-lg px-4 py-10">
          <Card className="space-y-4 rounded-[12px] p-5 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Ata trancada</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Olá, {lockedInfo.memberName}. Esta ata é do tipo{" "}
                <strong>
                  {isMinuteKind(lockedInfo.kind)
                    ? MINUTE_KIND_LABELS[lockedInfo.kind]
                    : lockedInfo.kind}
                </strong>{" "}
                e o seu grau atual não permite o acesso. Não há opção de senha
                para este caso.
              </p>
            </div>
            <Button variant="outline" onClick={resetAccess}>
              Voltar
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (!unlock) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> Ata da sessão
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
          <div>
            <h1 className="text-lg font-semibold">Acesso à ata</h1>
            <p className="text-sm text-muted-foreground">
              {peekQ.data?.event.title}
              {kindLabel ? ` · ${kindLabel}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Membros com grau adequado entram com o ID DeMolay (sem senha).
              Visitantes usam a senha do tipo da ata para ler e enviar feedback.
            </p>
          </div>

          <Card className="space-y-3 rounded-[12px] p-5">
            <h2 className="text-sm font-semibold">Sou membro do capítulo</h2>
            <div>
              <Label className="mb-1.5 block text-sm">ID DeMolay</Label>
              <div className="flex gap-2">
                <Input
                  value={demolayId}
                  placeholder="Seu ID DeMolay"
                  autoComplete="username"
                  onChange={(e) => setDemolayId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (demolayId.trim())
                        unlockAsMember.mutate(demolayId.trim());
                    }
                  }}
                />
                <Button
                  type="button"
                  style={{ backgroundColor: accent }}
                  disabled={
                    unlockAsMember.isPending || !demolayId.trim()
                  }
                  onClick={() => unlockAsMember.mutate(demolayId.trim())}
                >
                  {unlockAsMember.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="space-y-3 rounded-[12px] p-5">
            <h2 className="text-sm font-semibold">Acesso com senha</h2>
            <p className="text-xs text-muted-foreground">
              Para convidados ou feedback externo. A senha é a do tipo desta
              ata (Configurações → Secretaria).
            </p>
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
                      if (passwordInput.trim())
                        unlockWithPassword.mutate(passwordInput.trim());
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    unlockWithPassword.isPending || !passwordInput.trim()
                  }
                  onClick={() =>
                    unlockWithPassword.mutate(passwordInput.trim())
                  }
                >
                  {unlockWithPassword.isPending ? (
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
                "Link indisponível ou acesso inválido."}
            </p>
            <Button className="mt-4" variant="outline" onClick={resetAccess}>
              Tentar novamente
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
            {kindLabel ? ` · ${kindLabel}` : ""}
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
            <p
              className="flex items-center gap-2 text-sm"
              style={{ color: "#047857" }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Feedback registrado. Obrigado!
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Informe seu e-mail e registre se aprova ou reprova a ata. Isso é
                um feedback ao capítulo e não substitui as assinaturas oficiais.
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
          Templo Virtual · visão pública da ata
        </p>
      </main>
    </div>
  );
}
