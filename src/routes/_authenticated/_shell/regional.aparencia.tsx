import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useOrgScope } from "@/context/OrgScopeContext";
import { getRegionVisual, updateRegionVisual } from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_BUCKET, useChapterLogo } from "@/lib/chapter-logo";

const DEFAULT_ACCENT = "#9E1B32";

export const Route = createFileRoute(
  "/_authenticated/_shell/regional/aparencia",
)({
  component: RegionAppearance,
  head: () => ({
    meta: [{ title: "Aparência da região — SG-CDM" }],
  }),
});

function RegionAppearance() {
  return (
    <ScopeGuard>
      <AppearanceContent />
    </ScopeGuard>
  );
}

function AppearanceContent() {
  const { activeScope, canManageChapters } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();

  if (scope.type !== "region") {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Selecione um escopo regional para configurar a aparência.
      </Card>
    );
  }

  if (!canManageChapters) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Sem permissão para alterar a aparência desta região.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aparência"
        subtitle={`Visual da região ${scope.label}`}
      />
      <RegionAccentSection
        regionId={scope.id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["org-context"] })}
      />
      <RegionLogoSection
        regionId={scope.id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["org-context"] })}
      />
    </div>
  );
}

function RegionAccentSection({
  regionId,
  onSaved,
}: {
  regionId: string;
  onSaved: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["region-visual", regionId],
    queryFn: () => getRegionVisual({ data: { regionId } }),
  });
  const saved = data?.primary_color || DEFAULT_ACCENT;
  const [color, setColor] = useState(saved);

  useEffect(() => {
    setColor(saved);
  }, [saved]);

  const save = useMutation({
    mutationFn: () =>
      updateRegionVisual({
        data: { regionId, primary_color: color },
      }),
    onSuccess: () => {
      toast.success("Cor atualizada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-4 rounded-[12px] p-5">
      <div>
        <h3 className="text-sm font-semibold">Cor de destaque</h3>
        <p className="text-xs text-muted-foreground">
          Usada no menu e botões quando o escopo regional estiver ativo.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-16 cursor-pointer p-1"
        />
        <Input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-28 font-mono text-xs uppercase"
          maxLength={7}
        />
        <div
          className="h-10 flex-1 rounded-[8px] border border-border"
          style={{ backgroundColor: color }}
        />
      </div>
      <Button
        size="sm"
        disabled={color === saved || save.isPending}
        style={{ backgroundColor: color }}
        onClick={() => save.mutate()}
      >
        Salvar cor
      </Button>
    </Card>
  );
}

function RegionLogoSection({
  regionId,
  onSaved,
}: {
  regionId: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["region-visual", regionId],
    queryFn: () => getRegionVisual({ data: { regionId } }),
  });
  const logoPath = data?.logo_url ?? null;
  const preview = useChapterLogo(logoPath);
  const MAX_BYTES = 2 * 1024 * 1024;

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("Envie um arquivo de imagem (PNG, JPG ou WEBP).");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("A imagem deve ter no máximo 2 MB.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `regions/${regionId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      await updateRegionVisual({ data: { regionId, logo_url: path } });
      if (logoPath && logoPath !== path) {
        await supabase.storage.from(LOGO_BUCKET).remove([logoPath]);
      }
      return path;
    },
    onSuccess: () => {
      toast.success("Logo atualizada");
      qc.invalidateQueries({ queryKey: ["region-visual", regionId] });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await updateRegionVisual({ data: { regionId, logo_url: null } });
      if (logoPath) {
        await supabase.storage.from(LOGO_BUCKET).remove([logoPath]);
      }
    },
    onSuccess: () => {
      toast.success("Logo removida");
      qc.invalidateQueries({ queryKey: ["region-visual", regionId] });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-4 rounded-[12px] p-5">
      <div>
        <h3 className="text-sm font-semibold">Logo da região</h3>
        <p className="text-xs text-muted-foreground">
          Exibida no topo do menu no escopo regional. Máx. 2 MB.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center overflow-hidden rounded-[12px] text-white"
          style={{ backgroundColor: data?.primary_color || DEFAULT_ACCENT }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Logo"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-xs font-bold">REG</span>
          )}
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={upload.isPending}
            onClick={() =>
              document.getElementById("region-logo")?.click()
            }
          >
            {upload.isPending ? "Enviando…" : "Enviar imagem"}
          </Button>
          <Input
            id="region-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload.mutate(f);
            }}
          />
          {logoPath && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remover
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
