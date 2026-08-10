/**
 * Envio transacional pluggável.
 * Com RESEND_API_KEY + EMAIL_FROM configurados, usa a API Resend.
 * Sem configuração, retorna skipped (não falha o fluxo chamador).
 */

export type SendEmailInput = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

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
