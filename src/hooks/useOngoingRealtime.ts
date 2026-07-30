import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém a tela de sessão em andamento sincronizada entre clientes
 * (presenças, ata e assinaturas) via Supabase Realtime.
 */
export function useOngoingRealtime(opts: {
  calendarEventId: string;
  chapterId: string;
  enabled?: boolean;
}) {
  const { calendarEventId, chapterId, enabled = true } = opts;
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !calendarEventId || !chapterId) return;

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["ongoing", calendarEventId] });
        void qc.invalidateQueries({ queryKey: ["minute-approvals"] });
      }, 150);
    };

    const channel = supabase
      .channel(`ongoing-${calendarEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `calendar_event_id=eq.${calendarEventId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_minutes",
          filter: `calendar_event_id=eq.${calendarEventId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "minute_approvals",
          filter: `chapter_id=eq.${chapterId}`,
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
  }, [calendarEventId, chapterId, enabled, qc]);

  return { live };
}
