import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Sincroniza a lista de check-ins do capítulo entre dispositivos. */
export function useEventCheckinRealtime(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["checkin-tickets"] });
        void qc.invalidateQueries({ queryKey: ["checkins"] });
      }, 150);
    };

    const channel = supabase
      .channel("event-checkins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkins" },
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
  }, [enabled, qc]);

  return { live };
}
