import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Mail, Phone, Search } from "lucide-react";
import {
  consoleApproveRequest,
  consoleGetRequest,
  consoleListRequests,
  consoleLookups,
  consoleUpdateRequest,
  type ConsoleRequest,
  type Stage,
} from "@/lib/console/console.functions";
import {
  ConsoleTitle,
  STAGE_INFO,
  StageBadge,
  errorText,
  formatDateTime,
} from "@/components/console/console-ui";
import { ORG_TYPES, ORG_TYPE_LABELS, normalizeOrgType, type OrgType } from "@/lib/org-types";
import { formatDateBR } from "@/lib/format";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/console/_app/pedidos")({
  component: PedidosPage,
});

const FILTERS: { key: "abertos" | Stage | "todos"; label: string }[] = [
  { key: "abertos", label: "Em aberto" },
  { key: "novo", label: "Novos" },
  { key: "em_contato", label: "Em contato" },
  { key: "aprovado", label: "Aprovados" },
  { key: "recusado", label: "Recusados" },
  { key: "todos", label: "Todos" },
];

function PedidosPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("abertos");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["console", "requests"],
    queryFn: () => consoleListRequests(),
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (filter === "abertos" && !(r.stage === "novo" || r.stage === "em_contato")) return false;
      if (filter !== "abertos" && filter !== "todos" && r.stage !== filter) return false;
      if (!term) return true;
      return [r.name_number, r.responsible_name, r.responsible_email, r.full_address]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of data?.items ?? []) c[r.stage] = (c[r.stage] ?? 0) + 1;
    return c;
  }, [data]);

  if (isPending) return <PageSkeleton />;

  return (
    <div>
      <ConsoleTitle
        title="Pedidos"
        subtitle="Solicitações de novas instituições vindas de “Quero adicionar minha organização”."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const n =
              f.key === "abertos"
                ? (counts.novo ?? 0) + (counts.em_contato ?? 0)
                : f.key === "todos"
                  ? (data?.items.length ?? 0)
                  : (counts[f.key] ?? 0);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === f.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar"
            className="pl-9"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum pedido aqui.</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {items.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenId(r.id)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name_number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ORG_TYPE_LABELS[normalizeOrgType(r.org_type)]}
                  {r.org_type_other ? ` (${r.org_type_other})` : ""} · {r.responsible_name} ·{" "}
                  {r.full_address}
                </p>
              </div>
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <p>{formatDateTime(r.created_at)}</p>
                {r.assignee?.full_name && <p>com {r.assignee.full_name.split(" ")[0]}</p>}
              </div>
              <StageBadge stage={r.stage} />
            </button>
          ))}
        </Card>
      )}

      <RequestSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function RequestSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["console", "request", id],
    queryFn: () => consoleGetRequest({ data: { id: id! } }),
    enabled: Boolean(id),
  });
  const { data: lookups } = useQuery({
    queryKey: ["console", "lookups"],
    queryFn: () => consoleLookups(),
    staleTime: 5 * 60_000,
  });

  const update = useMutation({
    mutationFn: (input: {
      stage?: "novo" | "em_contato" | "recusado";
      assignedTo?: string | null;
      note?: string;
    }) => consoleUpdateRequest({ data: { id: id!, ...input } }),
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["console", "request", id] });
      void qc.invalidateQueries({ queryKey: ["console", "requests"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const r = data?.request;

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {isPending || !r ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-2">
                <StageBadge stage={r.stage} />
                <span className="text-xs text-muted-foreground">
                  recebido {formatDateTime(r.created_at)}
                </span>
              </div>
              <SheetTitle className="text-xl">{r.name_number}</SheetTitle>
            </SheetHeader>

            <div className="mt-5 space-y-5 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Info
                  k="Tipo"
                  v={`${ORG_TYPE_LABELS[normalizeOrgType(r.org_type)]}${r.org_type_other ? ` (${r.org_type_other})` : ""}`}
                />
                <Info k="Fundação" v={formatDateBR(r.founded_on)} />
                <Info k="Membros ativos" v={r.active_members_band} />
                <Info
                  k="Potência"
                  v={
                    r.potencia
                      ? `${r.potencia.nome}${r.potencia.sigla ? ` (${r.potencia.sigla})` : ""}`
                      : "—"
                  }
                />
                {r.sponsoring_lodge && <Info k="Loja patrocinadora" v={r.sponsoring_lodge} wide />}
                <Info k="Endereço" v={r.full_address} wide />
              </dl>

              <div className="rounded-lg border border-border p-3">
                <p className="font-medium">{r.responsible_name}</p>
                <p className="text-xs text-muted-foreground">{r.responsible_role}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <a
                    href={`mailto:${r.responsible_email}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" /> {r.responsible_email}
                  </a>
                  <a
                    href={`https://wa.me/55${r.responsible_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {r.responsible_phone}
                  </a>
                </div>
                {r.email_status === "failed" && (
                  <p className="mt-2 text-xs text-destructive">
                    O e-mail de confirmação do pedido falhou.
                  </p>
                )}
              </div>

              {r.created_chapter_id ? (
                <Button variant="outline" asChild className="w-full">
                  <Link to="/console/instituicoes/$id" params={{ id: r.created_chapter_id }}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir instituição criada
                  </Link>
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setApproveOpen(true)}>
                    <Check className="mr-2 h-4 w-4" />
                    Aprovar e criar instituição
                  </Button>
                  {r.stage !== "em_contato" && (
                    <Button
                      variant="outline"
                      onClick={() => update.mutate({ stage: "em_contato" })}
                    >
                      Marcar em contato
                    </Button>
                  )}
                  {r.stage !== "recusado" ? (
                    <Button variant="ghost" onClick={() => update.mutate({ stage: "recusado" })}>
                      Recusar
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => update.mutate({ stage: "novo" })}>
                      Reabrir
                    </Button>
                  )}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Responsável no Templo
                </Label>
                <Select
                  value={r.assigned_to ?? "none"}
                  onValueChange={(v) => update.mutate({ assignedTo: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {(lookups?.admins ?? []).map((a) => (
                      <SelectItem key={a.userId} value={a.userId}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h3 className="mb-2 font-medium">Histórico</h3>
                <ol className="space-y-2">
                  {(data?.notes ?? []).map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-lg px-3 py-2 ${n.kind === "note" ? "bg-muted/60" : "border border-dashed border-border text-muted-foreground"}`}
                    >
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">
                        {n.author?.full_name ?? "Sistema"} · {formatDateTime(n.created_at)}
                      </p>
                    </li>
                  ))}
                  {!data?.notes.length && (
                    <li className="text-xs text-muted-foreground">Sem anotações.</li>
                  )}
                </ol>
                <div className="mt-3 flex gap-2">
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anotar contato, combinado, pendência…"
                  />
                  <Button
                    variant="secondary"
                    disabled={!note.trim() || update.isPending}
                    onClick={() => update.mutate({ note: note.trim() })}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </div>

            {approveOpen && (
              <ApproveDialog
                request={r}
                onClose={() => setApproveOpen(false)}
                onDone={() => {
                  void qc.invalidateQueries({ queryKey: ["console"] });
                }}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v || "—"}</dd>
    </div>
  );
}

function guessNumber(nameNumber: string): string {
  const m = /n[ºo°.]?\s*(\d+)/i.exec(nameNumber) ?? /(\d+)/.exec(nameNumber);
  return m?.[1] ?? "";
}

function ApproveDialog({
  request,
  onClose,
  onDone,
}: {
  request: ConsoleRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: lookups } = useQuery({
    queryKey: ["console", "lookups"],
    queryFn: () => consoleLookups(),
    staleTime: 5 * 60_000,
  });
  const [name, setName] = useState(request.name_number);
  const [number, setNumber] = useState(guessNumber(request.name_number));
  const [orgType, setOrgType] = useState<OrgType>(normalizeOrgType(request.org_type));
  const [city, setCity] = useState("");
  const [stateId, setStateId] = useState<string>("");
  const [regionId, setRegionId] = useState<string>("none");
  const [adminName, setAdminName] = useState(request.responsible_name);
  const [adminEmail, setAdminEmail] = useState(request.responsible_email);
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof consoleApproveRequest>> | null>(
    null,
  );

  const regions = (lookups?.regions ?? []).filter((r) => r.state_id === stateId);

  const approve = useMutation({
    mutationFn: () =>
      consoleApproveRequest({
        data: {
          id: request.id,
          chapter: {
            name,
            number,
            org_type: orgType,
            city: city || null,
            state_id: stateId,
            region_id: regionId === "none" ? null : regionId,
            potencia_id: request.potencia_id,
          },
          admin: { full_name: adminName, email: adminEmail, role: "admin_total" },
          sendEmail,
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      onDone();
      toast.success("Instituição criada");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{result ? "Instituição criada" : "Aprovar pedido"}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              {result.accountCreated
                ? `Conta criada para ${adminEmail} como administradora total.`
                : `${adminEmail} já tinha conta; foi vinculada como administradora total.`}
            </p>
            {result.temporaryPassword && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Senha temporária (troca obrigatória no 1º acesso)
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="font-mono text-base">{result.temporaryPassword}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(result.temporaryPassword ?? "");
                      toast.success("Copiada");
                    }}
                    aria-label="Copiar senha"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              E-mail de acesso:{" "}
              {result.emailStatus === "sent"
                ? "enviado"
                : result.emailStatus === "skipped"
                  ? "não enviado"
                  : `falhou (${result.emailError ?? "erro"}) — envie a senha manualmente`}
              .
            </p>
            <DialogFooter>
              <Button asChild>
                <Link to="/console/instituicoes/$id" params={{ id: result.chapterId }}>
                  Abrir instituição
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              approve.mutate();
            }}
          >
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <F label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </F>
              <F label="Número">
                <Input value={number} onChange={(e) => setNumber(e.target.value)} required />
              </F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Tipo">
                <Select value={orgType} onValueChange={(v) => setOrgType(v as OrgType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ORG_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Cidade">
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </F>
              <F label="Estado">
                <Select
                  value={stateId}
                  onValueChange={(v) => {
                    setStateId(v);
                    setRegionId("none");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(lookups?.states ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Região">
                <Select value={regionId} onValueChange={setRegionId} disabled={!stateId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem região</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Administrador(a) da instituição
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Nome">
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                  />
                </F>
                <F label="E-mail">
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </F>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
                Enviar e-mail com a senha temporária
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={approve.isPending || !stateId}>
                {approve.isPending ? "Criando..." : "Criar instituição"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
