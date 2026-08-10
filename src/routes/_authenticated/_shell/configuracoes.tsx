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
  resolveChapterTheme,
  type ChapterTheme,
} from "@/lib/chapter-theme";
import { ImagePlus, Loader2, Trash2, Building2, Landmark, PlusCircle, Save, Sun, Moon, MonitorSmartphone, Palette, RotateCcw, Check, Receipt, Link2, Copy } from "lucide-react";
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

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: MonitorSmartphone },
];

const DEFAULT_ACCENT = "#9E1B32";

const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: "#9E1B32", label: "Vinho DeMolay" },
  { value: "#1D4ED8", label: "Azul" },
  { value: "#0F766E", label: "Verde" },
  { value: "#B45309", label: "Dourado" },
  { value: "#6D28D9", label: "Roxo" },
  { value: "#374151", label: "Grafite" },
];

const THEME_FIELDS: {
  key: keyof ChapterTheme;
  label: string;
}[] = [
  { key: "background", label: "Fundo" },
  { key: "sidebar", label: "Sidebar" },
  { key: "accent", label: "Destaque" },
  { key: "accentDark", label: "Destaque escuro" },
  { key: "highlight", label: "Realce" },
  { key: "font", label: "Texto" },
];

/** Texto legível sobre a cor escolhida (luminância relativa). */
function readableOn(hex: string) {
  if (!isThemeHex(hex)) return "#FFFFFF";
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.55 ? "#1A1A1A" : "#FFFFFF";
}

function themesEqual(a: ChapterTheme, b: ChapterTheme) {
  return THEME_FIELDS.every(
    (f) => a[f.key].toUpperCase() === b[f.key].toUpperCase(),
  );
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
    applyChapterThemeVars(document.documentElement, theme);
    return () => {
      applyChapterThemeVars(document.documentElement, saved);
    };
  }, [
    theme.background,
    theme.accent,
    theme.accentDark,
    theme.highlight,
    theme.font,
    theme.sidebar,
    saved.background,
    saved.accent,
    saved.accentDark,
    saved.highlight,
    saved.font,
    saved.sidebar,
  ]);

  function pickPreset(hex: string) {
    if (!isAdmin) return;
    setTheme(deriveThemeFromPrimary(hex));
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
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Palette className="h-5 w-5" /> Tema do capítulo
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Define fundo, sidebar, texto, destaques e realces do capítulo. No modo
        escuro, fundo/sidebar/texto da interface permanecem escuros; as cores de
        destaque continuam valendo.
      </p>

      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((p) => {
          const selected = theme.accent.toUpperCase() === p.value.toUpperCase();
          return (
            <button
              key={p.value}
              type="button"
              title={p.label}
              aria-label={p.label}
              aria-pressed={selected}
              disabled={!isAdmin}
              onClick={() => pickPreset(p.value)}
              className="grid h-11 w-11 place-items-center rounded-full border-2 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: p.value,
                borderColor: selected ? "var(--foreground)" : "transparent",
              }}
            >
              {selected && <Check className="h-4 w-4" style={{ color: readableOn(p.value) }} />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {THEME_FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="mb-1 block text-xs">{f.label}</Label>
            <input
              type="color"
              value={isThemeHex(theme[f.key]) ? theme[f.key] : DEFAULT_ACCENT}
              disabled={!isAdmin}
              onChange={(e) => setField(f.key, e.target.value)}
              className="h-11 w-full cursor-pointer rounded-[8px] border border-border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={f.label}
            />
            <Input
              className="mt-1.5 h-9 font-mono text-xs uppercase"
              value={theme[f.key]}
              disabled={!isAdmin}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                if (isThemeHex(v)) setField(f.key, v);
                else setTheme((prev) => ({ ...prev, [f.key]: v }));
              }}
            />
          </div>
        ))}
      </div>

      <div
        className="mt-4 overflow-hidden rounded-[12px] border border-border"
        style={{ backgroundColor: theme.background, color: theme.font }}
      >
        <div className="flex min-h-[140px]">
          <div
            className="flex w-[38%] flex-col gap-2 border-r p-3"
            style={{
              backgroundColor: theme.sidebar,
              borderColor: "color-mix(in srgb, currentColor 12%, transparent)",
            }}
          >
            <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
              Sidebar
            </div>
            <div
              className="rounded-[6px] px-2 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: `${theme.accent}22`,
                color: theme.accent,
              }}
            >
              Item ativo
            </div>
            <div className="px-2 py-1.5 text-xs opacity-60">Item</div>
          </div>
          <div className="flex-1 p-4">
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">
              Pré-visualização
            </div>
            <div className="mt-2 text-sm font-semibold">Título do capítulo</div>
            <p className="mt-1 text-sm opacity-80">
              Texto de apoio com a cor tipográfica do tema.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="inline-flex h-9 items-center rounded-[8px] px-3 text-sm font-medium"
                style={{
                  backgroundColor: theme.accent,
                  color: readableOn(theme.accent),
                }}
              >
                Botão principal
              </span>
              <span
                className="inline-flex h-9 items-center rounded-[8px] px-3 text-sm font-medium"
                style={{
                  backgroundColor: theme.accentDark,
                  color: readableOn(theme.accentDark),
                }}
              >
                Destaque escuro
              </span>
              <span
                className="inline-flex h-9 items-center rounded-[8px] px-3 text-sm font-medium"
                style={{ backgroundColor: theme.highlight, color: theme.font }}
              >
                Realce
              </span>
            </div>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => pickPreset(DEFAULT_ACCENT)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
          </Button>
          <Button
            style={{
              backgroundColor: theme.accent,
              color: readableOn(theme.accent),
            }}
            disabled={save.isPending || !valid || !dirty}
            onClick={() => save.mutate()}
          >
            <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar tema"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Somente administradores podem alterar o tema do capítulo.
        </p>
      )}
    </div>
  );
}

