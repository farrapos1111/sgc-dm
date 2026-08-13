import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Mantém as telas de auditoria sincronizadas via Realtime do banco. */
export function useAuditLogRealtime(opts: {
  chapterId: string;
  enabled?: boolean;
}) {
  const { chapterId, enabled = true } = opts;
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !chapterId) return;

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["chapter-audit", chapterId] });
        void qc.invalidateQueries({ queryKey: ["event-comanda-audit"] });
      }, 150);
    };

    const channel = supabase
      .channel(`audit-logs-${chapterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "audit_logs",
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
  }, [chapterId, enabled, qc]);

  return { live };
}
