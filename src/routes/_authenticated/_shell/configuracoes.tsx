import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { supabase } from "@/integrations/supabase/client";
import { useChapterLogo, LOGO_BUCKET } from "@/lib/chapter-logo";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { isOrgLeader } from "@/lib/permissions";
import { ChapterAuditPanel } from "@/components/ChapterAuditPanel";
import { listLodges, saveLodge, deleteLodge, updateChapterProfile, updateChapterAccentColor } from "@/lib/chapter.functions";
import { saveDefaultDuesAmount, saveChapterDuesEnabled } from "@/lib/finance.functions";
import {
  getChapterDefaultDuesAmount,
  isChapterDuesEnabled,
} from "@/lib/dues-rules";
import {
  applyChapterThemeVars,
  deriveThemeFromPrimary,
  isThemeHex,
  readableOnHex,
  resolveChapterTheme,
  type ChapterTheme,
} from "@/lib/chapter-theme";
import { ImagePlus, Loader2, Trash2, Building2, Landmark, PlusCircle, Save, Pencil, X, Sun, Moon, MonitorSmartphone, Palette, RotateCcw, Check, Receipt, Link2, Copy } from "lucide-react";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import { ChaveTemplateCard } from "@/components/settings/ChaveTemplateCard";
import { PixKeyCard } from "@/components/settings/PixKeyCard";
import { MinutePasswordsCard } from "@/components/settings/MinutePasswordsCard";
import {
  ensurePublicLobbyToken,
  getPublicLobbyToken,
  revokePublicLobbyToken,
} from "@/lib/lobby-share.functions";
import {
  publicOrgHref,
  useChapterPublicSlug,
} from "@/lib/org-public-path.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const THEME_OPTIONS: { value: ThemeMode; label: string; sub: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", sub: "Sempre claro", icon: Sun },
  { value: "dark", label: "Escuro", sub: "Sempre escuro", icon: Moon },
  { value: "system", label: "Sistema", sub: "Segue o aparelho", icon: MonitorSmartphone },
];

const DEFAULT_ACCENT = "#9E1B32";

/** Cores prontas do redesign (destaque, realce e destaque escuro), mais o padrão do sistema. */
const ACCENT_PRESETS: { value: string; label: string; soft?: string; ink?: string }[] = [
  { value: DEFAULT_ACCENT, label: "Vinho DeMolay" },
  { value: "#8A1C2B", label: "Bordô", soft: "#F7E9EB", ink: "#6E1622" },
  { value: "#1F4FA3", label: "Azul", soft: "#E7EEFA", ink: "#173E80" },
  { value: "#17694A", label: "Verde", soft: "#E3F1EA", ink: "#10523A" },
  { value: "#5B2A86", label: "Roxo", soft: "#EFE7F7", ink: "#4A2270" },
  { value: "#2A2E35", label: "Grafite", soft: "#E9EAEC", ink: "#2A2E35" },
];

const THEME_FIELDS: {
  key: keyof ChapterTheme;
  label: string;
  uso: string;
}[] = [
  { key: "background", label: "Fundo", uso: "Atrás de tudo" },
  { key: "sidebar", label: "Menu", uso: "Fundo do menu lateral" },
  { key: "accent", label: "Destaque", uso: "Botões principais e topo do app" },
  { key: "accentDark", label: "Destaque escuro", uso: "Texto sobre o realce" },
  { key: "highlight", label: "Realce", uso: "Item ativo e botões secundários" },
  { key: "font", label: "Texto", uso: "Títulos e textos" },
];

/** Texto legível sobre a cor escolhida (luminância relativa). */
function readableOn(hex: string) {
  return readableOnHex(hex);
}

function themesEqual(a: ChapterTheme, b: ChapterTheme) {
  return THEME_FIELDS.every(
    (f) => a[f.key].toUpperCase() === b[f.key].toUpperCase(),
  );
}

/** Preview / live CSS: só hex válidos; inválidos caem no tema salvo. */
function themeForPreview(draft: ChapterTheme, fallback: ChapterTheme): ChapterTheme {
  return {
    background: isThemeHex(draft.background) ? draft.background : fallback.background,
    accent: isThemeHex(draft.accent) ? draft.accent : fallback.accent,
    accentDark: isThemeHex(draft.accentDark) ? draft.accentDark : fallback.accentDark,
    highlight: isThemeHex(draft.highlight) ? draft.highlight : fallback.highlight,
    font: isThemeHex(draft.font) ? draft.font : fallback.font,
    sidebar: isThemeHex(draft.sidebar) ? draft.sidebar : fallback.sidebar,
  };
}