function AppearanceCard() {
  const { mode, setMode } = useTheme();

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Moon className="h-5 w-5" /> Aparência
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Escolha o tema da interface. A opção “Sistema” segue a preferência do seu dispositivo.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              aria-pressed={selected}
              className={`flex min-h-[44px] items-center gap-3 rounded-[8px] border px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <AccentColorSection />
    </Card>
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
  const { can } = useChapterAccess();
  const chapterId = active?.chapter_id ?? "";
  const logoPath = (active?.chapter as any)?.logo_url as string | null | undefined;
  const logoUrl = useChapterLogo(logoPath);
  const allowed = can("admin") || can("secretaria") || can("conselho");

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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
          <Card className="rounded-[12px] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
        </TabsContent>
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
    <Card className="rounded-[12px] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
  const allowed = can("tesouraria") || can("admin");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"revoke" | "regenerate" | null>(
    null,
  );

  const shareUrl =
    typeof window !== "undefined" && token
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
      <Card className="rounded-[12px] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
    <Card className="rounded-[12px] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
  const isAdmin = can("admin");
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const lodges = useQuery({
    queryKey: ["chapter-lodges", chapterId],
    queryFn: () => listLodges({ data: { chapterId } }) as Promise<any[]>,
    enabled: Boolean(chapterId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["chapter-lodges", chapterId] });

  const add = useMutation({
    mutationFn: () =>
      saveLodge({
        data: {
          chapter_id: chapterId,
          name: name.trim(),
          address: address.trim() || null,
          is_primary: isPrimary,
        },
      }),
    onSuccess: () => {
      toast.success("Loja patrocinadora adicionada");
      setName("");
      setAddress("");
      setIsPrimary(false);
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
    onSuccess: () => {
      toast.success("Loja removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const list = lodges.data ?? [];

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: "var(--muted)", color: "var(--chapter-primary)" }}
                    >
                      Principal
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{l.address || "Sem endereço informado"}</div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  {!l.is_primary && (
                    <Button size="sm" variant="outline" onClick={() => setPrimary.mutate(l)}>
                      Tornar principal
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
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

      {isAdmin ? (
        <div className="mt-4 space-y-3 rounded-[8px] border border-dashed border-border p-3">
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
            <Button
              style={{ backgroundColor: "var(--chapter-primary)" }}
              disabled={add.isPending || !name.trim()}
              onClick={() => add.mutate()}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {add.isPending ? "Salvando…" : "Adicionar loja patrocinadora"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Somente administradores podem gerenciar as lojas patrocinadoras.
        </p>
      )}
    </Card>
  );
}
