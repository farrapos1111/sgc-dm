import {
  CHAPTER_FALLBACK_ACCENT,
  type EmailBrand,
} from "@/lib/email-templates";
import type { SendEmailAttachment } from "@/lib/email";

const LOGO_BUCKET = "chapter-logos";
const LOGO_CID = "chapter-logo";

function normalizeChapterLogoPath(
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

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mimeFromPath(path: string, blobType: string): string {
  if (blobType && blobType !== "application/octet-stream") return blobType;
  if (/\.jpe?g(\?|$)/i.test(path)) return "image/jpeg";
  if (/\.png(\?|$)/i.test(path)) return "image/png";
  if (/\.gif(\?|$)/i.test(path)) return "image/gif";
  if (/\.webp(\?|$)/i.test(path)) return "image/webp";
  if (/\.svg(\?|$)/i.test(path)) return "image/svg+xml";
  return blobType || "image/png";
}

export type ChapterEmailAssets = {
  brand: EmailBrand;
  attachments: SendEmailAttachment[];
};

export async function loadChapterEmailAssets(
  chapterId: string,
): Promise<ChapterEmailAssets> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { data: chapter } = await supabaseAdmin
    .from("chapters")
    .select("name, number, primary_color, logo_url")
    .eq("id", chapterId)
    .maybeSingle();

  const title = chapter
    ? `${chapter.name} nº ${chapter.number}`
    : "Templo Virtual";
  const accent =
    (chapter?.primary_color ?? "").trim() || CHAPTER_FALLBACK_ACCENT;

  const brand: EmailBrand = {
    title,
    accent,
    headerBg: accent,
    goldLine: null,
    logoCid: null,
    logoUrl: null,
  };
  const attachments: SendEmailAttachment[] = [];

  const rawPath = normalizeChapterLogoPath(chapter?.logo_url);
  if (!rawPath) return { brand, attachments };

  try {
    if (/^https?:\/\//i.test(rawPath)) {
      const res = await fetch(rawPath, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { brand, attachments };
      const buf = new Uint8Array(await res.arrayBuffer());
      const contentType = mimeFromPath(
        rawPath,
        res.headers.get("content-type") ?? "",
      );
      if (contentType.includes("svg")) {
        brand.logoUrl = rawPath;
        return { brand, attachments };
      }
      brand.logoCid = LOGO_CID;
      attachments.push({
        filename: "logo-capitulo.png",
        content: bytesToBase64(buf),
        contentType,
        contentId: LOGO_CID,
      });
      return { brand, attachments };
    }

    const { data: blob, error } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .download(rawPath);
    if (error || !blob) return { brand, attachments };

    const contentType = mimeFromPath(rawPath, blob.type || "");
    if (contentType.includes("svg")) {
      const signed = await supabaseAdmin.storage
        .from(LOGO_BUCKET)
        .createSignedUrl(rawPath, 60 * 60 * 24 * 30);
      brand.logoUrl = signed.data?.signedUrl ?? null;
      return { brand, attachments };
    }

    const buf = new Uint8Array(await blob.arrayBuffer());
    brand.logoCid = LOGO_CID;
    attachments.push({
      filename: "logo-capitulo.png",
      content: bytesToBase64(buf),
      contentType,
      contentId: LOGO_CID,
    });
  } catch {
    // Sem logo: segue só com a cor do capítulo.
  }

  return { brand, attachments };
}
