import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  emptyInvestigationFile,
  InvestigationFileForm,
  validateInvestigationForm,
  type InvestigationFileFormValue,
} from "@/components/investigations/InvestigationFileForm";
import {
  emptyDocPaths,
  readFilePreview,
  validateDocFile,
  type DocPreviewState,
} from "@/components/investigations/DocumentUploadFields";
import {
  listInvestigationSignupMembers,
  resolveInvestigationSignup,
  submitInvestigationSignup,
  uploadInvestigationDocPublic,
} from "@/lib/investigations.functions";
import { fileToBase64 } from "@/lib/file-to-base64";
import type { IdDocKind } from "@/lib/member-documents";

const LGPD_CONSENT_VERSION = "v1-2026-07";

export const Route = createFileRoute("/f/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inscrição — Ficha de Sindicância" },
      {
        name: "description",
        content: "Formulário público de inscrição para sindicância.",
      },
    ],
  }),
  component: PublicInvestigationSignup,
});

function PublicShell({
  accent,
  children,
  title,
  subtitle,
  logoUrl,
}: {
  accent: string;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="min-h-svh bg-[#E9E8E3] dark:bg-background">
      <header
        className="sticky top-0 z-20 border-b border-border/80 bg-[#E9E8E3]/95 backdrop-blur dark:bg-background/95"
        style={{ borderTop: `3px solid ${accent}` }}
      >
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-3 px-4 py-4 sm:px-6 md:max-w-4xl lg:max-w-6xl">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Comissão de Sindicâncias
            </p>
            {title ? (
              <h1 className="mt-0.5 truncate text-lg font-semibold text-foreground sm:text-xl">
                {title}
              </h1>
            ) : (
              <h1 className="mt-0.5 text-lg font-semibold text-foreground">
                Ficha de inscrição
              </h1>
            )}
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <ThemeToggle className="h-9 w-9 shrink-0" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 md:max-w-4xl lg:max-w-6xl">
        {logoUrl ? (
          <div className="mb-6 flex justify-center">
            <img
              src={logoUrl}
              alt=""
              className="h-14 w-auto max-w-[160px] object-contain sm:h-16"
            />
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

function PublicInvestigationSignup() {
  const { token } = Route.useParams();
  const [form, setForm] = useState<InvestigationFileFormValue>(
    emptyInvestigationFile(),
  );
  const [done, setDone] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [docPreviews, setDocPreviews] = useState<DocPreviewState>(emptyDocPaths());
  const [uploadingDoc, setUploadingDoc] = useState<IdDocKind | null>(null);
  const tempIdRef = useRef(crypto.randomUUID());

  const { data: chapter, isError, isLoading, error } = useQuery({
    queryKey: ["investigation-signup", token],
    queryFn: () => resolveInvestigationSignup({ data: { token } }),
  });

  const accent = chapter?.primary_color || "#9E1B32";

  useEffect(() => {
    document.documentElement.style.setProperty("--chapter-primary", accent);
    return () => {
      document.documentElement.style.removeProperty("--chapter-primary");
    };
  }, [accent]);

  const sponsorSearch = (form.sponsor_text || "").trim();
  const { data: members = [] } = useQuery({
    queryKey: ["investigation-signup-members", token, sponsorSearch],
    enabled: !!chapter && sponsorSearch.length >= 2 && !form.sponsor_member_id,
    queryFn: () =>
      listInvestigationSignupMembers({
        data: { token, search: sponsorSearch },
      }),
  });

  async function onDocPick(kind: IdDocKind, file: File) {
    const err = validateDocFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploadingDoc(kind);
    try {
      const preview = await readFilePreview(file);
      const base64 = await fileToBase64(file);
      const res = await uploadInvestigationDocPublic({
        data: {
          token,
          kind,
          contentType: file.type || "image/jpeg",
          base64,
          tempId: tempIdRef.current,
        },
      });
      setDocPreviews((p) => ({ ...p, [kind]: preview }));
      setForm((f) => ({
        ...f,
        docs: { ...f.docs, [kind]: res.path },
      }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploadingDoc(null);
    }
  }

  const submit = useMutation({
    mutationFn: () => {
      if (!lgpdConsent) {
        throw new Error(
          "É necessário consentir com o tratamento de dados (LGPD).",
        );
      }
      const v = validateInvestigationForm(form);
      if (v) throw new Error(v);
      return submitInvestigationSignup({
        data: {
          token,
          tempId: tempIdRef.current,
          lgpd_consent_text_version: LGPD_CONSENT_VERSION,
          candidate_name: form.candidate_name,
          candidate_birth_date: form.candidate_birth_date,
          cpf: form.cpf,
          rg: form.rg,
          candidate_email: form.candidate_email,
          candidate_phone: form.candidate_phone,
          celular: form.celular,
          address: form.address,
          guardians: form.guardians as [
            (typeof form.guardians)[0],
            (typeof form.guardians)[0],
          ],
          sponsor_member_id: form.sponsor_member_id,
          sponsor_text: form.sponsor_text || null,
          sponsor_phone: form.sponsor_phone || null,
          has_demolay_relative: form.has_demolay_relative,
          demolay_relative_name: form.demolay_relative_name || null,
          demolay_relative_chapter: form.demolay_relative_chapter || null,
          has_mason_relative: form.has_mason_relative,
          mason_relative_name: form.mason_relative_name || null,
          mason_relative_lodge: form.mason_relative_lodge || null,
          notes: form.notes?.trim() || null,
          docs: {
            rg_front: form.docs.rg_front!,
            rg_back: form.docs.rg_back!,
          },
        },
      });
    },
    onSuccess: () => {
      setDone(true);
      toast.success("Ficha enviada com sucesso");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar"),
  });

  if (isLoading) {
    return (
      <PublicShell accent={accent}>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
        </div>
      </PublicShell>
    );
  }

  if (isError || !chapter) {
    return (
      <PublicShell accent="#9E1B32">
        <Card className="rounded-[12px] border-border/80 bg-card p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Link indisponível
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Este link é inválido ou foi revogado."}
          </p>
        </Card>
      </PublicShell>
    );
  }

  if (done) {
    return (
      <PublicShell
        accent={accent}
        title={chapter.name}
        subtitle={chapter.city ?? undefined}
        logoUrl={chapter.logo_url}
      >
        <Card className="rounded-[12px] border-border/80 bg-card p-8 text-center shadow-sm">
          <div
            className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Inscrição recebida
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Sua ficha foi enviada ao {chapter.name}. A comissão de sindicâncias
            entrará em contato se necessário.
          </p>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      accent={accent}
      title={chapter.name}
      subtitle={
        chapter.city
          ? `nº ${chapter.number} · ${chapter.city}`
          : `nº ${chapter.number}`
      }
      logoUrl={chapter.logo_url}
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
          style={{ backgroundColor: accent }}
        >
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Ficha de inscrição
          </h2>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do candidato. Campos com * são obrigatórios.
          </p>
        </div>
      </div>

      <Card className="rounded-[12px] border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <InvestigationFileForm
          value={form}
          onChange={(p) => setForm((f) => ({ ...f, ...p }))}
          members={members}
          publicLayout
          docPreviews={docPreviews}
          uploadingDoc={uploadingDoc}
          onDocPick={onDocPick}
          onDocClear={(kind) => {
            setDocPreviews((p) => ({ ...p, [kind]: null }));
            setForm((f) => ({
              ...f,
              docs: { ...f.docs, [kind]: null },
            }));
          }}
        />

        <div className="mt-8 space-y-4 border-t border-border pt-5">
          <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Os dados pessoais informados serão tratados para a finalidade de
              inscrição em sindicância do capítulo indicado ({chapter.name}),
              que atua como controlador. Consulte a{" "}
              <a
                href="/documentacao"
                className="underline underline-offset-2 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                política de privacidade
              </a>
              .
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="lgpd-consent"
                checked={lgpdConsent}
                onCheckedChange={(v) => setLgpdConsent(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="lgpd-consent"
                className="cursor-pointer text-sm font-normal leading-snug"
              >
                Li e autorizo o tratamento dos meus dados pessoais conforme a
                LGPD. *
              </Label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Ao enviar, você confirma que as informações estão corretas.
            </p>
            <Button
              className="h-11 min-w-[140px] text-white"
              disabled={submit.isPending || !lgpdConsent}
              onClick={() => submit.mutate()}
              style={{ backgroundColor: accent }}
            >
              {submit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                "Enviar ficha"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </PublicShell>
  );
}
