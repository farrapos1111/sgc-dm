import {
  createFileRoute,
  Link,
  isRedirect,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMustChangePassword, signInWithIdentifier } from "@/lib/accounts.functions";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    reason: typeof search.reason === "string" ? search.reason : undefined,
  }),
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
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      try {
        const { mustChangePassword } = await getMustChangePassword();
        if (mustChangePassword) {
          throw redirect({ to: "/auth/redefinir-senha" });
        }
      } catch (e) {
        if (isRedirect(e)) throw e;
      }
      throw redirect({ to: "/" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
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
      await router.invalidate();
      if (mustChangePassword) {
        navigate({ to: "/auth/redefinir-senha" });
      } else {
        navigate({ to: "/" });
      }
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
      className="min-h-screen flex items-center justify-center p-6 bg-[#E9E8E3] dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
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
                E-mail ou ID DeMolay
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
              className="w-full py-2.5 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#9E1B32" }}
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a
            href="/documentacao"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Documentação
          </a>
        </p>
      </div>
    </div>
  );
}
