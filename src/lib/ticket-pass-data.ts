/** Dados canônicos do ingresso visual — usados na UI e nos e-mails. */
export type TicketPassData = {
  eventName: string;
  startsAt: string;
  location: string | null;
  buyerName: string;
  buyerEmail: string | null;
  ticketTypeName: string;
  qrCode: string;
  pricePaid: number;
  artworkUrl: string | null;
  primaryColor?: string | null;
};

export function ticketQrPayload(qrCode: string, buyerName: string) {
  return JSON.stringify({ n: qrCode, nome: buyerName });
}

export async function ticketQrDataUrl(qrCode: string, buyerName: string) {
  const QRCode = await import("qrcode");
  return QRCode.default.toDataURL(ticketQrPayload(qrCode, buyerName), {
    width: 280,
    margin: 1,
    color: { dark: "#111111", light: "#ffffff" },
  });
}

export async function ticketQrPngBase64(qrCode: string, buyerName: string) {
  const dataUrl = await ticketQrDataUrl(qrCode, buyerName);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function buildTicketPassData(input: {
  event: {
    name: string;
    starts_at: string;
    location: string | null;
  };
  ticket: {
    buyer_name: string;
    buyer_email?: string | null;
    qr_code: string;
    price_paid?: number | string | null;
  };
  ticketTypeName?: string | null;
  artworkUrl?: string | null;
  primaryColor?: string | null;
}): TicketPassData {
  return {
    eventName: input.event.name,
    startsAt: input.event.starts_at,
    location: input.event.location,
    buyerName: input.ticket.buyer_name,
    buyerEmail: input.ticket.buyer_email ?? null,
    ticketTypeName: input.ticketTypeName?.trim() || "Avulso",
    qrCode: input.ticket.qr_code,
    pricePaid: Number(input.ticket.price_paid ?? 0),
    artworkUrl: input.artworkUrl ?? null,
    primaryColor: input.primaryColor ?? null,
  };
}

export type TicketEmailPayload = {
  to: string;
  subject: string;
  pass: TicketPassData;
};

export function buildTicketEmailPayload(
  pass: TicketPassData,
): TicketEmailPayload | null {
  const to = pass.buyerEmail?.trim();
  if (!to) return null;
  return {
    to,
    subject: `Seu ingresso — ${pass.eventName}`,
    pass,
  };
}
