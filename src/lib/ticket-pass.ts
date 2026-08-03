import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Dados canônicos do ingresso visual — usados na UI e futuros e-mails/PDF. */
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

/**
 * Payload pronto para um futuro envio por e-mail (Resend/etc.).
 * Hoje só estrutura os dados — a entrega ainda não está ligada.
 */
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

export const EVENT_ARTWORK_BUCKET = "event-artwork";

/** URL assinada temporária para a arte do ingresso (bucket privado). */
export function useEventArtwork(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(EVENT_ARTWORK_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
