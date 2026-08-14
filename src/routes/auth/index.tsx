import {
  createFileRoute,
  Link,
  isRedirect,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMustChangePassword, signInWithIdentifier } from "@/lib/accounts.functions";
import { clearAuthNavCache, enterAuthenticatedApp } from "@/lib/auth-nav-cache";
import {
  checkNeedsOfficeSignature,
  redirectIfNeedsOfficeSignature,
} from "@/lib/office-signature-gate";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { reason?: string } => {
    const reason = typeof search.reason === "string" ? search.reason : undefined;
    return reason ? { reason } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar — Templo Virtual" },
      {
        name: "description",
        content:
          "Acesso ao Templo Virtual — hub de gerenciamento das ordens paramaçônicas.",
      },
    ],
  }),
  beforeLoad: async () => {
    // getSession é local/rápido; evita 500 de getUser/RPC no SSR residual
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    try {
      const { mustChangePassword } = await getMustChangePassword();
      if (mustChangePassword) {
        throw redirect({ to: "/auth/redefinir-senha" });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
      console.error("[auth] mustChangePassword failed", e);
    }

    await redirectIfNeedsOfficeSignature();
    throw redirect({ to: "/inicio", reloadDocument: true });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    reason === "irregular"
      ? "Membros irregulares não podem acessar a plataforma. Regularize sua situação junto à secretaria ou tesouraria do capítulo."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await signInWithIdentifier({
        data: { identifier: identifier.trim(), password },
      });
      const { error: setErr } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (setErr) {
        setError("Identificador ou senha inválidos.");
        return;
      }

      const { mustChangePassword } = await getMustChangePassword();
      clearAuthNavCache();
      if (mustChangePassword) {
        navigate({ to: "/auth/redefinir-senha" });
        return;
      }
      if (await checkNeedsOfficeSignature()) {
        navigate({ to: "/auth/assinatura" });
        return;
      }
      enterAuthenticatedApp("/inicio");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Identificador ou senha inválidos.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 bg-[#E9E8E3] dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
        <ThemeToggle className="h-9 w-9" />
      </div>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logos/templo-virtual.svg"
            alt="Templo Virtual"
            className="mb-4 h-20 w-20"
            width={80}
            height={80}
          />
          <h1 className="text-2xl font-bold text-foreground">Templo Virtual</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hub de gerenciamento das ordens paramaçônicas
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Entrar</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Acesse com e-mail ou ID da Organização e senha.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                E-mail ou ID da Organização
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background"
                style={{ ["--tw-ring-color" as string]: "#9E1B32" }}
                placeholder="voce@exemplo.com ou 12345"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-foreground">
                  Senha
                </label>
                <Link
                  to="/auth/recuperar-senha"
                  preload={false}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Esqueci a senha
                </Link>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background"
                style={{ ["--tw-ring-color" as string]: "#9E1B32" }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer py-2.5 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#072D5A" }}
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link
              to="/auth/adicionar-organizacao"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              style={{ color: "#9E1B32" }}
            >
              Quero Adicionar à Minha Organização
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a
            href="/documentacao"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Documentação
          </a>
          <span className="mx-2 text-border">·</span>
          Sugestões:{" "}
          <a
            href="mailto:pedro.bossle.s@gmail.com?subject=Sugest%C3%A3o%20%E2%80%94%20Templo%20Virtual"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Pedro Bossle
          </a>
          {" · "}
          <a
            href="mailto:lucasboeiraborges@gmail.com?subject=Sugest%C3%A3o%20%E2%80%94%20Templo%20Virtual"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Lucas Borges
          </a>
        </p>
      </div>
    </div>
  );
}
