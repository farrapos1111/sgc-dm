import { useEffect, useRef, useState } from "react";
import { ImagePlus, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "draw" | "upload";

type Props = {
  label: string;
  value: string | null;
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
};

const MAX_UPLOAD_BYTES = 1_500_000;

function isPngDataUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("data:image/png"));
}

export function SignaturePad({ label, value, disabled, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const stroked = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(() =>
    value?.startsWith("data:image/") ? "upload" : "draw",
  );
  const [hasStroke, setHasStroke] = useState(Boolean(value));
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.clearRect(0, 0, w, h);

    if (value?.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => {
        // Centraliza mantendo proporção (útil para PNG transparente).
        const scale = Math.min(w / img.width, h / img.height, 1);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, dx, dy, dw, dh);
        stroked.current = true;
        setHasStroke(true);
      };
      img.src = value;
    } else {
      stroked.current = false;
      setHasStroke(false);
    }
  }, [mode, value]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function commitCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    setUploadError(null);
    stroked.current = false;
    setHasStroke(false);
    onChange(null);
    if (fileRef.current) fileRef.current.value = "";
    if (mode === "draw") {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      }
    }
  }

  function switchMode(next: Mode) {
    if (disabled || next === mode) return;
    setUploadError(null);
    setMode(next);
    // Trocar de modo limpa a assinatura atual para evitar mistura.
    stroked.current = false;
    setHasStroke(false);
    onChange(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFilePicked(file: File | null) {
    setUploadError(null);
    if (!file) return;
    if (file.type !== "image/png") {
      setUploadError("Envie um arquivo PNG (fundo transparente).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Arquivo muito grande (máx. ~1,5 MB).");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (!isPngDataUrl(dataUrl)) {
        setUploadError("Arquivo PNG inválido.");
        return;
      }
      // Valida se carrega como imagem
      await loadImage(dataUrl);
      stroked.current = true;
      setHasStroke(true);
      onChange(dataUrl);
    } catch {
      setUploadError("Não foi possível ler o PNG.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {!disabled ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-colors",
            mode === "draw"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => switchMode("draw")}
        >
          <PenLine className="h-3.5 w-3.5" />
          Desenhar
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-colors",
            mode === "upload"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => switchMode("upload")}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Enviar PNG
        </button>
      </div>

      {mode === "draw" ? (
        <>
          <canvas
            ref={canvasRef}
            className="h-28 w-full touch-none rounded-[12px] border border-border"
            style={{
              touchAction: "none",
              backgroundImage:
                "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
              backgroundColor: "#fff",
            }}
            onPointerDown={(e) => {
              if (disabled) return;
              drawing.current = true;
              const ctx = canvasRef.current?.getContext("2d");
              if (!ctx) return;
              const p = pos(e);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drawing.current || disabled) return;
              const ctx = canvasRef.current?.getContext("2d");
              if (!ctx) return;
              const p = pos(e);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              stroked.current = true;
              setHasStroke(true);
            }}
            onPointerUp={() => {
              if (!drawing.current) return;
              drawing.current = false;
              if (stroked.current) commitCanvas();
            }}
          />
          {!hasStroke ? (
            <p className="text-[11px] text-muted-foreground">
              Assine na área acima (fundo transparente).
            </p>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,.png"
            className="sr-only"
            disabled={disabled}
            onChange={(e) =>
              void onFilePicked(e.target.files?.[0] ?? null)
            }
          />
          {value?.startsWith("data:image/") ? (
            <div
              className="flex h-28 items-center justify-center overflow-hidden rounded-[12px] border border-border p-2"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                backgroundColor: "#fff",
              }}
            >
              <img
                src={value}
                alt="Prévia da assinatura"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-60"
            >
              <ImagePlus className="h-5 w-5" />
              Escolher PNG transparente
            </button>
          )}
          {value ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
            >
              Trocar arquivo
            </Button>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Preferencialmente PNG com fundo transparente (sem fundo branco).
          </p>
          {uploadError ? (
            <p className="text-[11px] text-destructive">{uploadError}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Leitura inválida"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha na leitura"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = src;
  });
}
