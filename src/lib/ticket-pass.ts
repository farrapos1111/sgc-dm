import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export {
  buildTicketEmailPayload,
  buildTicketPassData,
  ticketQrDataUrl,
  ticketQrPayload,
  ticketQrPngBase64,
  type TicketEmailPayload,
  type TicketPassData,
} from "@/lib/ticket-pass-data";

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
