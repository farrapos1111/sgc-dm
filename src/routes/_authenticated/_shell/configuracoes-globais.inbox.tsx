import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import {
  ORG_JOIN_TYPE_LABELS,
  listOrgJoinInbox,
  setOrgJoinInboxStatus,
  type OrgJoinInboxItem,
} from "@/lib/org-join-request.functions";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { ORG_JOIN_INBOX_QUERY_KEY } from "@/hooks/useOrgJoinInboxRealtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/_shell/configuracoes-globais/inbox",
)({
  head: () => ({
    meta: [
      { title: "Inbox de solicitações — Templo Virtual" },
      {
        name: "description",
        content:
          "Solicitações de inclusão de organizações no Templo Virtual (Administrador Total).",
      },
    ],
  }),
  component: OrgJoinInboxPage,
});

type TabFilter = "open" | "archived";

function typeLabel(item: OrgJoinInboxItem): string {
  if (item.org_type === "outro") {
    return item.org_type_other?.trim()
      ? `Outro (${item.org_type_other.trim()})`
      : "Outro";
  }
  return ORG_JOIN_TYPE_LABELS[item.org_type] ?? item.org_type;
}

function FormField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
        {value?.trim() ? value : "—"}
      </div>
    </div>
  );
}

function RequestFormCard({
  item,
  onArchive,
  onRestore,
  busy,
}: {
  item: OrgJoinInboxItem;
  onArchive: () => void;
  onRestore: () => void;
  busy: boolean;
}) {
  const open = item.status === "open";
  return (
    <Card className="space-y-4 rounded-[12px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold">{item.name_number}</div>
          <div className="text-sm text-muted-foreground">
            {typeLabel(item)} · recebida em {formatDateTimeBR(item.created_at)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={open ? "destructive" : "secondary"}>
            {open ? "Aberta" : "Arquivada"}
          </Badge>
          {item.email_status === "skipped" ? (
            <Badge variant="outline">E-mail não enviado</Badge>
          ) : item.email_status === "sent" ? (
            <Badge variant="outline">E-mail enviado</Badge>
          ) : item.email_status === "failed" ? (
            <Badge variant="outline">Falha no e-mail</Badge>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border border-border/70 bg-muted/30 p-4",
          "grid gap-4 sm:grid-cols-2",
        )}
      >
        <FormField label="Tipo de organização" value={typeLabel(item)} />
        <FormField label="Potência" value={item.potencia_label} />
        <FormField label="Nome / Número" value={item.name_number} />
        <FormField
          label="Data de fundação/instalação"
          value={formatDateBR(item.founded_on)}
        />
        <FormField
          label="Membros ativos"
          value={item.active_members_band}
        />
        <FormField
          label="Loja / capítulo patrocinador"
          value={item.sponsoring_lodge}
        />
        <div className="sm:col-span-2">
          <FormField label="Endereço completo" value={item.full_address} />
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Responsável
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nome" value={item.responsible_name} />
          <FormField label="Cargo" value={item.responsible_role} />
          <FormField label="Telefone" value={item.responsible_phone} />
          <FormField label="E-mail" value={item.responsible_email} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {open ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onArchive}
          >
            <Archive className="mr-1.5 h-4 w-4" />
            Arquivar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onRestore}
          >
            <ArchiveRestore className="mr-1.5 h-4 w-4" />
            Reabrir
          </Button>
        )}
      </div>
    </Card>
  );
}

function OrgJoinInboxPage() {
  const { isAdminTotal } = useChapterAccess();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabFilter>("open");

  const listQ = useQuery({
    queryKey: [...ORG_JOIN_INBOX_QUERY_KEY, "list", tab],
    enabled: isAdminTotal,
    queryFn: () => listOrgJoinInbox({ data: { status: tab } }),
  });

  const mutateStatus = useMutation({
    mutationFn: (input: { id: string; status: "open" | "archived" }) =>
      setOrgJoinInboxStatus({ data: input }),
    onSuccess: async (_r, vars) => {
      toast.success(
        vars.status === "archived"
          ? "Solicitação arquivada"
          : "Solicitação reaberta",
      );
      await qc.invalidateQueries({ queryKey: ORG_JOIN_INBOX_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = listQ.data?.items ?? [];
  const subtitle = useMemo(() => {
    if (tab === "open") return "Pedidos abertos — formulário preenchido pelo solicitante";
    return "Pedidos arquivados (histórico)";
  }, [tab]);

  if (!isAdminTotal) {
    return (
      <EmptyState
        title="Sem permissão"
        description="Apenas Administrador Total pode ver a inbox de solicitações."
      />
    );
  }

  if (listQ.isPending) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Inbox de solicitações"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Inbox className="h-4 w-4" />
            Ao vivo
          </div>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabFilter)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="open">Abertas</TabsTrigger>
          <TabsTrigger value="archived">Arquivadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {listQ.isError ? (
        <EmptyState
          title="Não foi possível carregar"
          description={
            listQ.error instanceof Error
              ? listQ.error.message
              : "Tente novamente."
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            tab === "open"
              ? "Nenhuma solicitação aberta"
              : "Nenhuma solicitação arquivada"
          }
          description={
            tab === "open"
              ? "Quando alguém preencher “Quero Adicionar à Minha Organização”, o pedido aparece aqui."
              : "Arquive pedidos depois de tratá-los; eles ficam salvos nesta aba."
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <RequestFormCard
              key={item.id}
              item={item}
              busy={mutateStatus.isPending}
              onArchive={() =>
                mutateStatus.mutate({ id: item.id, status: "archived" })
              }
              onRestore={() =>
                mutateStatus.mutate({ id: item.id, status: "open" })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
