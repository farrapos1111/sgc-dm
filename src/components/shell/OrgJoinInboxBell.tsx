import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { countOpenOrgJoinInbox } from "@/lib/org-join-request.functions";
import {
  ORG_JOIN_INBOX_QUERY_KEY,
  useOrgJoinInboxRealtime,
} from "@/hooks/useOrgJoinInboxRealtime";
import { cn } from "@/lib/utils";

/** Assina realtime uma única vez (montado no AppShell). */
export function OrgJoinInboxRealtimeBridge({
  enabled,
}: {
  enabled: boolean;
}) {
  useOrgJoinInboxRealtime({ enabled, notifyOnInsert: true });
  return null;
}

/** Balão de solicitações de organização — só para admin total. */
export function OrgJoinInboxBell({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: [...ORG_JOIN_INBOX_QUERY_KEY, "count"],
    queryFn: () => countOpenOrgJoinInbox(),
    refetchInterval: 60_000,
  });

  const count = data?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-11 w-11 shrink-0 text-muted-foreground",
            className,
          )}
          aria-label={
            count > 0
              ? `${count} solicitações de organização abertas`
              : "Inbox de solicitações"
          }
          title="Solicitações de organização"
        >
          <Bell className="h-5 w-5" />
          {count > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4" />
            Solicitações
            {count > 0 ? (
              <Badge variant="destructive" className="ml-auto">
                {count} aberta{count === 1 ? "" : "s"}
              </Badge>
            ) : (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Nenhuma aberta
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pedidos de “Adicionar organização” (ao vivo).
          </p>
        </div>
        <div className="p-3">
          <Button asChild className="w-full" size="sm">
            <Link to="/configuracoes-globais/inbox">Abrir inbox</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
