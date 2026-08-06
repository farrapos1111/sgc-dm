import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Mantém comanda/recibo do ingresso sincronizados entre caixas. */
export function useTicketComandaRealtime(opts: {
  eventId: string;
  ticketId: string;
  chargeId?: string | null;
  enabled?: boolean;
}) {
  const { eventId, ticketId, chargeId = null, enabled = true } = opts;
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

    let channel = supabase
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
      );

    if (chargeId) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "member_charge_payments",
          filter: `charge_id=eq.${chargeId}`,
        },
        bump,
      );
    }

    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, eventId, ticketId, chargeId, qc]);

  return { live };
}
