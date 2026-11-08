import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/accounts.functions";
import { getConsoleSession } from "@/lib/console/console.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/console/entrar")({
  ssr: false,
  component: ConsoleLogin,
});

type Step =
  | { kind: "loading" }
  | { kind: "password" }
  | { kind: "denied"; email: string | null }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string };

function ConsoleLogin() {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  async function resolveStep() {
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setStep({ kind: "password" });
      return;
    }
    const s = await getConsoleSession();
    if (!s.isPlatformAdmin) {
      setStep({ kind: "denied", email: s.email });
      return;
    }
    if (s.aal === "aal2") {
      window.location.assign("/console");
      return;
    }
    const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr) throw fErr;
    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) {
      setStep({ kind: "verify", factorId: verified.id });
      return;
    }
    // Limpa tentativas de cadastro não concluídas antes de gerar um novo QR.
    for (const f of factors.all.filter((f) => f.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enrolled, error: eErr } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Console ${new Date().toISOString().slice(0, 10)}`,
      issuer: "Templo Virtual Console",
    });
    if (eErr) throw eErr;
    setStep({
      kind: "enroll",
      factorId: enrolled.id,
      qr: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    });
  }

  useEffect(() => {
    resolveStep().catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
      setStep({ kind: "password" });
    });
  }, []);

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await signInWithIdentifier({
        data: { identifier: identifier.trim(), password },
      });
      const { error: setErr } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (setErr) throw setErr;
      setPassword("");
      await resolveStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== "enroll" && step.kind !== "verify") return;
    setBusy(true);
    setError(null);
    try {
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: step.factorId,
        code: code.replace(/\D/g, ""),
      });
      if (vErr) throw vErr;
      window.location.assign("/console");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStep({ kind: "password" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logos/templo-virtual.svg" alt="" className="mb-4 h-14 w-14" />
          <p className="text-[0.7rem] uppercase tracking-[0.32em] text-white/50">Templo Virtual</p>
          <h1 className="mt-1 text-2xl font-semibold">Console</h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          {step.kind === "loading" && (
            <div className="flex justify-center py-6 text-white/60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {step.kind === "password" && (
            <form onSubmit={onPassword} className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-white/80">E-mail</Label>
                <Input
                  autoFocus
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                  required
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-white/80">Senha</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-white/15 bg-white/5 text-white"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Entrando..." : "Continuar"}
              </Button>
            </form>
          )}

          {step.kind === "denied" && (
            <div className="space-y-4 text-sm">
              <p>
                A conta <strong>{step.email ?? "atual"}</strong> não é administradora da plataforma.
              </p>
              <Button variant="outline" className="w-full" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Entrar com outra conta
              </Button>
            </div>
          )}

          {(step.kind === "enroll" || step.kind === "verify") && (
            <form onSubmit={onCode} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Verificação em duas etapas
              </div>
              {step.kind === "enroll" ? (
                <div className="space-y-3 text-sm text-white/70">
                  <p>
                    Primeiro acesso: escaneie o QR code com um app autenticador (Google
                    Authenticator, 1Password, Authy) e digite o código de 6 dígitos.
                  </p>
                  <div className="flex justify-center rounded-xl bg-white p-3">
                    <img
                      src={step.qr}
                      alt="QR code para o app autenticador"
                      className="h-44 w-44"
                    />
                  </div>
                  <p className="break-all text-center font-mono text-xs text-white/50">
                    {step.secret}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/70">
                  Digite o código de 6 dígitos do seu app autenticador.
                </p>
              )}
              <Input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="border-white/15 bg-white/5 text-center font-mono text-lg tracking-[0.4em] text-white"
                required
              />
              <Button
                type="submit"
                className="w-full"
                disabled={busy || code.replace(/\D/g, "").length < 6}
              >
                {busy ? "Verificando..." : "Verificar"}
              </Button>
              <button
                type="button"
                onClick={signOut}
                className="w-full text-center text-xs text-white/50 underline underline-offset-2 hover:text-white"
              >
                Sair
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-white/35">
          Acesso restrito. Todas as ações ficam registradas.
        </p>
      </div>
    </div>
  );
}
