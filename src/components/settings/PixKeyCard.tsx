import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, QrCode, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { can } from "@/lib/permissions";
import { updateChapterPixKey } from "@/lib/chapter.functions";
import { LOGO_BUCKET, useChapterLogo } from "@/lib/chapter-logo";
import { supabase } from "@/integrations/supabase/client";

const MAX_QR_BYTES = 2 * 1024 * 1024;

/** Chave Pix + imagem QR do capítulo (settings), usadas no checkout de comanda. */
export function PixKeyCard() {
  const { active, refetch } = useActiveChapter();
  const allowed =
    can(active?.role.name, "admin") || can(active?.role.name, "tesouraria");
  const settings = (
    active?.chapter as { settings?: Record<string, unknown> } | undefined
  )?.settings;
  const savedKey =
    typeof settings?.pix_key === "string" ? settings.pix_key : "";
  const savedQrPath =
    typeof settings?.pix_qr_path === "string" ? settings.pix_qr_path : null;

  const [pixKey, setPixKey] = useState(savedKey);
  const [busyQr, setBusyQr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qrUrl = useChapterLogo(savedQrPath);

  useEffect(() => {
    setPixKey(savedKey);
  }, [savedKey]);

  const save = useMutation({
    mutationFn: () =>
      updateChapterPixKey({
        data: {
          chapter_id: active!.chapter_id,
          pix_key: pixKey.trim() || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Chave Pix salva");
      await refetch();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  async function onQrFile(file: File) {
    if (!active?.chapter_id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem (PNG, JPG ou WEBP).");
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      toast.error("Arquivo maior que 2 MB.");
      return;
    }
    setBusyQr(true);
    try {
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${active.chapter_id}/pix-qr-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      await updateChapterPixKey({
        data: {
          chapter_id: active.chapter_id,
          pix_qr_path: path,
        },
      });
      if (savedQrPath) {
        await supabase.storage.from(LOGO_BUCKET).remove([savedQrPath]);
      }
      toast.success("QR Code Pix enviado");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar QR");
    } finally {
      setBusyQr(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeQr() {
    if (!active?.chapter_id) return;
    setBusyQr(true);
    try {
      await updateChapterPixKey({
        data: {
          chapter_id: active.chapter_id,
          pix_qr_path: null,
        },
      });
      if (savedQrPath) {
        await supabase.storage.from(LOGO_BUCKET).remove([savedQrPath]);
      }
      toast.success("QR Code removido");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover QR");
    } finally {
      setBusyQr(false);
    }
  }

  return (
    <Card className="rounded-[12px] p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <QrCode className="h-5 w-5" /> Chave Pix do capítulo
      </div>
      <p className="text-sm text-muted-foreground">
        Exibida no checkout da comanda. O QR só aparece se houver imagem
        enviada abaixo — a chave sozinha não gera QR automático.
      </p>
      <div>
        <Label htmlFor="chapter-pix-key" className="mb-1.5 block text-xs">
          Chave Pix
        </Label>
        <Input
          id="chapter-pix-key"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          disabled={!allowed}
        />
      </div>
      {allowed ? (
        <Button
          style={{ backgroundColor: "var(--chapter-primary)" }}
          disabled={save.isPending || pixKey.trim() === savedKey.trim()}
          onClick={() => save.mutate()}
        >
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? "Salvando…" : "Salvar chave"}
        </Button>
      ) : null}

      <div className="border-t border-border pt-4">
        <Label className="mb-1.5 block text-xs">Imagem do QR Code Pix</Label>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-36 w-36 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/40">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR Code Pix do capítulo"
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span className="px-3 text-center text-xs text-muted-foreground">
                Nenhuma imagem
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-muted-foreground">
              PNG, JPG ou WEBP · máx. 2 MB. Use o QR oficial do banco/app Pix.
            </p>
            {allowed ? (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onQrFile(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyQr}
                  onClick={() => inputRef.current?.click()}
                >
                  {busyQr ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  {savedQrPath ? "Trocar imagem" : "Enviar imagem"}
                </Button>
                {savedQrPath ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyQr}
                    onClick={() => void removeQr()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remover
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Somente administração ou tesouraria pode alterar.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
