import { formatBRL, formatDateTimeBR } from "@/lib/format";
import type { TicketPassData } from "@/lib/ticket-pass-data";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Cores da marca Templo Virtual (logo). */
export const TV_NAVY = "#072D5A";
export const TV_GOLD = "#CD991F";
export const CHAPTER_FALLBACK_ACCENT = "#9E1B32";

export type EmailBrand = {
  title: string;
  accent: string;
  headerBg: string;
  goldLine?: string | null;
  logoCid?: string | null;
  logoUrl?: string | null;
};

export function temploVirtualBrand(logoCid?: string | null): EmailBrand {
  return {
    title: "Templo Virtual",
    accent: TV_NAVY,
    headerBg: TV_NAVY,
    goldLine: TV_GOLD,
    logoCid: logoCid ?? null,
  };
}

export function contrastOn(hex: string): string {
  const n = hex.replace("#", "").trim();
  if (n.length !== 6) return "#ffffff";
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.62 ? TV_NAVY : "#ffffff";
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapBrandedHtml(opts: {
  brand: EmailBrand;
  heading: string;
  innerRows: string;
}): string {
  const fg = contrastOn(opts.brand.headerBg);
  const btnFg = contrastOn(opts.brand.accent);
  const logoSrc = opts.brand.logoCid
    ? `cid:${opts.brand.logoCid}`
    : opts.brand.logoUrl;
  const logo = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:8px;background:#ffffff;object-fit:contain;"/>`
    : "";
  const gold = opts.brand.goldLine
    ? `<tr><td style="height:4px;line-height:4px;font-size:0;background:${opts.brand.goldLine};">&nbsp;</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:${opts.brand.headerBg};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${logo ? `<td style="padding-right:14px;vertical-align:middle;">${logo}</td>` : ""}
                  <td style="vertical-align:middle;font-size:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${fg};">${escapeHtml(opts.brand.title)}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${gold}
          <tr>
            <td style="padding:28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="font-size:22px;font-weight:700;color:#18181b;">${escapeHtml(opts.heading)}</td></tr>
                ${opts.innerRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px;font-size:11px;color:#a1a1aa;">Templo Virtual</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function brandedButton(label: string, href: string, accent: string) {
  const fg = contrastOn(accent);
  return `<tr>
    <td style="padding-top:24px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:${accent};color:${fg};text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>`;
}

export function accountCreatedEmail(input: {
  fullName: string;
  loginUrl: string;
  setPasswordUrl: string;
  brand: EmailBrand;
}): { subject: string; text: string; html: string } {
  const name = input.fullName.trim() || "irmão";
  const subject = `Sua conta — ${input.brand.title}`;
  const text = [
    `Olá, ${name}.`,
    "",
    `Uma conta foi criada para você em ${input.brand.title}.`,
    "Defina sua senha neste link (ele expira em breve):",
    input.setPasswordUrl,
    "",
    `Depois, entre em ${input.loginUrl} com o e-mail desta mensagem.`,
    "",
    "Se você não esperava este e-mail, fale com o Mestre Conselheiro do capítulo.",
  ].join("\n");

  const html = wrapBrandedHtml({
    brand: input.brand,
    heading: "Sua conta foi criada",
    innerRows: `<tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#3f3f46;">Olá, ${escapeHtml(name)}. Uma conta foi criada para você. Defina sua senha pelo botão abaixo — o link expira em breve.</td></tr>
     ${brandedButton("Definir senha", input.setPasswordUrl, input.brand.accent)}
     <tr><td style="padding-top:20px;font-size:13px;line-height:1.5;color:#71717a;">Depois entre em <a href="${escapeHtml(input.loginUrl)}" style="color:${input.brand.accent};">${escapeHtml(input.loginUrl)}</a> com este e-mail. A senha não é enviada por e-mail.</td></tr>
     <tr><td style="padding-top:16px;font-size:12px;color:#a1a1aa;">Se você não esperava esta mensagem, fale com o Mestre Conselheiro do capítulo.</td></tr>`,
  });

  return { subject, text, html };
}

export function ticketPassEmail(
  pass: TicketPassData,
  brand: EmailBrand,
): { subject: string; text: string; html: string } {
  const subject = `Seu ingresso — ${pass.eventName}`;
  const when = formatDateTimeBR(pass.startsAt);
  const where = pass.location?.trim() || "Local a confirmar";
  const price = pass.pricePaid > 0 ? ` · ${formatBRL(pass.pricePaid)}` : "";
  const text = [
    `Olá, ${pass.buyerName}.`,
    "",
    `Segue o ingresso para ${pass.eventName} (${brand.title}).`,
    `Quando: ${when}`,
    `Onde: ${where}`,
    `Tipo: ${pass.ticketTypeName}${price}`,
    `Código: ${pass.qrCode}`,
    "",
    "O QR Code está anexado neste e-mail. Apresente-o na entrada.",
  ].join("\n");

  const html = wrapBrandedHtml({
    brand,
    heading: pass.eventName,
    innerRows: `<tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#3f3f46;">Olá, ${escapeHtml(pass.buyerName)}. Segue o seu ingresso.</td></tr>
     <tr><td style="padding-top:16px;font-size:14px;line-height:1.55;color:#3f3f46;">
       <strong>Quando:</strong> ${escapeHtml(when)}<br/>
       <strong>Onde:</strong> ${escapeHtml(where)}<br/>
       <strong>Participante:</strong> ${escapeHtml(pass.buyerName)}<br/>
       <strong>Tipo:</strong> ${escapeHtml(pass.ticketTypeName)}${escapeHtml(price)}<br/>
       <strong>Código:</strong> ${escapeHtml(pass.qrCode)}
     </td></tr>
     <tr><td style="padding-top:20px;text-align:center;">
       <img src="cid:ticket-qr" alt="QR do ingresso ${escapeHtml(pass.qrCode)}" width="220" height="220" style="width:220px;height:220px;background:#ffffff;border-radius:8px;"/>
     </td></tr>
     <tr><td style="padding-top:12px;font-size:12px;color:#a1a1aa;text-align:center;">Apresente o QR na entrada. O mesmo código também vai em anexo.</td></tr>`,
  });

  return { subject, text, html };
}
