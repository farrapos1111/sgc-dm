import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, FileText, Gavel, Link2, ListOrdered, Mail, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTimeBR } from "@/lib/format";
import {
  fromAppTzDateTimeLocal,
  toAppTzDateTimeLocal,
  todayYmd,
} from "@/lib/timezone";
import {
  createSindicancia,
  deleteSindicancia,
  ensureSindicanciaParticipationLink,
  listFiles,
  listSindicancias,
  listSindicanciaReminderRecipients,
  revokeSindicanciaParticipationLink,
  sendSindicanciaReminder,
  updateSindicancia,
  type InvestigationFileRow,
  type SindicanciaListItem,
  type SindicanciaReminderRecipient,
  type SindicanciaReminderRole,
} from "@/lib/investigations.functions";
import { resolveCalendarChaveText } from "@/lib/resolve-calendar-chave";
import { listMembers } from "@/lib/members.functions";
import {
  SindicanciaAtaForm,
  type AtaFormMode,
} from "@/components/investigations/SindicanciaAtaForm";
import { MemberSearchSelect } from "@/components/investigations/MemberSearchSelect";
import {
  STATUS_LABELS,
  type InvestigationStatus,
} from "@/lib/investigation-labels";

function isInvestigationStatus(v: string): v is InvestigationStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, v);
}

