import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Sincroniza votos e status da sindicância em votação. */
export function useSindicanciaVotingRealtime(opts: {
  calendarEventId: string;
  enabled?: boolean;
}) {
  const { calendarEventId, enabled = true } = opts;
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !calendarEventId) return;

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void qc.invalidateQueries({
          queryKey: ["sindicancia-voting", calendarEventId],
        });
        void qc.invalidateQueries({ queryKey: ["open-sindicancias"] });
        void qc.invalidateQueries({ queryKey: ["sindicancias"] });
      }, 150);
    };

    const channel = supabase
      .channel(`sindicancia-voting-${calendarEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sindicancia_votes",
          filter: `calendar_event_id=eq.${calendarEventId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sindicancia_details",
          filter: `calendar_event_id=eq.${calendarEventId}`,
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
  }, [calendarEventId, enabled, qc]);

  return { live };
}
