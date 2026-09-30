import { useEffect, useRef, useState } from "react";
import { Camera, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "draw" | "photo";

type Props = {
  label: string;
  value: string | null;
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
};

export function SignaturePad({ label, value, disabled, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawing = useRef(false);
  const stroked = useRef(false);
  const [mode, setMode] = useState<Mode>("draw");
  const [hasStroke, setHasStroke] = useState(Boolean(value));
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [armCamera, setArmCamera] = useState(false);

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

    let cancelled = false;
    if (value?.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
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

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este aparelho não liberou a câmera.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
    } catch {
      setCameraError("Não foi possível abrir a câmera. Autorize o acesso e tente de novo.");
    }
  }

  useEffect(() => {
    if (!armCamera || mode !== "photo" || disabled) return;
    setArmCamera(false);
    void startCamera();
  }, [armCamera, mode, disabled]);

  useEffect(() => () => stopCamera(), []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxW = 900;
    const scale = Math.min(1, maxW / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    stopCamera();
    stroked.current = true;
    setHasStroke(true);
    onChange(dataUrl);
  }

  function clear() {
    setCameraError(null);
    stroked.current = false;
    setHasStroke(false);
    onChange(null);
    stopCamera();
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
    setCameraError(null);
    stopCamera();
    setMode(next);
    stroked.current = false;
    setHasStroke(false);
    onChange(null);
    if (next === "photo") setArmCamera(true);
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
            mode === "photo"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => switchMode("photo")}
        >
          <Camera className="h-3.5 w-3.5" />
          Tirar foto
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
          <video
            ref={videoRef}
            playsInline
            muted
            className={
              cameraOn
                ? "h-40 w-full rounded-[12px] border border-border bg-black object-cover"
                : "hidden"
            }
          />
          {value?.startsWith("data:image/") && !cameraOn ? (
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-[12px] border border-border bg-muted/30 p-2">
              <img
                src={value}
                alt="Foto da assinatura"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {cameraOn ? (
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={capturePhoto}
              >
                Capturar
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => void startCamera()}
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                {value ? "Tirar outra" : "Abrir câmera"}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Aponte a câmera para a assinatura em papel e capture a foto.
          </p>
          {cameraError ? (
            <p className="text-[11px] text-destructive">{cameraError}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