function ReminderRecipientList({
  nominee,
  loading,
  people,
  selected,
  onToggle,
  onToggleAll,
}: {
  nominee: string;
  loading: boolean;
  people: SindicanciaReminderRecipient[];
  selected: Set<SindicanciaReminderRole>;
  onToggle: (role: SindicanciaReminderRole, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const withEmail = people.filter((person) => person.hasEmail);
  const allChecked =
    withEmail.length > 0 &&
    withEmail.every((person) => selected.has(person.role));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="mb-3 text-sm text-muted-foreground">
        Marque quem recebe o lembrete de {nominee}. Quem não tem e-mail fica
        de fora.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando destinatários…</p>
      ) : (
        <>
          <label className="flex items-center gap-3 border-b px-1 py-2 text-sm font-medium">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(value) => onToggleAll(value === true)}
              disabled={withEmail.length === 0}
              aria-label="Selecionar todos com e-mail"
            />
            Selecionar todos com e-mail
          </label>
          <ul>
            {people.map((person) => (
              <li key={person.role}>
                <label
                  className={`flex items-start gap-3 px-1 py-2.5 text-sm ${
                    person.hasEmail
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(person.role)}
                    disabled={!person.hasEmail}
                    onCheckedChange={(value) =>
                      onToggle(person.role, value === true)
                    }
                    aria-label={`${person.name} — ${person.label}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {person.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.label}
                      {person.hasEmail ? "" : " · Sem e-mail"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type SortKey = "data_desc" | "data_asc" | "nome_asc" | "nome_desc" | "status";

export const Route = createFileRoute(
  "/_authenticated/_shell/sindicancias/sindicarias",
)({
  head: () => ({
    meta: [
      { title: "Sindicâncias — Templo Virtual" },
      {
        name: "description",
        content: "Agenda e acompanhamento das sindicâncias do capítulo.",
      },
    ],
  }),
  component: SindicariasPage,
});

function SindicariasPage() {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const { canScreen } = useChapterAccess();
  const writable =
    canScreen("sindicancias", "edit") || canManage("sindicancias");
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SindicanciaListItem | null>(null);
  const [editRoles, setEditRoles] = useState({
    senior_member_id: null as string | null,
    investigator_member_id: null as string | null,
    clerk_member_id: null as string | null,
  });
  const [ataRow, setAtaRow] = useState<SindicanciaListItem | null>(null);
  const [ataMode, setAtaMode] = useState<AtaFormMode>("ata");
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindEventId, setRemindEventId] = useState<string | null>(null);
  const [remindNominee, setRemindNominee] = useState("");
  const [remindPeople, setRemindPeople] = useState<SindicanciaReminderRecipient[]>(
    [],
  );
  const [remindSelected, setRemindSelected] = useState<Set<SindicanciaReminderRole>>(
    new Set(),
  );
  const [remindLoading, setRemindLoading] = useState(false);

  function openAtaMobile(row: SindicanciaListItem, mode: AtaFormMode) {
    const resolved: AtaFormMode =
      mode === "ata" && row.status === "votacao_comissao" ? "votacao" : mode;
    setAtaMode(resolved);
    setAtaRow(row);
  }

  function ataSearchMode(
    row: SindicanciaListItem,
    mode: AtaFormMode,
  ): AtaFormMode {
    return mode === "ata" && row.status === "votacao_comissao"
      ? "votacao"
      : mode;
  }
  const [statusFilter, setStatusFilter] = useState("todas");
  const [sort, setSort] = useState<SortKey>("data_desc");
  const [form, setForm] = useState({
    title: "",
    nominee_name: "",
    file_id: "",
    start_at: toAppTzDateTimeLocal(
      fromAppTzDateTimeLocal(`${todayYmd()}T19:00`),
    ),
    location: "",
    senior_member_id: null as string | null,
    investigator_member_id: null as string | null,
    clerk_member_id: null as string | null,
    opinion: "",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sindicancias", active?.chapter_id],
    enabled: !!active,
    queryFn: (): Promise<SindicanciaListItem[]> =>
      listSindicancias({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: files = [] } = useQuery({
    queryKey: ["investigation-files", active?.chapter_id],
    enabled: !!active && open,
    queryFn: (): Promise<InvestigationFileRow[]> =>
      listFiles({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-sindicancia", active?.chapter_id],
    enabled: !!active && (open || !!editing),
    queryFn: () => listMembers({ data: { chapterId: active!.chapter_id } }),
  });

  const memberOpts = (
    members as Array<{ id: string; full_name: string; kind?: string | null }>
  ).map((m) => ({ id: m.id, full_name: m.full_name, kind: m.kind }));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...rows];
    if (statusFilter !== "todas") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.nominee_name,
          r.event?.title,
          r.event?.location,
          r.senior?.full_name,
          r.senior_text,
          r.investigator?.full_name,
          r.investigator_text,
          r.clerk?.full_name,
          r.clerk_text,
          STATUS_LABELS[r.status],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      const ta = a.event?.start_at ? +new Date(a.event.start_at) : 0;
      const tb = b.event?.start_at ? +new Date(b.event.start_at) : 0;
      const na = (a.nominee_name || "").localeCompare(
        b.nominee_name || "",
        "pt-BR",
      );
      if (sort === "data_asc") return ta - tb;
      if (sort === "data_desc") return tb - ta;
      if (sort === "nome_asc") return na;
      if (sort === "nome_desc") return -na;
      if (sort === "status") {
        return (STATUS_LABELS[a.status] ?? a.status).localeCompare(
          STATUS_LABELS[b.status] ?? b.status,
          "pt-BR",
        );
      }
      return tb - ta;
    });
    return list;
  }, [rows, search, statusFilter, sort]);

  const chaveIds = useMemo(
    () => visible.map((r) => r.calendar_event_id).join(","),
    [visible],
  );

  const { data: chaveById = {} } = useQuery({
    queryKey: ["sindicancias-chave-texts", active?.chapter_id, chaveIds],
    enabled: !!active && visible.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        visible.map(async (r) => {
          const text = await resolveCalendarChaveText(
            {
              id: r.calendar_event_id,
              event_type: "sindicancia",
              title: r.event?.title ?? "",
              start_at: r.event?.start_at ?? new Date().toISOString(),
              location: r.event?.location ?? null,
            },
            active?.chapter,
          );
          return [r.calendar_event_id, text] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, string>;
    },
  });

  function copyChave(calendarEventId: string) {
    try {
      const text = chaveById[calendarEventId];
      if (!text) {
        throw new Error("Aguarde o carregamento da chave.");
      }
      void navigator.clipboard.writeText(text).then(
        () => toast.success("Chave de sindicância copiada!"),
        (e: unknown) =>
          toast.error(
            e instanceof Error ? e.message : "Não foi possível copiar",
          ),
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível copiar");
    }
  }

  const shareParticipation = useMutation({
    mutationFn: (calendarEventId: string) =>
      ensureSindicanciaParticipationLink({ data: { calendarEventId } }),
    onSuccess: async ({ token }) => {
      const url = `${window.location.origin}/sindicancia/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link de participação copiado");
      } catch {
        toast.success("Link gerado", { description: url });
      }
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o link"),
  });

  const revokeParticipation = useMutation({
    mutationFn: (calendarEventId: string) =>
      revokeSindicanciaParticipationLink({ data: { calendarEventId } }),
    onSuccess: () => toast.success("Link de participação revogado"),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao revogar o link"),
  });

  const remind = useMutation({
    mutationFn: (input: {
      calendarEventId: string;
      recipients: SindicanciaReminderRole[];
    }) => sendSindicanciaReminder({ data: input }),
    onSuccess: (res) => {
      setRemindOpen(false);
      const lines = res.deliveries.map((d) => {
        const status =
          d.outcome === "sent"
            ? "E-mail enviado"
            : d.outcome === "no_email"
              ? "Sem e-mail"
              : d.detail || "Erro ao enviar";
        return `${d.name} — ${d.role} — ${status}`;
      });
      const description = (
        <span className="block whitespace-pre-line">{lines.join("\n")}</span>
      );
      const sent = res.deliveries.filter((d) => d.outcome === "sent").length;
      if (sent === 0) {
        toast.error("Nenhum lembrete enviado", { description, duration: 12000 });
        return;
      }
      const pending = res.deliveries.length - sent;
      toast.success(pending ? "Lembrete enviado em parte" : "Lembrete enviado", {
        description,
        duration: 12000,
      });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao enviar lembrete"),
  });

  async function openRemind(calendarEventId: string, nominee: string) {
    setRemindEventId(calendarEventId);
    setRemindNominee(nominee);
    setRemindPeople([]);
    setRemindSelected(new Set());
    setRemindOpen(true);
    setRemindLoading(true);
    try {
      const people = await listSindicanciaReminderRecipients({
        data: { calendarEventId },
      });
      setRemindPeople(people);
      setRemindSelected(
        new Set(
          people.filter((person) => person.hasEmail).map((person) => person.role),
        ),
      );
    } catch (e: unknown) {
      setRemindOpen(false);
      toast.error(
        e instanceof Error ? e.message : "Erro ao carregar destinatários",
      );
    } finally {
      setRemindLoading(false);
    }
  }

  function toggleRemind(role: SindicanciaReminderRole, checked: boolean) {
    setRemindSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  }

  function toggleAllRemind(checked: boolean) {
    setRemindSelected(
      checked
        ? new Set(
            remindPeople.filter((person) => person.hasEmail).map((person) => person.role),
          )
        : new Set(),
    );
  }

  const create = useMutation({
    mutationFn: () =>
      createSindicancia({
        data: {
          chapterId: active!.chapter_id,
          title: form.title || `Sindicância — ${form.nominee_name}`,
          start_at: fromAppTzDateTimeLocal(form.start_at).toISOString(),
          location: form.location || null,
          address: form.location || null,
          file_id: form.file_id || null,
          nominee_name: form.nominee_name,
          senior_member_id: form.senior_member_id,
          investigator_member_id: form.investigator_member_id,
          clerk_member_id: form.clerk_member_id,
          opinion: form.opinion || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Sindicância criada");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["sindicancias"] });
      await qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao criar"),
  });

  function startEditMembers(row: SindicanciaListItem) {
    setEditRoles({
      senior_member_id: row.senior_member_id,
      investigator_member_id: row.investigator_member_id,
      clerk_member_id: row.clerk_member_id,
    });
    setEditing(row);
  }

  const saveMembers = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Sindicância inválida");
      return updateSindicancia({
        data: {
          calendar_event_id: editing.calendar_event_id,
          senior_member_id: editRoles.senior_member_id,
          senior_text: editRoles.senior_member_id
            ? null
            : editing.senior_text,
          investigator_member_id: editRoles.investigator_member_id,
          investigator_text: editRoles.investigator_member_id
            ? null
            : editing.investigator_text,
          clerk_member_id: editRoles.clerk_member_id,
          clerk_text: editRoles.clerk_member_id ? null : editing.clerk_text,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Membros atualizados");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["sindicancias"] });
      await qc.invalidateQueries({ queryKey: ["sindicancia"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar membros"),
  });

  const setStatus = useMutation({
    mutationFn: (v: {
      calendar_event_id: string;
      status: InvestigationStatus;
    }) => updateSindicancia({ data: v }),
    onSuccess: async () =>
      qc.invalidateQueries({ queryKey: ["sindicancias"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      deleteSindicancia({ data: { calendar_event_id: id } }),
    onSuccess: async () => {
      toast.success("Sindicância excluída");
      await qc.invalidateQueries({ queryKey: ["sindicancias"] });
      await qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  return (
    <div>
      <PageHeader
        title="Sindicâncias"
        subtitle="Eventos de sindicância no calendário do capítulo (sem chamada de presença)."
        actions={
          writable ? (
            <Button
              onClick={() => setOpen(true)}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              <Plus className="mr-2 h-4 w-4" /> Nova sindicância
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Pesquisar indicado, local, responsável…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="data_desc">Data (mais recente)</SelectItem>
            <SelectItem value="data_asc">Data (mais antiga)</SelectItem>
            <SelectItem value="nome_asc">Indicado (A–Z)</SelectItem>
            <SelectItem value="nome_desc">Indicado (Z–A)</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Gavel className="h-7 w-7" />}
          title={rows.length === 0 ? "Nenhuma sindicância" : "Nenhum resultado"}
          description={
            rows.length === 0
              ? "Abra uma a partir de uma ficha ou crie manualmente."
              : "Ajuste a pesquisa ou os filtros."
          }
          action={
            rows.length === 0 ? (
              <Button asChild variant="outline">
                <Link to="/sindicancias/fichas">Ver fichas</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.calendar_event_id}>
              <Card className="rounded-[12px] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {r.event?.title ?? r.nominee_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Indicado: {r.nominee_name}
                      {r.event?.start_at
                        ? ` · ${formatDateTimeBR(r.event.start_at)}`
                        : ""}
                      {r.event?.location ? ` · ${r.event.location}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[
                        r.senior?.full_name || r.senior_text
                          ? `Tio/Senior: ${r.senior?.full_name || r.senior_text}`
                          : null,
                        r.investigator?.full_name || r.investigator_text
                          ? `Sindicante: ${r.investigator?.full_name || r.investigator_text}`
                          : null,
                        r.clerk?.full_name || r.clerk_text
                          ? `Escrivão: ${r.clerk?.full_name || r.clerk_text}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyChave(r.calendar_event_id)}
                      disabled={!chaveById[r.calendar_event_id]}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Chave
                    </Button>
                    {writable &&
                    (r.status === "aberta" || r.status === "em_andamento") ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={shareParticipation.isPending}
                          onClick={() =>
                            shareParticipation.mutate(r.calendar_event_id)
                          }
                        >
                          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={remind.isPending}
                          onClick={() =>
                            void openRemind(
                              r.calendar_event_id,
                              r.nominee_name || r.event?.title || "esta sindicância",
                            )
                          }
                        >
                          <Mail className="mr-1.5 h-3.5 w-3.5" /> Lembrete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokeParticipation.isPending}
                          onClick={() =>
                            revokeParticipation.mutate(r.calendar_event_id)
                          }
                        >
                          <Unlink className="mr-1.5 h-3.5 w-3.5" /> Revogar
                        </Button>
                      </>
                    ) : null}
                    {isMobile ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAtaMobile(r, "roteiro")}
                        >
                          <ListOrdered className="mr-1.5 h-3.5 w-3.5" /> Roteiro
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openAtaMobile(
                              r,
                              r.status === "votacao_comissao"
                                ? "votacao"
                                : "ata",
                            )
                          }
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />{" "}
                          {r.status === "votacao_comissao" ? "Votar" : "Ata"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/sindicancias/sindicarias/$eventId"
                            params={{ eventId: r.calendar_event_id }}
                            search={{ modo: "roteiro" }}
                          >
                            <ListOrdered className="mr-1.5 h-3.5 w-3.5" />{" "}
                            Roteiro
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/sindicancias/sindicarias/$eventId"
                            params={{ eventId: r.calendar_event_id }}
                            search={{
                              modo: ataSearchMode(
                                r,
                                r.status === "votacao_comissao"
                                  ? "votacao"
                                  : "ata",
                              ),
                            }}
                          >
                            <FileText className="mr-1.5 h-3.5 w-3.5" />{" "}
                            {r.status === "votacao_comissao" ? "Votar" : "Ata"}
                          </Link>
                        </Button>
                      </>
                    )}
                    {writable && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditMembers(r)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Membros
                      </Button>
                    )}
                    {writable && (
                      <Select
                        value={r.status}
                        onValueChange={(v) => {
                          if (!isInvestigationStatus(v)) return;
                          setStatus.mutate({
                            calendar_event_id: r.calendar_event_id,
                            status: v,
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {writable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Excluir sindicância?",
                            description: "Excluir esta sindicância?",
                            confirmLabel: "Excluir",
                          });
                          if (ok) remove.mutate(r.calendar_event_id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova sindicância</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-sm">Ficha (opcional)</Label>
              <SearchableSelect
                value={form.file_id || "none"}
                onChange={(v) => {
                  if (v === "none") {
                    setForm((f) => ({ ...f, file_id: "" }));
                    return;
                  }
                  const file = files.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    file_id: v,
                    nominee_name: file?.candidate_name ?? f.nominee_name,
                    title: file
                      ? `Sindicância — ${file.candidate_name}`
                      : f.title,
                  }));
                }}
                placeholder="Sem ficha"
                searchPlaceholder="Buscar ficha…"
                emptyText="Nenhuma ficha encontrada."
                options={[
                  { value: "none", label: "Sem ficha" },
                  ...files.map((f) => ({
                    value: f.id,
                    label: f.candidate_name,
                  })),
                ]}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Nome do indicado *</Label>
              <Input
                value={form.nominee_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nominee_name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Título</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Sindicância — Nome"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Início *</Label>
              <Input
                type="datetime-local"
                value={form.start_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_at: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Local</Label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
            <MemberSearchSelect
              label="Tio / Senior"
              members={memberOpts}
              kinds={["senior", "macom"]}
              memberId={form.senior_member_id}
              placeholder="Buscar Senior ou Tio…"
              hint="Somente membros Senior ou Maçom (Tio)."
              onChange={(id) =>
                setForm((f) => ({ ...f, senior_member_id: id }))
              }
            />
            <MemberSearchSelect
              label="Sindicante"
              members={memberOpts}
              memberId={form.investigator_member_id}
              placeholder="Buscar membro…"
              onChange={(id) =>
                setForm((f) => ({ ...f, investigator_member_id: id }))
              }
            />
            <MemberSearchSelect
              label="Escrivão de Parecer"
              members={memberOpts}
              memberId={form.clerk_member_id}
              placeholder="Buscar membro…"
              onChange={(id) =>
                setForm((f) => ({ ...f, clerk_member_id: id }))
              }
            />
            <div>
              <Label className="mb-1.5 block text-sm">Parecer</Label>
              <Textarea
                value={form.opinion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, opinion: e.target.value }))
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={create.isPending || !form.nominee_name.trim()}
              onClick={() => create.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {create.isPending ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Membros — {editing?.nominee_name ?? "Sindicância"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <MemberSearchSelect
              label="Tio / Senior"
              members={memberOpts}
              kinds={["senior", "macom"]}
              memberId={editRoles.senior_member_id}
              placeholder="Buscar Senior ou Tio…"
              hint="Somente membros Senior ou Maçom (Tio)."
              onChange={(id) =>
                setEditRoles((r) => ({ ...r, senior_member_id: id }))
              }
            />
            <MemberSearchSelect
              label="Sindicante"
              members={memberOpts}
              memberId={editRoles.investigator_member_id}
              placeholder="Buscar membro…"
              onChange={(id) =>
                setEditRoles((r) => ({ ...r, investigator_member_id: id }))
              }
            />
            <MemberSearchSelect
              label="Escrivão de Parecer"
              members={memberOpts}
              memberId={editRoles.clerk_member_id}
              placeholder="Buscar membro…"
              onChange={(id) =>
                setEditRoles((r) => ({ ...r, clerk_member_id: id }))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveMembers.isPending}
              onClick={() => saveMembers.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {saveMembers.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!ataRow}
        onOpenChange={(o) => {
          if (!o) setAtaRow(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ataMode === "roteiro"
                ? "Roteiro"
                : ataMode === "votacao"
                  ? "Votação"
                  : "Ata"}{" "}
              — {ataRow?.nominee_name ?? "Sindicância"}
            </DialogTitle>
          </DialogHeader>
          {ataRow && active && (
            <SindicanciaAtaForm
              chapterId={active.chapter_id}
              accent={active.chapter.primary_color}
              row={ataRow}
              writable={writable}
              mode={ataMode}
            />
          )}
        </DialogContent>
      </Dialog>
      {isMobile ? (
        <Sheet open={remindOpen} onOpenChange={setRemindOpen}>
          <SheetContent
            side="bottom"
            className="flex max-h-[85vh] flex-col gap-3 rounded-t-2xl px-4 pb-4 pt-5"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Enviar lembrete</SheetTitle>
            </SheetHeader>
            <ReminderRecipientList
              nominee={remindNominee}
              loading={remindLoading}
              people={remindPeople}
              selected={remindSelected}
              onToggle={toggleRemind}
              onToggleAll={toggleAllRemind}
            />
            <SheetFooter className="gap-2 sm:space-x-0">
              <Button
                type="button"
                className="w-full"
                disabled={remindSelected.size === 0 || remind.isPending}
                style={{ backgroundColor: active?.chapter.primary_color }}
                onClick={() => {
                  if (!remindEventId) return;
                  remind.mutate({
                    calendarEventId: remindEventId,
                    recipients: [...remindSelected],
                  });
                }}
              >
                <Mail className="mr-1.5 h-4 w-4" />
                {remind.isPending
                  ? "Enviando…"
                  : `Enviar (${remindSelected.size})`}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={remindOpen} onOpenChange={setRemindOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar lembrete</DialogTitle>
            </DialogHeader>
            <ReminderRecipientList
              nominee={remindNominee}
              loading={remindLoading}
              people={remindPeople}
              selected={remindSelected}
              onToggle={toggleRemind}
              onToggleAll={toggleAllRemind}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={remind.isPending}
                onClick={() => setRemindOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={remindSelected.size === 0 || remind.isPending}
                style={{ backgroundColor: active?.chapter.primary_color }}
                onClick={() => {
                  if (!remindEventId) return;
                  remind.mutate({
                    calendarEventId: remindEventId,
                    recipients: [...remindSelected],
                  });
                }}
              >
                <Mail className="mr-1.5 h-4 w-4" />
                {remind.isPending
                  ? "Enviando…"
                  : `Enviar (${remindSelected.size})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {dialog}
    </div>
  );
}
