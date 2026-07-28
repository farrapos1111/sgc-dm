import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — SG-CDM" },
      { name: "description", content: "Acesso ao Sistema Gerenciador de Capítulos DeMolay." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    await router.invalidate();
    navigate({ to: "/" });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 bg-[#E9E8E3] dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "#9E1B32" }}
          >
            <span className="text-white font-bold text-2xl tracking-wider">SG</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">SG-CDM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema Gerenciador de Capítulos DeMolay
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Entrar</h2>
          <p className="text-sm text-muted-foreground mb-6">Acesse com seu e-mail e senha.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background"
                style={{ ["--tw-ring-color" as string]: "#9E1B32" }}
                placeholder="voce@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          Contas de teste: <br />
          <code className="text-foreground">usuario.duplo@sgcdm.test</code> ·{" "}
          <code className="text-foreground">usuario.solo@sgcdm.test</code> <br />
          senha: <code className="text-foreground">Teste@1234</code>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <a href="/documentacao" className="underline underline-offset-2 hover:text-foreground">
            Documentação
          </a>
        </p>
      </div>
    </div>
  );
}

