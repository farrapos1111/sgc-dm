import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = ["org-join-inbox"] as const;

/** Realtime da inbox de solicitações de organização (admin total). */
export function useOrgJoinInboxRealtime(opts: {
  enabled?: boolean;
  /** Toast + link quando chega INSERT novo. */
  notifyOnInsert?: boolean;
}) {
  const { enabled = true, notifyOnInsert = true } = opts;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: QUERY_KEY });
      }, 150);
    };

    const channel = supabase
      .channel("org-join-inbox")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "org_join_requests",
        },
        (payload) => {
          bump();
          if (
            notifyOnInsert &&
            payload.eventType === "INSERT" &&
            payload.new &&
            typeof payload.new === "object"
          ) {
            const row = payload.new as {
              name_number?: string;
              responsible_name?: string;
            };
            const title = row.name_number?.trim() || "Nova solicitação";
            toast.message("Nova solicitação de organização", {
              description: row.responsible_name
                ? `${title} — ${row.responsible_name}`
                : title,
              action: {
                label: "Abrir inbox",
                onClick: () => {
                  void navigate({ to: "/configuracoes-globais/inbox" });
                },
              },
              duration: 12_000,
            });
          }
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, navigate, notifyOnInsert, qc]);

  return { live };
}

export const ORG_JOIN_INBOX_QUERY_KEY = QUERY_KEY;
