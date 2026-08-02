import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearMustChangePassword } from "@/lib/accounts.functions";

export const Route = createFileRoute("/auth/nova-senha")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Nova senha — SG-CDM" }],
  }),
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Recovery links deliver tokens in the URL hash; getSession picks them up.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        if (!data.session) {
          setError(
            "Link inválido ou expirado. Solicite uma nova recuperação de senha.",
          );
        }
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      try {
        await clearMustChangePassword();
      } catch {
        // ok se não houver sessão autenticada para a server fn
      }
      await router.invalidate();
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar");
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
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-lg font-semibold text-foreground mb-1">
            Definir nova senha
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Escolha uma senha forte para a sua conta.
          </p>
          {!ready ? (
            <p className="text-sm text-muted-foreground">Validando link…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Nova senha
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background"
                  disabled={Boolean(error && !password)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background"
                />
              </div>
              {error ? (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={submitting || (Boolean(error) && error.includes("Link"))}
                className="w-full py-2.5 rounded-lg font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#9E1B32" }}
              >
                {submitting ? "Salvando…" : "Salvar senha"}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="underline underline-offset-2">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