function AccentColorSection() {
  const { active, refetch } = useActiveChapter();
  const { can } = useChapterAccess();
  const isAdmin = can("admin") || can("secretaria"); // buckets derivados da matriz
  const saved = resolveChapterTheme(
    active?.chapter.settings as Record<string, unknown> | null,
    active?.chapter.primary_color || DEFAULT_ACCENT,
  );
  const [theme, setTheme] = useState<ChapterTheme>(saved);
  const preview = themeForPreview(theme, saved);

  useEffect(() => {
    setTheme(saved);
  }, [
    saved.accent,
    saved.background,
    saved.accentDark,
    saved.highlight,
    saved.font,
    saved.sidebar,
  ]);

  // Pré-visualização ao vivo (mesmo alvo do AppShell) + restaura o tema salvo ao sair
  useEffect(() => {
    applyChapterThemeVars(document.documentElement, preview);
    return () => {
      applyChapterThemeVars(document.documentElement, saved);
    };
  }, [
    preview.background,
    preview.accent,
    preview.accentDark,
    preview.highlight,
    preview.font,
    preview.sidebar,
    saved.background,
    saved.accent,
    saved.accentDark,
    saved.highlight,
    saved.font,
    saved.sidebar,
  ]);

  const [advanced, setAdvanced] = useState(false);

  function pickPreset(hex: string) {
    if (!isAdmin) return;
    const preset = ACCENT_PRESETS.find((p) => p.value.toUpperCase() === hex.toUpperCase());
    const derived = deriveThemeFromPrimary(hex);
    setTheme(
      preset?.soft && preset.ink
        ? { ...derived, highlight: preset.soft, accentDark: preset.ink }
        : derived,
    );
  }

  function setField(key: keyof ChapterTheme, hex: string) {
    if (!isAdmin) return;
    const next = hex.toUpperCase();
    if (!isThemeHex(next)) return;
    setTheme((prev) => {
      if (key === "accent") {
        // Ao mudar o destaque, rederiva escuro/realce mantendo fundo e texto
        const derived = deriveThemeFromPrimary(next);
        return {
          ...prev,
          accent: next,
          accentDark: derived.accentDark,
          highlight: derived.highlight,
        };
      }
      return { ...prev, [key]: next };
    });
  }

  const save = useMutation({
    mutationFn: () =>
      updateChapterAccentColor({
        data: {
          chapter_id: active!.chapter_id,
          primary_color: theme.accent,
          theme,
        },
      }),
    onSuccess: () => {
      toast.success("Tema do capítulo atualizado");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar o tema"),
  });

  const dirty = !themesEqual(theme, saved);
  const valid = THEME_FIELDS.every((f) => isThemeHex(theme[f.key]));

  return (
    <Card className="p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Palette className="h-5 w-5 text-tv-primary" aria-hidden /> Cor do capítulo
      </h2>
      <p className="mt-1 text-[15px] text-tv-text-2">
        Escolha uma cor. O sistema inteiro muda na hora, inclusive este menu. No modo
        escuro, fundo, menu e texto continuam escuros; as cores de destaque valem.
      </p>

      <div role="radiogroup" aria-label="Cor do capítulo" className="mt-4 flex flex-wrap gap-4">
        {ACCENT_PRESETS.map((p) => {
          const selected = theme.accent.toUpperCase() === p.value.toUpperCase();
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!isAdmin}
              onClick={() => pickPreset(p.value)}
              className="flex w-[72px] flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-full"
                style={{
                  backgroundColor: p.value,
                  boxShadow: selected ? `0 0 0 3px var(--tv-surface), 0 0 0 5px ${p.value}` : undefined,
                }}
              >
                {selected && <Check className="h-5 w-5" style={{ color: readableOn(p.value) }} />}
              </span>
              <span className={`text-[13px] leading-tight ${selected ? "font-bold" : "font-medium text-tv-text-2"}`}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Prévia: menu + conteúdo */}
      <div
        className="mt-5 flex min-h-[150px] overflow-hidden rounded-[16px] border border-tv-border"
        style={{ backgroundColor: preview.background, color: preview.font }}
        aria-hidden
      >
        <div
          className="flex w-[38%] flex-col gap-2 border-r p-3"
          style={{
            backgroundColor: preview.sidebar,
            borderColor: "color-mix(in srgb, currentColor 12%, transparent)",
          }}
        >
          <span className="text-xs font-bold uppercase tracking-[0.06em] opacity-70">Menu</span>
          <span
            className="rounded-[8px] px-2.5 py-2 text-[13px] font-bold"
            style={{ backgroundColor: preview.highlight, color: preview.accentDark }}
          >
            Item ativo
          </span>
          <span className="px-2.5 py-2 text-[13px] opacity-70">Outro item</span>
        </div>
        <div className="flex-1 p-4">
          <span className="text-xs font-bold uppercase tracking-[0.06em] opacity-70">Prévia</span>
          <div className="mt-1.5 font-display text-lg font-extrabold">
            {active?.chapter.name ?? "Capítulo"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex min-h-10 items-center rounded-[12px] px-3.5 text-sm font-semibold"
              style={{ backgroundColor: preview.accent, color: readableOn(preview.accent) }}
            >
              Botão principal
            </span>
            <span
              className="inline-flex min-h-10 items-center rounded-[12px] px-3.5 text-sm font-semibold"
              style={{ backgroundColor: preview.highlight, color: preview.accentDark }}
            >
              Botão secundário
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={advanced}
        onClick={() => setAdvanced((v) => !v)}
        className="mt-4 min-h-11 text-[15px] font-semibold text-tv-primary underline-offset-4 hover:underline"
      >
        {advanced ? "Esconder ajuste fino das cores" : "Ajuste fino das cores (avançado)"}
      </button>

      {advanced ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5 text-sm font-semibold">
              {f.label}
              <span className="flex items-center gap-2 rounded-[12px] border border-tv-border bg-tv-surface px-2">
                <input
                  type="color"
                  value={isThemeHex(theme[f.key]) ? theme[f.key] : DEFAULT_ACCENT}
                  disabled={!isAdmin}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                  aria-label={`Escolher cor: ${f.label}`}
                />
                <Input
                  className="h-11 border-0 px-1 font-mono text-[15px] uppercase shadow-none focus-visible:ring-0"
                  value={theme[f.key]}
                  disabled={!isAdmin}
                  aria-label={`Código da cor: ${f.label}`}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    if (isThemeHex(v)) setField(f.key, v);
                    else setTheme((prev) => ({ ...prev, [f.key]: v }));
                  }}
                />
              </span>
              <span className="text-[13px] font-normal text-tv-text-2">{f.uso}</span>
            </label>
          ))}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => pickPreset(DEFAULT_ACCENT)}>
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
          <Button disabled={save.isPending || !valid || !dirty} onClick={() => save.mutate()}>
            <Save className="h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar cor"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-tv-text-2">
          Somente administradores podem alterar a cor do capítulo.
        </p>
      )}
    </Card>
  );
}

