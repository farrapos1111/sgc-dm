import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import {
  DEFAULT_SINDICANCIA_CHAVE,
  DEFAULT_SINDICANCIA_PARECER,
  SINDICANCIA_TEMPLATE_VARS,
  ensureInvestigationSignupToken,
  getInvestigationSignupToken,
  getSindicanciaTemplates,
  revokeInvestigationSignupToken,
  updateSindicanciaTemplates,
} from "@/lib/investigations.functions";

export const Route = createFileRoute(
  "/_authenticated/_shell/sindicancias/config",
)({
  head: () => ({
    meta: [
      { title: "Configurações — Sindicâncias — SG-CDM" },
      {
        name: "description",
        content: "Templates e link público da comissão de sindicâncias.",
      },
    ],
  }),
  component: SindicanciaConfigPage,
});

function SindicanciaConfigPage() {
  const { active } = useActiveChapter();
  const { canEditSindicanciasTemplates, canManage } = useCommissionAccess();
  const canTemplates = canEditSindicanciasTemplates();
  const canLink = canManage("sindicancias") || canTemplates;
  const qc = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["sindicancia-templates", active?.chapter_id],
    enabled: !!active && canTemplates,
    queryFn: () =>
      getSindicanciaTemplates({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: tokenData } = useQuery({
    queryKey: ["investigation-signup-token", active?.chapter_id],
    enabled: !!active && canLink,
    queryFn: () =>
      getInvestigationSignupToken({ data: { chapterId: active!.chapter_id } }),
  });

  const [chave, setChave] = useState<string | null>(null);
  const [parecer, setParecer] = useState<string | null>(null);

  const chaveValue = chave ?? templates?.chave ?? DEFAULT_SINDICANCIA_CHAVE;
  const parecerValue =
    parecer ?? templates?.parecer ?? DEFAULT_SINDICANCIA_PARECER;

  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!tokenData?.token) {
      setPublicUrl(null);
      return;
    }
    setPublicUrl(`${window.location.origin}/f/${tokenData.token}`);
  }, [tokenData?.token]);

  const saveTemplates = useMutation({
    mutationFn: () =>
      updateSindicanciaTemplates({
        data: {
          chapterId: active!.chapter_id,
          chave: chaveValue,
          parecer: parecerValue,
        },
      }),
    onSuccess: async () => {
      toast.success("Modelos salvos");
      setChave(null);
      setParecer(null);
      await qc.invalidateQueries({ queryKey: ["sindicancia-templates"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const ensureToken = useMutation({
    mutationFn: (rotate: boolean) =>
      ensureInvestigationSignupToken({
        data: { chapterId: active!.chapter_id, rotate },
      }),
    onSuccess: async () => {
      toast.success("Link atualizado");
      await qc.invalidateQueries({
        queryKey: ["investigation-signup-token"],
      });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const revokeToken = useMutation({
    mutationFn: () =>
      revokeInvestigationSignupToken({
        data: { chapterId: active!.chapter_id },
      }),
    onSuccess: async () => {
      toast.success("Link revogado");
      await qc.invalidateQueries({
        queryKey: ["investigation-signup-token"],
      });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!canLink) {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Sindicâncias" />
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Sem permissão. Apenas o presidente da comissão, o Mestre Conselheiro
          ou administradores podem alterar estas configurações.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Link de inscrição e modelos da comissão de sindicâncias."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/sindicancias/fichas">Voltar às fichas</Link>
          </Button>
        }
      />

      {canLink && (
        <Card className="mb-6 space-y-3 rounded-[12px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4" /> Link público de inscrição
          </div>
          <p className="text-xs text-muted-foreground">
            Qualquer pessoa com o link pode enviar uma ficha de pré-cadastro
            para este capítulo.
          </p>
          {publicUrl ? (
            <div className="flex flex-wrap gap-2">
              <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs">
                {publicUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum link ativo.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => ensureToken.mutate(false)}
              disabled={ensureToken.isPending}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {publicUrl ? "Manter link" : "Gerar link"}
            </Button>
            {publicUrl && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => ensureToken.mutate(true)}
                  disabled={ensureToken.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Rotacionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => revokeToken.mutate()}
                  disabled={revokeToken.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Revogar
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {canTemplates && (
        <div className="space-y-6">
          <Card className="space-y-3 rounded-[12px] p-5">
            <h3 className="text-sm font-semibold">Chave de Sindicância</h3>
            <p className="text-xs text-muted-foreground">
              Modelo copiado ao montar a chave. Variáveis:{" "}
              {SINDICANCIA_TEMPLATE_VARS.map((v) => `[${v}]`).join(", ")}
            </p>
            <div className="flex flex-wrap gap-1">
              {SINDICANCIA_TEMPLATE_VARS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() =>
                    setChave((chaveValue || "") + `[${v}]`)
                  }
                >
                  [{v}]
                </Button>
              ))}
            </div>
            <Textarea
              rows={10}
              value={chaveValue}
              onChange={(e) => setChave(e.target.value)}
            />
          </Card>

          <Card className="space-y-3 rounded-[12px] p-5">
            <h3 className="text-sm font-semibold">Modelo de Parecer</h3>
            <p className="text-xs text-muted-foreground">
              Inserido na ficha ao clicar em “Inserir modelo”.
            </p>
            <Textarea
              rows={10}
              value={parecerValue}
              onChange={(e) => setParecer(e.target.value)}
            />
          </Card>

          <Button
            onClick={() => saveTemplates.mutate()}
            disabled={saveTemplates.isPending || templates === undefined}
            style={{ backgroundColor: active?.chapter.primary_color }}
          >
            {saveTemplates.isPending ? "Salvando…" : "Salvar modelos"}
          </Button>
        </div>
      )}
    </div>
  );
}
