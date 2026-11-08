import { createFileRoute, isRedirect, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMustChangePassword, signInWithIdentifier } from "@/lib/accounts.functions";
import { clearAuthNavCache, enterAuthenticatedApp } from "@/lib/auth-nav-cache";
import {
  checkNeedsOfficeSignature,
  redirectIfNeedsOfficeSignature,
} from "@/lib/office-signature-gate";
import { SphereAuth, type SphereLoginFields } from "@/components/auth/SphereAuth";
import { getClientRealm, isRealm, realmEntryUrl, type Realm } from "@/lib/realm";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { reason?: string; esfera?: Realm } => {
    const reason = typeof search.reason === "string" ? search.reason : undefined;
    const esfera =
      typeof search.esfera === "string" && isRealm(search.esfera) ? search.esfera : undefined;
    return {
      ...(reason ? { reason } : {}),
      ...(esfera ? { esfera } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Entrar — Templo Virtual" },
      {
        name: "description",
        content: "Acesso ao Templo Virtual — hub de gerenciamento das ordens paramaçônicas.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600&family=Questrial&display=swap",
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
  const { reason, esfera } = Route.useSearch();
  // Em odm./fdj./loja. a esfera do host já vem aberta; no hub, o usuário escolhe.
  const [hostRealm] = useState<Realm | null>(() => getClientRealm());
  const [cleared, setCleared] = useState(false);
  const selected: Realm | null =
    esfera ?? (cleared ? null : (hostRealm ?? (reason ? "odm" : null)));

  const [error, setError] = useState<string | null>(
    reason === "irregular"
      ? "Membros irregulares não podem acessar a plataforma. Regularize sua situação junto à secretaria ou tesouraria do capítulo."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = useCallback(
    (realm: Realm | null) => {
      setError(null);
      if (!realm) setCleared(true);
      void navigate({
        to: "/auth",
        search: realm ? { esfera: realm } : {},
        replace: false,
      });
    },
    [navigate],
  );

  async function handleSubmit(realm: Realm, fields: SphereLoginFields) {
    setError(null);
    setSubmitting(true);
    try {
      const session = await signInWithIdentifier({
        data: { identifier: fields.identifier, password: fields.password },
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
      // Sessão é cookie em *.templovirtual.app: segue para o host da esfera.
      enterAuthenticatedApp(realmEntryUrl(realm));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identificador ou senha inválidos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SphereAuth
      selected={selected}
      onSelect={handleSelect}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    />
  );
}
