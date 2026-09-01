/**
 * Envio transacional pluggável.
 * Com RESEND_API_KEY + EMAIL_FROM configurados, usa a API Resend.
 * Sem configuração, retorna skipped (não falha o fluxo chamador).
 */

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

export function appPublicOrigin() {
  return (
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
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
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
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
