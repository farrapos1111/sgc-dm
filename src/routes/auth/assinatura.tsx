import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad } from "@/components/investigations/SignaturePad";
import {
  getRequiredOfficeSignature,
  saveOfficeSignature,
  type RequiredOfficeSignature,
} from "@/lib/office-signatures.functions";
import { getMustChangePassword } from "@/lib/accounts.functions";

export const Route = createFileRoute("/auth/assinatura")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Assinatura digital — Templo Virtual" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user)
      throw redirect({ to: "/auth", search: { reason: undefined } });

    const { mustChangePassword } = await getMustChangePassword();
    if (mustChangePassword) throw redirect({ to: "/auth/redefinir-senha" });

    const { needsSignature, requirement } = await getRequiredOfficeSignature();
    if (!needsSignature || !requirement) throw redirect({ to: "/" });

    return { user: data.user, requirement };
  },
  component: AssinaturaPage,
});

function AssinaturaPage() {
  const { user, requirement: initial } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const [requirement, setRequirement] =
    useState<RequiredOfficeSignature>(initial);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleBackToLogin() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      await router.invalidate();
      navigate({ to: "/auth", search: { reason: undefined } });
    } catch {
      navigate({ to: "/auth", search: { reason: undefined } });
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signature?.trim()) {
      setError("Assine na área acima antes de continuar.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await saveOfficeSignature({
        data: {
          memberId: requirement.memberId,
          chapterId: requirement.chapterId,
          positionCode: requirement.positionCode,
          signatureDataUrl: signature,
        },
      });
      if (result.needsSignature && result.requirement) {
        setRequirement(result.requirement);
        setSignature(null);
        setError(null);
        return;
      }
      await router.invalidate();

      const { data: memberships } = await supabase
        .from("chapter_members")
        .select("chapter_id")
        .eq("user_id", user.id)
        .eq("active", true);
      const distinct = new Set((memberships ?? []).map((m) => m.chapter_id));
      if (distinct.size > 1) {
        navigate({ to: "/selecionar-capitulo" });
      } else {
        navigate({ to: "/inicio" });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar a assinatura",
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
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-lg font-semibold text-foreground mb-1">
            Assinatura digital
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Como{" "}
            <span className="font-medium text-foreground">
              {requirement.positionLabel}
            </span>{" "}
            em{" "}
            <span className="font-medium text-foreground">
              {requirement.chapterName}
            </span>
            , registre sua assinatura para continuar.
          </p>
          <form onSubmit={handleSave} className="space-y-4">
            <SignaturePad
              key={`${requirement.memberId}-${requirement.chapterId}-${requirement.positionCode}`}
              label="Sua assinatura"
              value={signature}
              onChange={setSignature}
              disabled={submitting}
            />
            {error ? (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting || !signature}
              className="w-full py-2.5 rounded-lg font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#9E1B32" }}
            >
              {submitting ? "Salvando…" : "Salvar e continuar"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => void handleBackToLogin()}
              disabled={signingOut || submitting}
              className="underline underline-offset-2 hover:text-foreground disabled:opacity-60"
            >
              {signingOut ? "Saindo…" : "Voltar ao login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
