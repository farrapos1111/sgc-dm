import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const LOGO_BUCKET = "chapter-logos";

/** Normaliza path de storage: remove URL absoluta e prefixo do bucket. */
export function normalizeChapterLogoPath(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  let p = trimmed.replace(/^\/+/, "");
  if (p.startsWith(`${LOGO_BUCKET}/`)) {
    p = p.slice(LOGO_BUCKET.length + 1);
  }
  return p || null;
}

/** URL assinada temporária para exibir a logo do capítulo (bucket privado). */
export function useChapterLogo(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const normalized = normalizeChapterLogoPath(path);

  useEffect(() => {
    let cancelled = false;
    if (!normalized) {
      setUrl(null);
      return;
    }
    if (/^https?:\/\//i.test(normalized)) {
      setUrl(normalized);
      return;
    }
    setUrl(null);
    supabase.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(normalized, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setUrl(null);
          return;
        }
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return url;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * jsPDF só embute PNG/JPEG de forma confiável.
 * SVG/WebP (e afins) são rasterizados em canvas → PNG.
 */
async function prepareSvgBlob(blob: Blob): Promise<Blob> {
  try {
    let text = await blob.text();
    const vbMatch = text.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    const hasWidth = /\bwidth\s*=/i.test(text);
    if (!hasWidth) {
      let w = 512;
      let h = 512;
      if (vbMatch) {
        const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          w = Math.round(parts[2]);
          h = Math.round(parts[3]);
        }
      }
      text = text.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
    }
    return new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  } catch {
    return blob;
  }
}

async function rasterizeToPngDataUrl(
  source: string | Blob,
  opts?: { treatAsSvg?: boolean },
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  let drawable: string | Blob = source;
  if (source instanceof Blob && (opts?.treatAsSvg || /svg/i.test(source.type))) {
    drawable = await prepareSvgBlob(source);
  }

  const objectUrl =
    typeof drawable === "string" ? null : URL.createObjectURL(drawable);
  const src = typeof drawable === "string" ? drawable : objectUrl!;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao carregar imagem"));
      el.src = src;
    });

    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) {
      w = 512;
      h = 512;
    }

    const max = 1024;
    const scale = Math.min(1, max / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Garante data URL compatível com jsPDF (PNG/JPEG). */
export async function ensurePdfLogoDataUrl(
  dataUrl: string | null | undefined,
  mimeHint?: string | null,
): Promise<string | null> {
  if (!dataUrl) return null;
  if (/^data:image\/(png|jpe?g);/i.test(dataUrl)) return dataUrl;

  const needsRaster =
    /svg|webp|gif|avif/i.test(mimeHint || "") ||
    /^data:image\/(svg\+xml|webp|gif|avif)/i.test(dataUrl) ||
    !/^data:image\//i.test(dataUrl);

  if (!needsRaster) return dataUrl;
  return rasterizeToPngDataUrl(dataUrl);
}

/** Baixa a logo e converte para data URL PNG (necessário para embutir no PDF). */
export async function loadLogoDataUrl(
  path: string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeChapterLogoPath(path);
  if (!normalized) return null;

  let blob: Blob | null = null;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const res = await fetch(normalized);
      if (!res.ok) return null;
      blob = await res.blob();
    } catch {
      return null;
    }
  } else {
    const { data, error } = await supabase.storage
      .from(LOGO_BUCKET)
      .download(normalized);
    if (error || !data) return null;
    blob = data;
  }

  const pathLooksSvg = /\.svg(\?|$)/i.test(normalized);
  const mime = blob.type || "";
  const isSvg = /svg/i.test(mime) || pathLooksSvg;
  const isPngOrJpeg = /^image\/(png|jpe?g)$/i.test(mime);

  if (isSvg || (!isPngOrJpeg && mime)) {
    const png = await rasterizeToPngDataUrl(blob, { treatAsSvg: isSvg });
    if (png) return png;
  }

  if (isPngOrJpeg) {
    return blobToDataUrl(blob);
  }

  // type vazio / desconhecido: tenta data URL e rasteriza se for SVG
  const dataUrl = await blobToDataUrl(blob);
  if (!dataUrl) return null;
  if (pathLooksSvg || /^data:image\/svg\+xml/i.test(dataUrl)) {
    return (
      (await rasterizeToPngDataUrl(blob, { treatAsSvg: true })) ?? dataUrl
    );
  }
  return ensurePdfLogoDataUrl(dataUrl, mime);
}
