import {
  CHAPTER_FALLBACK_ACCENT,
  type EmailBrand,
} from "@/lib/email-templates";
import type { SendEmailAttachment } from "@/lib/email";

const LOGO_BUCKET = "chapter-logos";
const LOGO_CID = "chapter-logo";
const SIGNATURE_CID = "email-signature";

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
  let chapter:
    | {
        name: string;
        number: string;
        primary_color: string | null;
        logo_url: string | null;
        email_signature_url: string | null;
      }
    | null = null;
  const withSignature = await supabaseAdmin
    .from("chapters")
    .select("name, number, primary_color, logo_url, email_signature_url")
    .eq("id", chapterId)
    .maybeSingle();
  if (!withSignature.error) {
    chapter = withSignature.data;
  } else {
    const base = await supabaseAdmin
      .from("chapters")
      .select("name, number, primary_color, logo_url")
      .eq("id", chapterId)
      .maybeSingle();
    chapter = base.data
      ? { ...base.data, email_signature_url: null }
      : null;
  }

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
    signatureCid: null,
    signatureUrl: null,
  };
  const attachments: SendEmailAttachment[] = [];

  async function attachImage(
    raw: string | null,
    slot: "logo" | "signature",
  ) {
    if (!raw) return;
    const cid = slot === "logo" ? LOGO_CID : SIGNATURE_CID;
    const filename =
      slot === "logo" ? "logo-capitulo.png" : "assinatura-email.png";
    try {
      if (/^https?:\/\//i.test(raw)) {
        const res = await fetch(raw, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const contentType = mimeFromPath(
          raw,
          res.headers.get("content-type") ?? "",
        );
        if (contentType.includes("svg")) {
          if (slot === "logo") brand.logoUrl = raw;
          else brand.signatureUrl = raw;
          return;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (slot === "logo") brand.logoCid = cid;
        else brand.signatureCid = cid;
        attachments.push({
          filename,
          content: bytesToBase64(buf),
          contentType,
          contentId: cid,
        });
        return;
      }

      const { data: blob, error } = await supabaseAdmin.storage
        .from(LOGO_BUCKET)
        .download(raw);
      if (error || !blob) return;

      const contentType = mimeFromPath(raw, blob.type || "");
      if (contentType.includes("svg")) {
        const signed = await supabaseAdmin.storage
          .from(LOGO_BUCKET)
          .createSignedUrl(raw, 60 * 60 * 24 * 30);
        const url = signed.data?.signedUrl ?? null;
        if (slot === "logo") brand.logoUrl = url;
        else brand.signatureUrl = url;
        return;
      }

      const buf = new Uint8Array(await blob.arrayBuffer());
      if (slot === "logo") brand.logoCid = cid;
      else brand.signatureCid = cid;
      attachments.push({
        filename,
        content: bytesToBase64(buf),
        contentType,
        contentId: cid,
      });
    } catch {
      // Sem a imagem: o e-mail segue sem ela.
    }
  }

  await attachImage(normalizeChapterLogoPath(chapter?.logo_url), "logo");
  await attachImage(
    normalizeChapterLogoPath(chapter?.email_signature_url),
    "signature",
  );

  return { brand, attachments };
}
