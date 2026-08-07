import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/accounts.functions";

export const Route = createFileRoute("/auth/recuperar-senha")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Recuperar senha — Templo Virtual" }],
  }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset({ data: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar");
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
            Esqueci a senha
          </h1>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Se existir uma conta com esse e-mail, enviamos um link para
              redefinir a senha. Confira a caixa de entrada e o spam.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Informe o e-mail da sua conta. Enviaremos um link de recuperação.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background"
                    placeholder="voce@exemplo.com"
                  />
                </div>
                {error ? (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                    {error}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#9E1B32" }}
                >
                  {submitting ? "Enviando…" : "Enviar link"}
                </button>
              </form>
            </>
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
