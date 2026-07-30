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
import { can } from "@/lib/permissions";
import { listLodges, saveLodge, deleteLodge, updateChapterProfile, updateChapterAccentColor } from "@/lib/chapter.functions";
import { saveDefaultDuesAmount } from "@/lib/finance.functions";
import { getChapterDefaultDuesAmount } from "@/lib/dues-rules";
import { ImagePlus, Loader2, Trash2, Building2, Landmark, PlusCircle, Save, Sun, Moon, MonitorSmartphone, Palette, RotateCcw, Check, Receipt, Link2, Copy } from "lucide-react";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import { ChaveTemplateCard } from "@/components/settings/ChaveTemplateCard";
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

function isValidHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Texto legível sobre a cor escolhida (luminância relativa). */
function readableOn(hex: string) {
  if (!isValidHex(hex)) return "#FFFFFF";
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.55 ? "#1A1A1A" : "#FFFFFF";
}

function applyAccentPreview(hex: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--chapter-primary", hex);
}

function AccentColorSection() {
  const { active, refetch } = useActiveChapter();
  const isAdmin = can(active?.role.name, "admin");
  const saved = active?.chapter.primary_color || DEFAULT_ACCENT;
  const [color, setColor] = useState(saved);
  const [text, setText] = useState(saved);

  useEffect(() => {
    setColor(saved);
    setText(saved);
  }, [saved]);

  // Limpa a pré-visualização ao sair da tela.
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.style.removeProperty("--chapter-primary");
      }
    };
  }, []);

  function pick(hex: string) {
    if (!isAdmin) return;
    setColor(hex);
    setText(hex.toUpperCase());
    applyAccentPreview(hex);
  }

  const save = useMutation({
    mutationFn: () =>
      updateChapterAccentColor({
        data: { chapter_id: active!.chapter_id, primary_color: color },
      }),
    onSuccess: () => {
      toast.success("Cor de destaque atualizada");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar a cor"),
  });

  const dirty = color.toUpperCase() !== saved.toUpperCase();

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Palette className="h-5 w-5" /> Cor de destaque
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Define a cor usada em botões, destaques e etiquetas do capítulo. Vale para todos os membros
        deste capítulo.
      </p>

      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((p) => {
          const selected = color.toUpperCase() === p.value.toUpperCase();
          return (
            <button
              key={p.value}
              type="button"
              title={p.label}
              aria-label={p.label}
              aria-pressed={selected}
              disabled={!isAdmin}
              onClick={() => pick(p.value)}
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

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1 block text-xs">Cor personalizada</Label>
          <input
            type="color"
            value={isValidHex(color) ? color : DEFAULT_ACCENT}
            disabled={!isAdmin}
            onChange={(e) => pick(e.target.value.toUpperCase())}
            className="h-11 w-16 cursor-pointer rounded-[8px] border border-border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Escolher cor personalizada"
          />
        </div>
        <div className="w-36">
          <Label className="mb-1 block text-xs">Hex</Label>
          <Input
            value={text}
            disabled={!isAdmin}
            placeholder="#9E1B32"
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setText(v);
              if (isValidHex(v)) {
                setColor(v);
                applyAccentPreview(v);
              }
            }}
          />
        </div>
        <div className="flex-1" />
        <div
          className="grid h-11 min-w-[7rem] place-items-center rounded-[8px] px-4 text-sm font-medium"
          style={{ backgroundColor: color, color: readableOn(color) }}
        >
          Pré-visualização
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => pick(DEFAULT_ACCENT)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
          </Button>
          <Button
            style={{ backgroundColor: color, color: readableOn(color) }}
            disabled={save.isPending || !isValidHex(color) || !dirty}
            onClick={() => save.mutate()}
          >
            <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar cor"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Somente administradores podem alterar a cor do capítulo.
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
      { title: "Configurações do capítulo — SG-CDM" },
      {
        name: "description",
        content: "Defina a logo do capítulo usada nos documentos e no cabeçalho do sistema.",
      },
      { property: "og:title", content: "Configurações do capítulo — SG-CDM" },
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
  const chapterId = active?.chapter_id ?? "";
  const logoPath = (active?.chapter as any)?.logo_url as string | null | undefined;
  const logoUrl = useChapterLogo(logoPath);
  const allowed =
    can(active?.role.name, "admin") ||
    can(active?.role.name, "secretaria") ||
    can(active?.role.name, "conselho");

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

      <AppearanceCard />
      <ChapterProfileCard />
      <DefaultDuesCard />
      <PublicLobbyLinkCard />
      <LodgesCard />
      <ChaveTemplateCard />



      <Card className="rounded-[12px] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="h-5 w-5" /> Logo do capítulo
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo do ${active?.chapter.name ?? "capítulo"}`}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span className="px-3 text-center text-xs text-muted-foreground">
                Nenhuma logo definida
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Usada no topo das atas exportadas em PDF. Envie uma imagem quadrada, preferencialmente
              512×512 px, em PNG com fundo transparente. Tamanho máximo: 2 MB.
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
                  <Button variant="outline" disabled={busy} onClick={() => void removeLogo()}>
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
    </div>
  );
}

function DefaultDuesCard() {
  const { active, refetch } = useActiveChapter();
  const qc = useQueryClient();
  const allowed =
    can(active?.role.name, "tesouraria") || can(active?.role.name, "admin");
  const saved = getChapterDefaultDuesAmount(
    active?.chapter as { settings?: Record<string, unknown> } | undefined,
  );
  const [amount, setAmount] = useState(saved);

  useEffect(() => {
    setAmount(saved);
  }, [saved, active?.chapter_id]);

  const save = useMutation({
    mutationFn: () =>
      saveDefaultDuesAmount({
        data: { chapterId: active!.chapter_id, amount },
      }),
    onSuccess: async () => {
      toast.success("Mensalidade padrão salva nas configurações do capítulo");
      await refetch();
      await qc.invalidateQueries({ queryKey: ["dues-year"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Receipt className="h-5 w-5" /> Mensalidade padrão
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Valor usado ao gerar competências do calendário de mensalidades. Fica salvo em
        settings do capítulo.
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
            disabled={save.isPending || !Number.isFinite(amount) || amount < 0}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        ) : (
          <p className="pb-2 text-xs text-muted-foreground">
            Somente tesouraria ou administração podem alterar.
          </p>
        )}
      </div>
    </Card>
  );
}

function PublicLobbyLinkCard() {
  const { active } = useActiveChapter();
  const chapterId = active?.chapter_id;
  const allowed =
    can(active?.role.name, "tesouraria") || can(active?.role.name, "admin");
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
  const isAdmin = can(active?.role.name, "admin");
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
  const chapterId = active?.chapter_id ?? "";
  const isAdmin = can(active?.role.name, "admin");
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
