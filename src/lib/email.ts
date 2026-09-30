/**
 * Envio transacional pluggável.
 * Com RESEND_API_KEY + EMAIL_FROM configurados, usa a API Resend.
 * Sem configuração, retorna skipped (não falha o fluxo chamador).
 */

import { getRequest } from "@tanstack/react-start/server";
import { TV_EMAIL_SIGNATURE_CID } from "@/lib/email-templates";
import { TEMPLO_VIRTUAL_EMAIL_SIGNATURE_PNG } from "@/lib/email-signature-asset";

export type SendEmailAttachment = {
  filename: string;
  /** Conteúdo em base64 (sem prefixo data:). */
  content: string;
  contentType?: string;
  /** Para <img src="cid:…"> no HTML. */
  contentId?: string;
};

export type SendEmailInput = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: SendEmailAttachment[];
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

export type EmailDeliveryStatus = "sent" | "skipped" | "failed";

function isLocalHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h === "::1" ||
    h.endsWith(".localhost")
  );
}

function envPublicOrigin(): string | null {
  const raw = (
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_APP_URL : "") ||
    ""
  )
    .toString()
    .trim()
    .replace(/\/$/, "");
  return raw || null;
}

/** Origem pública da requisição atual (host do Worker), se houver. */
function requestPublicOrigin(): string | null {
  try {
    const req = getRequest();
    const url = new URL(req.url);
    if (!isLocalHostname(url.hostname)) return url.origin;

    const forwardedHost = req.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const host = forwardedHost || req.headers.get("host")?.trim() || "";
    const hostname = host.split(":")[0] ?? "";
    if (host && !isLocalHostname(hostname)) {
      const proto =
        req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${proto}://${host}`;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origem pública dos links em e-mail.
 * Em produção usa o host da requisição (evita localhost quando APP_URL não está no Worker).
 */
export function appPublicOrigin() {
  const fromRequest = requestPublicOrigin();
  if (fromRequest) {
    try {
      if (!isLocalHostname(new URL(fromRequest).hostname)) {
        return fromRequest.replace(/\/$/, "");
      }
    } catch {
      /* segue para env */
    }
  }

  const fromEnv = envPublicOrigin();
  if (fromEnv) return fromEnv;
  if (fromRequest) return fromRequest.replace(/\/$/, "");
  return "http://localhost:8080";
}

export function summarizeEmailResult(result: SendEmailResult): {
  status: EmailDeliveryStatus;
  error: string | null;
} {
  if (result.ok) return { status: "sent", error: null };
  if (result.skipped) return { status: "skipped", error: result.reason };
  return { status: "failed", error: result.error };
}

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to = input.to.map((e) => e.trim()).filter(Boolean);

  if (!to.length) {
    return { ok: false, skipped: true, reason: "Nenhum destinatário" };
  }
  if (!apiKey || !from) {
    return {
      ok: false,
      skipped: true,
      reason: "RESEND_API_KEY / EMAIL_FROM não configurados",
    };
  }

  const attachments = [...(input.attachments ?? [])];
  const wantsPlatformSignature = input.html?.includes(
    `cid:${TV_EMAIL_SIGNATURE_CID}`,
  );
  if (
    wantsPlatformSignature &&
    !attachments.some((a) => a.contentId === TV_EMAIL_SIGNATURE_CID)
  ) {
    attachments.push({
      filename: "assinatura-templo-virtual.png",
      content: TEMPLO_VIRTUAL_EMAIL_SIGNATURE_PNG,
      contentType: "image/png",
      contentId: TV_EMAIL_SIGNATURE_CID,
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(attachments.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentType ? { content_type: a.contentType } : {}),
                ...(a.contentId ? { content_id: a.contentId } : {}),
              })),
            }
          : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        skipped: false,
        error: body.message || body.name || `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    return {
      ok: false,
      skipped: false,
      error: e instanceof Error ? e.message : "Falha ao enviar e-mail",
    };
  }
}
