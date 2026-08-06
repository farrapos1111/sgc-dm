import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Mantém comanda/recibo do ingresso sincronizados entre caixas. */
export function useTicketComandaRealtime(opts: {
  eventId: string;
  ticketId: string;
  enabled?: boolean;
}) {
  const { eventId, ticketId, enabled = true } = opts;
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !eventId || !ticketId) return;

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void qc.invalidateQueries({
          queryKey: ["event-ticket-items", eventId],
        });
        void qc.invalidateQueries({
          queryKey: ["comanda-checkout", eventId],
        });
        void qc.invalidateQueries({ queryKey: ["event", eventId] });
        void qc.invalidateQueries({ queryKey: ["member-charges"] });
      }, 150);
    };

    const channel = supabase
      .channel(`comanda-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_ticket_items",
          filter: `ticket_id=eq.${ticketId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `id=eq.${ticketId}`,
        },
        bump,
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, eventId, ticketId, qc]);

  return { live };
}