function AppearanceCard() {
  const { mode, setMode } = useTheme();

  return (
    <>
    <Card className="p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Moon className="h-5 w-5 text-tv-primary" aria-hidden /> Aparência
      </h2>
      <div role="radiogroup" aria-label="Aparência" className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(opt.value)}
              className={`flex min-h-[64px] items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-left transition-colors ${
                selected ? "border-tv-primary bg-tv-soft" : "border-tv-border bg-tv-surface hover:bg-tv-bg"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-tv-primary" : "text-tv-text-2"}`} aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">{opt.label}</span>
                <span className="block text-[13px] text-tv-text-2">{opt.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
    <AccentColorSection />
    </>
  );
}





export const Route = createFileRoute("/_authenticated/_shell/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do capítulo — Templo Virtual" },
      {
        name: "description",
        content: "Defina a logo do capítulo usada nos documentos e no cabeçalho do sistema.",
      },
      { property: "og:title", content: "Configurações do capítulo — Templo Virtual" },
      {
        property: "og:description",
        content: "Logo do capítulo, identidade visual e dados da sede.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

const MAX_BYTES = 2 * 1024 * 1024;

function ConfiguracoesPage() {
  const { active, refetch } = useActiveChapter();
  const { can, isAdminTotal, realCtx } = useChapterAccess();
  const chapterId = active?.chapter_id ?? "";
  const logoPath = active?.chapter.logo_url ?? null;
  const logoUrl = useChapterLogo(logoPath);
  const { data: signaturePath = null, refetch: refetchSignature } = useQuery({
    queryKey: ["chapter-email-signature", chapterId],
    enabled: Boolean(chapterId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("email_signature_url")
        .eq("id", chapterId)
        .maybeSingle();
      if (error) return null;
      return data?.email_signature_url ?? null;
    },
  });
  const signatureUrl = useChapterLogo(signaturePath);
  const allowed = can("admin") || can("secretaria") || can("conselho");
  const canViewAudit = isAdminTotal || isOrgLeader(realCtx);

  const inputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [signatureBusy, setSignatureBusy] = useState(false);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem (PNG, JPG ou WEBP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("A imagem deve ter no máximo 2 MB. Recomendado: 512×512 px.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${chapterId}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;

      const { error } = await supabase
        .from("chapters")
        .update({ logo_url: path })
        .eq("id", chapterId);
      if (error) throw error;

      if (logoPath) await supabase.storage.from(LOGO_BUCKET).remove([logoPath]);
      toast.success("Logo atualizada");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a logo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ logo_url: null })
        .eq("id", chapterId);
      if (error) throw error;
      if (logoPath) await supabase.storage.from(LOGO_BUCKET).remove([logoPath]);
      toast.success("Logo removida");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover a logo");
    } finally {
      setBusy(false);
    }
  }

  async function onSignatureFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem (PNG, JPG ou WEBP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("A imagem deve ter no máximo 2 MB.");
      return;
    }
    setSignatureBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${chapterId}/email-signature/assinatura-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;

      const { error } = await supabase
        .from("chapters")
        .update({ email_signature_url: path })
        .eq("id", chapterId);
      if (error) throw error;

      if (signaturePath) {
        await supabase.storage.from(LOGO_BUCKET).remove([signaturePath]);
      }
      toast.success("Assinatura de e-mail atualizada");
      void refetchSignature();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a assinatura");
    } finally {
      setSignatureBusy(false);
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  }

  async function removeSignature() {
    setSignatureBusy(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({ email_signature_url: null })
        .eq("id", chapterId);
      if (error) throw error;
      if (signaturePath) {
        await supabase.storage.from(LOGO_BUCKET).remove([signaturePath]);
      }
      toast.success("Assinatura de e-mail removida");
      void refetchSignature();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover a assinatura");
    } finally {
      setSignatureBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configurações"
        subtitle="Identidade visual e dados do capítulo ativo."
      />

      <Tabs defaultValue="secretaria">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="secretaria">Secretaria</TabsTrigger>
          <TabsTrigger value="tesouraria">Tesouraria</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
          {canViewAudit ? (
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="secretaria" className="space-y-4">
          <ChapterProfileCard />
          <LodgesCard />
          <ChaveTemplateCard />
          <MinutePasswordsCard />
        </TabsContent>

        <TabsContent value="tesouraria" className="space-y-4">
          <DefaultDuesCard />
          <PixKeyCard />
          <PublicLobbyLinkCard />
        </TabsContent>

        <TabsContent value="visual" className="space-y-4">
          <AppearanceCard />
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-tv-text [&>svg]:text-tv-primary">
              <Building2 className="h-5 w-5" /> Logo do capítulo
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40 p-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo do ${active?.chapter.name ?? "capítulo"}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="px-3 text-center text-xs text-muted-foreground">
                    Nenhuma logo definida
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Usada no topo das atas exportadas em PDF. Envie uma imagem
                  quadrada, preferencialmente 512×512 px, em PNG com fundo
                  transparente. Tamanho máximo: 2 MB.
                </p>
                {allowed ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onFile(f);
                      }}
                    />
                    <Button
                      style={{ backgroundColor: "var(--chapter-primary)" }}
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      {logoPath ? "Trocar logo" : "Enviar logo"}
                    </Button>
                    {logoPath && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void removeLogo()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remover
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Somente a administração do capítulo pode alterar a logo.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-tv-text [&>svg]:text-tv-primary">
              <ImagePlus className="h-5 w-5" /> Assinatura de e-mail
            </div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-28 w-full max-w-sm shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40 p-3">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Assinatura de e-mail"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="px-3 text-center text-xs text-muted-foreground">
                    Nenhuma assinatura definida
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Imagem anexada no rodapé dos e-mails do capítulo. Fica na pasta{" "}
                  <span className="font-medium">email-signature</span> do
                  capítulo. PNG ou JPG, até 2 MB, de preferência em faixa larga.
                </p>
                {allowed ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onSignatureFile(f);
                      }}
                    />
                    <Button
                      style={{ backgroundColor: "var(--chapter-primary)" }}
                      disabled={signatureBusy}
                      onClick={() => signatureInputRef.current?.click()}
                    >
                      {signatureBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      {signaturePath ? "Trocar assinatura" : "Enviar assinatura"}
                    </Button>
                    {signaturePath ? (
                      <Button
                        variant="outline"
                        disabled={signatureBusy}
                        onClick={() => void removeSignature()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remover
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Somente a administração do capítulo pode alterar a assinatura.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {canViewAudit ? (
          <TabsContent value="auditoria">
            <ChapterAuditPanel
              chapterId={chapterId}
              chapterName={`${active?.chapter.name ?? "Capítulo"} nº ${active?.chapter.number ?? ""}`}
              chapterCity={active?.chapter.city}
              logoPath={logoPath ?? null}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function DefaultDuesCard() {
  const { active, refetch } = useActiveChapter();
  const { can } = useChapterAccess();
  const qc = useQueryClient();
  const allowed = can("tesouraria") || can("admin");
  const chapterSettings = active?.chapter as
    | { settings?: Record<string, unknown> }
    | undefined;
  const saved = getChapterDefaultDuesAmount(chapterSettings);
  const savedEnabled = isChapterDuesEnabled(chapterSettings);
  const [amount, setAmount] = useState(saved);
  const [enabled, setEnabled] = useState(savedEnabled);

  useEffect(() => {
    setAmount(saved);
    setEnabled(savedEnabled);
  }, [saved, savedEnabled, active?.chapter_id]);

  const saveAmount = useMutation({
    mutationFn: () =>
      saveDefaultDuesAmount({
        data: { chapterId: active!.chapter_id, amount },
      }),
    onSuccess: async () => {
      toast.success("Mensalidade padrão salva");
      await refetch();
      await qc.invalidateQueries({ queryKey: ["dues-year"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const saveEnabled = useMutation({
    mutationFn: (next: boolean) =>
      saveChapterDuesEnabled({
        data: { chapterId: active!.chapter_id, enabled: next },
      }),
    onSuccess: async (_data, next) => {
      toast.success(
        next
          ? "Mensalidades ativadas neste capítulo"
          : "Mensalidades desativadas neste capítulo",
      );
      await refetch();
      await qc.invalidateQueries({ queryKey: ["dues-year"] });
      await qc.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (e: any) => {
      setEnabled(savedEnabled);
      toast.error(e?.message ?? "Erro ao salvar");
    },
  });

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2 text-lg font-bold text-tv-text [&>svg]:text-tv-primary">
        <Receipt className="h-5 w-5" /> Mensalidades
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Cobrar mensalidade</div>
          <p className="text-xs text-muted-foreground">
            Desative se o capítulo não cobra mensalidade dos membros.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={!allowed || saveEnabled.isPending}
          onCheckedChange={(v) => {
            setEnabled(v);
            saveEnabled.mutate(v);
          }}
          aria-label="Cobrar mensalidade"
        />
      </div>
      {enabled && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Valor usado ao gerar competências do calendário. Padrão sugerido:
            R$ 20,00.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1 block text-xs">Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-36"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                disabled={!allowed}
              />
            </div>
            {allowed ? (
              <Button
                type="button"
                disabled={
                  saveAmount.isPending ||
                  !Number.isFinite(amount) ||
                  amount < 0
                }
                onClick={() => saveAmount.mutate()}
              >
                {saveAmount.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar valor
              </Button>
            ) : (
              <p className="pb-2 text-xs text-muted-foreground">
                Somente tesouraria ou administração podem alterar.
              </p>
            )}
          </div>
        </>
      )}
      {!enabled && !allowed && (
        <p className="text-xs text-muted-foreground">
          Somente tesouraria ou administração podem alterar.
        </p>
      )}
    </Card>
  );
}

function PublicLobbyLinkCard() {
  const { active } = useActiveChapter();
  const { can } = useChapterAccess();
  const chapterId = active?.chapter_id;
  const { data: publicSlug } = useChapterPublicSlug(chapterId);
  const allowed = can("tesouraria") || can("admin");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"revoke" | "regenerate" | null>(
    null,
  );

  const shareUrl =
    token && publicSlug?.slug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${publicOrgHref(publicSlug.slug)}`
      : typeof window !== "undefined" && token
        ? `${window.location.origin}/c/${token}`
        : token
          ? `/c/${token}`
          : "";

  const openShare = useMutation({
    mutationFn: async () => {
      const existing = await getPublicLobbyToken({
        data: { chapterId: chapterId! },
      });
      return existing.token;
    },
    onSuccess: (t) => {
      setToken(t);
      setOpen(true);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao abrir link"),
  });

  const generate = useMutation({
    mutationFn: () =>
      ensurePublicLobbyToken({
        data: { chapterId: chapterId!, regenerate: false },
      }),
    onSuccess: (r) => {
      setToken(r.token);
      toast.success("Link público gerado");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link"),
  });

  const regenerate = useMutation({
    mutationFn: () =>
      ensurePublicLobbyToken({
        data: { chapterId: chapterId!, regenerate: true },
      }),
    onSuccess: (r) => {
      setToken(r.token);
      setConfirmAction(null);
      toast.success("Novo link gerado. O anterior deixou de funcionar.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao regenerar"),
  });

  const revoke = useMutation({
    mutationFn: () =>
      revokePublicLobbyToken({ data: { chapterId: chapterId! } }),
    onSuccess: () => {
      setToken(null);
      setConfirmAction(null);
      toast.success("Link público revogado");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao revogar"),
  });

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  if (!allowed) return null;

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-tv-text [&>svg]:text-tv-primary">
          <Link2 className="h-5 w-5" /> Link público
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Um único link com menu de mensalidades, fluxo de caixa, presenças e área do
          membro (protegida por ID DeMolay). Os links antigos de mensalidades e fluxo
          continuam válidos.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!chapterId || openShare.isPending}
          onClick={() => openShare.mutate()}
        >
          <Link2 className="mr-2 h-4 w-4" />
          {openShare.isPending ? "Abrindo…" : "Gerenciar link"}
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link público do capítulo</DialogTitle>
            <DialogDescription>
              Qualquer pessoa com o link acessa o lobby. Cobranças, cadastro e frequência
              pessoal pedem o ID DeMolay do membro neste capítulo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {token ? (
              <>
                <Label>URL compartilhável</Label>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyShareLink()}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Regenerar invalida o link atual. O anterior deixa de funcionar.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum link ativo.</p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {token ? (
              <Button
                type="button"
                variant="destructive"
                disabled={revoke.isPending}
                onClick={() => setConfirmAction("revoke")}
              >
                {revoke.isPending ? "Revogando…" : "Revogar"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              {token ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={regenerate.isPending}
                    onClick={() => setConfirmAction("regenerate")}
                  >
                    {regenerate.isPending ? "Gerando…" : "Regenerar"}
                  </Button>
                  <Button type="button" onClick={() => void copyShareLink()}>
                    Copiar link
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={!chapterId || generate.isPending}
                  onClick={() => generate.mutate()}
                >
                  {generate.isPending ? "Gerando…" : "Gerar link"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "revoke" ? "Revogar link?" : "Regenerar link?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "revoke"
                ? "O link público deixará de funcionar imediatamente."
                : "Um novo link será gerado e o atual deixará de funcionar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending || regenerate.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending || regenerate.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction === "revoke") revoke.mutate();
                else if (confirmAction === "regenerate") regenerate.mutate();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChapterProfileCard() {
  const { active, refetch } = useActiveChapter();
  const { can } = useChapterAccess();
  const isAdmin = can("admin") || can("secretaria"); // buckets derivados da matriz
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [foundedAt, setFoundedAt] = useState("");

  useEffect(() => {
    setName(active?.chapter.name ?? "");
    setNumber(active?.chapter.number ?? "");
    setCity(active?.chapter.city ?? "");
    const founded = (active?.chapter as any)?.settings?.founded_at;
    setFoundedAt(typeof founded === "string" ? founded : "");
  }, [
    active?.chapter.name,
    active?.chapter.number,
    active?.chapter.city,
    (active?.chapter as any)?.settings?.founded_at,
  ]);

  const foundedYear = foundedAt.match(/^(\d{4})/)?.[1] ?? "";

  const save = useMutation({
    mutationFn: () =>
      updateChapterProfile({
        data: {
          chapter_id: active!.chapter_id,
          name: name.trim(),
          number: number.trim(),
          city: city.trim() || null,
          founded_at: foundedAt || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dados do capítulo atualizados");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2 text-lg font-bold text-tv-text [&>svg]:text-tv-primary">
        <Building2 className="h-5 w-5" /> Perfil do capítulo
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-xs">Nome do capítulo</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Número</Label>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} disabled={!isAdmin} />
        </div>
        <div className="sm:col-span-3">
          <Label className="mb-1 block text-xs">Cidade sede</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={!isAdmin} />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-xs">Data de fundação</Label>
          <Input
            type="date"
            value={foundedAt}
            onChange={(e) => setFoundedAt(e.target.value)}
            disabled={!isAdmin}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Define o primeiro semestre disponível nas vigências de cargos e comissões.
          </p>
        </div>
        <div>
          <Label className="mb-1 block text-xs">Ano de fundação</Label>
          <Input value={foundedYear} readOnly disabled placeholder="—" />
        </div>
      </div>
      {isAdmin ? (
        <div className="mt-4 flex justify-end">
          <Button
            style={{ backgroundColor: "var(--chapter-primary)" }}
            disabled={save.isPending || !name.trim() || !number.trim()}
            onClick={() => save.mutate()}
          >
            <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Somente administradores podem editar os dados do capítulo.
        </p>
      )}
    </Card>
  );
}

function LodgesCard() {
  const { active } = useActiveChapter();
  const { can } = useChapterAccess();
  const chapterId = active?.chapter_id ?? "";
  const canManage = can("admin") || can("secretaria");
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const lodges = useQuery({
    queryKey: ["chapter-lodges", chapterId],
    queryFn: () => listLodges({ data: { chapterId } }) as Promise<any[]>,
    enabled: Boolean(chapterId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["chapter-lodges", chapterId] });

  function resetForm() {
    setEditingId(null);
    setName("");
    setAddress("");
    setIsPrimary(false);
  }

  function startEdit(l: {
    id: string;
    name: string;
    address: string | null;
    is_primary: boolean;
  }) {
    setEditingId(l.id);
    setName(l.name);
    setAddress(l.address ?? "");
    setIsPrimary(!!l.is_primary);
  }

  const save = useMutation({
    mutationFn: () =>
      saveLodge({
        data: {
          id: editingId ?? undefined,
          chapter_id: chapterId,
          name: name.trim(),
          address: address.trim() || null,
          is_primary: isPrimary,
        },
      }),
    onSuccess: () => {
      toast.success(
        editingId ? "Loja patrocinadora atualizada" : "Loja patrocinadora adicionada",
      );
      resetForm();
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar loja"),
  });

  const setPrimary = useMutation({
    mutationFn: (l: any) =>
      saveLodge({
        data: { id: l.id, chapter_id: chapterId, name: l.name, address: l.address, is_primary: true },
      }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLodge({ data: { id } }),
    onSuccess: (_data, removedId) => {
      toast.success("Loja removida");
      if (editingId === removedId) resetForm();
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const list = lodges.data ?? [];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2 text-lg font-bold text-tv-text [&>svg]:text-tv-primary">
        <Landmark className="h-5 w-5" /> Lojas patrocinadoras
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma loja cadastrada. As lojas ficam disponíveis ao criar sessões no calendário.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-[8px] border border-border">
          {list.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {l.name}
                  {l.is_primary && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "var(--muted)", color: "var(--chapter-primary)" }}
                    >
                      Principal
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{l.address || "Sem endereço informado"}</div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  {!l.is_primary && (
                    <Button size="sm" variant="outline" onClick={() => setPrimary.mutate(l)}>
                      Tornar principal
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar loja"
                    onClick={() => startEdit(l)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    aria-label="Remover loja"
                    onClick={() => remove.mutate(l.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="mt-4 space-y-3 rounded-[8px] border border-dashed border-border p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {editingId ? "Editar loja patrocinadora" : "Nova loja patrocinadora"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Nome da loja</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Loja Maçônica…" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Endereço</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} /> Definir como loja principal
            </label>
            <div className="flex items-center gap-2">
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
              <Button
                style={{ backgroundColor: "var(--chapter-primary)" }}
                disabled={save.isPending || !name.trim()}
                onClick={() => save.mutate()}
              >
                {editingId ? (
                  <Save className="mr-2 h-4 w-4" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                {save.isPending
                  ? "Salvando…"
                  : editingId
                    ? "Salvar alterações"
                    : "Adicionar loja patrocinadora"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Somente administração e secretaria podem gerenciar as lojas patrocinadoras.
        </p>
      )}
    </Card>
  );
}
