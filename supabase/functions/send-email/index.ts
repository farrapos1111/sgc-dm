/**
 * Send Email Hook do Auth → Resend.
 *
 * Cole este arquivo no dashboard (Edge Functions → send-email).
 * Verify JWT = OFF. A Auth assina com SEND_EMAIL_HOOK_SECRET.
 * Sem dependências npm (o bundler do dashboard não resolve standardwebhooks).
 *
 * Secrets: RESEND_API_KEY, EMAIL_FROM, SEND_EMAIL_HOOK_SECRET
 * (SEND_EMAIL_HOOK_SECRET no formato v1,whsec_… gerado em
 * Authentication → Hooks → Send Email).
 *
 * Não faça deploy desta function a partir do MCP/CLI deste workspace.
 */

type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication"
  | string;

type HookPayload = {
  user: {
    email?: string;
    user_metadata?: { full_name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    old_email?: string;
  };
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TV_NAVY = "#072D5A";
const TV_GOLD = "#CD991F";
const TV_LOGO_CID = "tv-logo";

function verifyUrl(
  supabaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string,
) {
  const u = new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`);
  u.searchParams.set("token", tokenHash);
  u.searchParams.set("type", type);
  if (redirectTo) u.searchParams.set("redirect_to", redirectTo);
  return u.toString();
}

function copyFor(action: EmailActionType): {
  subject: string;
  heading: string;
  intro: string;
  cta: string;
  codeHint: string;
} {
  switch (action) {
    case "recovery":
      return {
        subject: "Redefinir senha — Templo Virtual",
        heading: "Redefinir senha",
        intro:
          "Recebemos um pedido para redefinir a senha da sua conta no Templo Virtual. Use o botão abaixo. O link expira em breve.",
        cta: "Definir nova senha",
        codeHint: "Ou informe este código na tela de recuperação:",
      };
    case "signup":
      return {
        subject: "Confirme seu cadastro — Templo Virtual",
        heading: "Confirme seu e-mail",
        intro:
          "Para concluir o cadastro no Templo Virtual, confirme seu e-mail.",
        cta: "Confirmar e-mail",
        codeHint: "Ou informe este código de confirmação:",
      };
    case "invite":
      return {
        subject: "Convite para o Templo Virtual",
        heading: "Você foi convidado",
        intro:
          "Aceite o convite para criar o acesso à sua conta no Templo Virtual.",
        cta: "Aceitar convite",
        codeHint: "Ou informe este código:",
      };
    case "magiclink":
      return {
        subject: "Link de acesso — Templo Virtual",
        heading: "Entrar no Templo Virtual",
        intro: "Use o botão abaixo para entrar. O link é de uso único.",
        cta: "Entrar",
        codeHint: "Ou informe este código de acesso:",
      };
    case "email_change":
      return {
        subject: "Confirme o novo e-mail — Templo Virtual",
        heading: "Confirmar novo e-mail",
        intro:
          "Confirme a alteração de e-mail da sua conta no Templo Virtual.",
        cta: "Confirmar e-mail",
        codeHint: "Ou informe este código:",
      };
    case "reauthentication":
      return {
        subject: "Confirme esta ação — Templo Virtual",
        heading: "Confirmar ação",
        intro:
          "Para concluir uma ação sensível na sua conta, confirme com o botão abaixo.",
        cta: "Confirmar",
        codeHint: "Ou informe este código:",
      };
    default:
      return {
        subject: "Templo Virtual",
        heading: "Confirme esta ação",
        intro: "Use o botão abaixo para continuar no Templo Virtual.",
        cta: "Continuar",
        codeHint: "Ou informe este código:",
      };
  }
}

function renderEmail(opts: {
  heading: string;
  intro: string;
  cta: string;
  codeHint: string;
  actionUrl: string;
  token: string;
  extraHtml?: string;
  extraText?: string;
  hasLogo: boolean;
}) {
  const logo = opts.hasLogo
    ? `<td style="padding-right:14px;vertical-align:middle;"><img src="cid:${TV_LOGO_CID}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:8px;background:#ffffff;object-fit:contain;"/></td>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:${TV_NAVY};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${logo}
                  <td style="vertical-align:middle;font-size:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#ffffff;">Templo Virtual</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${TV_GOLD};">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="font-size:22px;font-weight:700;color:#18181b;">${opts.heading}</td></tr>
                <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#3f3f46;">${opts.intro}</td></tr>
                <tr>
                  <td style="padding-top:24px;">
                    <a href="${opts.actionUrl}" style="display:inline-block;background:${TV_NAVY};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">${opts.cta}</a>
                  </td>
                </tr>
                ${opts.extraHtml ?? ""}
                <tr><td style="padding-top:24px;font-size:13px;color:#71717a;">${opts.codeHint}</td></tr>
                <tr><td style="padding-top:8px;font-family:ui-monospace,monospace;font-size:18px;letter-spacing:.12em;background:#f4f4f5;border-radius:8px;padding:12px 16px;color:#18181b;">${opts.token}</td></tr>
                <tr><td style="padding-top:24px;font-size:12px;line-height:1.5;color:#a1a1aa;">Se você não pediu este e-mail, pode ignorá-lo. O link expira automaticamente.</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Templo Virtual — ${opts.heading}`,
    "",
    opts.intro,
    "",
    `${opts.cta}: ${opts.actionUrl}`,
    opts.extraText ?? "",
    "",
    `${opts.codeHint} ${opts.token}`,
    "",
    "Se você não pediu este e-mail, ignore. O link expira automaticamente.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { html, text };
}

async function loadTvLogoPng(): Promise<string | null> {
  const origin = (
    Deno.env.get("APP_URL") ||
    Deno.env.get("SITE_URL") ||
    ""
  ).replace(/\/$/, "");
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}/logos/templo-virtual.png`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return b64encode(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Standard Webhooks (HMAC-SHA256) — sem pacote npm. */
function headerOf(headers: Record<string, string>, name: string) {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return v;
  }
  return undefined;
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64encode(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  if (ae.length !== be.length) return false;
  let diff = 0;
  for (let i = 0; i < ae.length; i++) diff |= ae[i] ^ be[i];
  return diff === 0;
}

function hookSecretBytes(raw: string): string {
  let secret = raw.trim();
  if (secret.startsWith("v1,")) secret = secret.slice(3);
  if (secret.startsWith("whsec_")) secret = secret.slice("whsec_".length);
  return secret;
}

async function verifyStandardWebhook(
  payload: string,
  headers: Record<string, string>,
  secretB64: string,
): Promise<HookPayload> {
  const msgId = headerOf(headers, "webhook-id");
  const msgTimestamp = headerOf(headers, "webhook-timestamp");
  const msgSignature = headerOf(headers, "webhook-signature");
  if (!msgId || !msgTimestamp || !msgSignature) {
    throw new Error("Cabeçalhos de webhook ausentes");
  }

  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts)) throw new Error("Timestamp inválido");
  if (Math.abs(Date.now() / 1000 - ts) > 5 * 60) {
    throw new Error("Timestamp fora da tolerância");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    b64decode(secretB64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${msgId}.${msgTimestamp}.${payload}`),
  );
  const expected = b64encode(signed);
  const matches = msgSignature.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    return version === "v1" && !!signature && timingSafeEqual(signature, expected);
  });
  if (!matches) throw new Error("Assinatura inválida");
  return JSON.parse(payload) as HookPayload;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("EMAIL_FROM")?.trim();
  const hookSecret = hookSecretBytes(
    Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "",
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  if (!apiKey || !from || !hookSecret) {
    return Response.json(
      {
        error: {
          http_code: 500,
          message:
            "RESEND_API_KEY, EMAIL_FROM ou SEND_EMAIL_HOOK_SECRET ausentes",
        },
      },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let event: HookPayload;
  try {
    event = await verifyStandardWebhook(payload, headers, hookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assinatura inválida";
    return Response.json(
      { error: { http_code: 401, message } },
      { status: 401 },
    );
  }

  const to = event.user.email?.trim();
  if (!to) {
    return Response.json(
      { error: { http_code: 400, message: "Usuário sem e-mail" } },
      { status: 400 },
    );
  }

  const { email_data: data } = event;
  const copy = copyFor(data.email_action_type);
  const actionUrl = verifyUrl(
    supabaseUrl,
    data.token_hash,
    data.email_action_type,
    data.redirect_to,
  );

  let extraHtml = "";
  let extraText = "";
  if (data.token_hash_new) {
    const secondUrl = verifyUrl(
      supabaseUrl,
      data.token_hash_new,
      "email_change",
      data.redirect_to,
    );
    extraHtml = `<tr><td style="padding-top:16px;font-size:14px;color:#3f3f46;">Confirmação do novo endereço:</td></tr>
      <tr><td style="padding-top:8px;"><a href="${secondUrl}" style="color:#18181b;">${secondUrl}</a></td></tr>`;
    extraText = `\nConfirmação do novo endereço: ${secondUrl}`;
  }

  const logoPng = await loadTvLogoPng();
  const { html, text } = renderEmail({
    heading: copy.heading,
    intro: copy.intro,
    cta: copy.cta,
    codeHint: copy.codeHint,
    actionUrl,
    token: data.token,
    extraHtml,
    extraText,
    hasLogo: Boolean(logoPng),
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: copy.subject,
        html,
        text,
        ...(logoPng
          ? {
              attachments: [
                {
                  filename: "templo-virtual.png",
                  content: logoPng,
                  content_type: "image/png",
                  content_id: TV_LOGO_CID,
                },
              ],
            }
          : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      throw new Error(body.message || body.name || `Resend HTTP ${res.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar";
    return Response.json(
      { error: { http_code: 500, message } },
      { status: 500 },
    );
  }

  return Response.json({});
});
