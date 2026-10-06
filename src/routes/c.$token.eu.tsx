import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Banknote, Check, Loader2, LogOut, Receipt, Search } from "lucide-react";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import {
  getPublicMemberPortal,
  lobbyMemberStorageKey,
  lookupLobbyMemberCadastro,
  submitLobbyMemberCadastro,
} from "@/lib/lobby-share.functions";
import type {
  CadastroLookupGuardian,
  CadastroLookupMember,
} from "@/lib/cadastro.functions";
import { Field, GUARDIAN_RELATIONSHIPS } from "@/components/members/MemberFields";
import {
  MONTH_SHORT,
  autoDueExemptTip,
  isDueOverdue,
  isFutureMonth,
} from "@/lib/dues-rules";
import type { DueMemberLite } from "@/lib/dues-rules";
import {
  digitsOnly,
  formatBRL,
  formatCpfMask,
  formatDateBR,
  formatDateTimeBR,
  formatRgMask,
  isUnder21,
  kindLabel,
  maskCpfInput,
  maskPhoneInput,
  statusLabel,
} from "@/lib/format";
import { lookupCep, maskCepInput, createCepLookupSeq } from "@/lib/cep";
import { typeLabel } from "@/lib/calendar-types";
import { currentYearMonthInAppTz } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/c/$token/eu")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Área do membro — Templo Virtual" }],
  }),
  component: LobbyMemberPortalPage,
});

type EditableGuardian = {
  id: string;
  full_name: string;
  relationship: string;
  cpf: string;
  phone: string;
  email: string;
  cpf_last2: string | null;
};

function LobbyMemberPortalPage() {
  const { token, chapter } = usePublicLobby();
  const qc = useQueryClient();
  const accent = chapter.primary_color || "#9E1B32";
  const storageKey = lobbyMemberStorageKey(token);

  const [demolayId, setDemolayId] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(storageKey) ?? "";
  });
  const [unlockedId, setUnlockedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(storageKey) ?? "";
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState("cobrancas");

  const portalQ = useQuery({
    queryKey: ["public-member-portal", token, unlockedId, year],
    queryFn: () =>
      getPublicMemberPortal({
        data: { token, demolayId: unlockedId, year },
      }),
    enabled: Boolean(unlockedId),
    retry: false,
  });

  const memberKind = portalQ.data?.member.kind ?? "";
  const showFrequency = memberKind === "demolay_ativo";
  const showMensalidades =
    memberKind === "demolay_ativo" || memberKind === "senior";

  useEffect(() => {
    if (!showFrequency && tab === "frequencia") setTab("cobrancas");
  }, [showFrequency, tab]);

  const unlock = useMutation({
    mutationFn: async (id: string) => {
      const portal = await getPublicMemberPortal({
        data: { token, demolayId: id, year },
      });
      return portal;
    },
    onSuccess: (portal, id) => {
      qc.setQueryData(["public-member-portal", token, id, year], portal);
      sessionStorage.setItem(storageKey, id);
      setUnlockedId(id);
      toast.success("Acesso liberado nesta sessão");
    },
    onError: (e: Error) => toast.error(e.message || "ID não encontrado neste capítulo"),
  });

  function logout() {
    sessionStorage.removeItem(storageKey);
    setUnlockedId("");
    setDemolayId("");
  }

  if (!unlockedId) {
    return (
      <div className="mx-auto max-w-lg">
        <LobbyBackLink />
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Área do membro</h2>
          <p className="text-sm text-muted-foreground">
            Informe seu ID DeMolay deste capítulo.
          </p>
        </div>
        <Card className="space-y-4 rounded-[12px] p-5">
          <div>
            <Label className="mb-1.5 block text-sm">ID DeMolay</Label>
            <div className="flex gap-2">
              <Input
                value={demolayId}
                placeholder="Ex.: 123456"
                onChange={(e) => setDemolayId(e.target.value.slice(0, 40))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (demolayId.trim().length >= 3) unlock.mutate(demolayId.trim());
                  }
                }}
              />
              <Button
                type="button"
                style={{ backgroundColor: accent }}
                disabled={unlock.isPending || demolayId.trim().length < 3}
                onClick={() => unlock.mutate(demolayId.trim())}
              >
                {unlock.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" /> Entrar
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <LobbyBackLink />
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Área do membro</h2>
          <p className="text-sm text-muted-foreground">ID {unlockedId}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList
          className={`grid h-auto w-full ${showFrequency ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          {showFrequency ? (
            <TabsTrigger value="frequencia">Frequência</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="cobrancas" className="mt-0">
          <MemberChargesTab
            token={token}
            demolayId={unlockedId}
            year={year}
            onYearChange={setYear}
            accent={accent}
            showMensalidades={showMensalidades}
            portalData={portalQ.data}
            isLoading={portalQ.isLoading}
            error={
              portalQ.error instanceof Error ? portalQ.error : null
            }
          />
        </TabsContent>
        <TabsContent value="cadastro" className="mt-0">
          <MemberCadastroTab token={token} demolayId={unlockedId} accent={accent} />
        </TabsContent>
        {showFrequency ? (
          <TabsContent value="frequencia" className="mt-0">
            <MemberFrequencyTab
              token={token}
              demolayId={unlockedId}
              year={year}
              onYearChange={setYear}
              portalData={portalQ.data}
              isLoading={portalQ.isLoading}
              error={
                portalQ.error instanceof Error ? portalQ.error : null
              }
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

const DUE_STATUS_LABEL: Record<string, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
  desligado: "Desligado",
};

function MemberChargesTab({
  token: _token,
  demolayId: _demolayId,
  year,
  onYearChange,
  accent: _accent,
  showMensalidades,
  portalData,
  isLoading,
  error,
}: {
  token: string;
  demolayId: string;
  year: number;
  onYearChange: (y: number) => void;
  accent: string;
  showMensalidades: boolean;
  portalData: Awaited<ReturnType<typeof getPublicMemberPortal>> | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const data = portalData;

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2];
  }, []);

  const paidByCharge = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of data?.payments ?? []) {
      map.set(p.charge_id, (map.get(p.charge_id) ?? 0) + Number(p.amount));
    }
    return map;
  }, [data?.payments]);

  const charges = useMemo(() => {
    return (data?.charges ?? []).map((c) => {
      const amount = Number(c.amount) || 0;
      let amountPaid = paidByCharge.get(c.id) ?? 0;
      if (amountPaid === 0 && c.status === "pago" && c.cash_entry_id) {
        amountPaid = amount;
      }
      amountPaid = Math.min(amountPaid, amount);
      return {
        ...c,
        amount,
        amount_paid: amountPaid,
        remaining: Math.max(0, amount - amountPaid),
      };
    });
  }, [data?.charges, paidByCharge]);

  const parsedDefault = Number(data?.defaultAmount);
  const defaultAmount = Number.isFinite(parsedDefault) ? parsedDefault : 20;

  const memberLite: DueMemberLite | null = data
    ? {
        id: data.member.id,
        full_name: data.member.full_name,
        status: data.member.status,
        kind: data.member.kind,
        birth_date: data.member.birth_date,
        iniciacao_ordem: data.member.iniciacao_ordem,
      }
    : null;

  const summary = useMemo(() => {
    const { year: appYear, month: appMonth } = currentYearMonthInAppTz();
    let duesOpenAmount = 0;
    let duesOpenCount = 0;
    for (const d of data?.dues ?? []) {
      if (d.status !== "em_aberto") continue;
      if (
        d.competence_year > appYear ||
        (d.competence_year === appYear && d.competence_month > appMonth)
      ) {
        continue;
      }
      duesOpenCount += 1;
      duesOpenAmount += Number(d.amount) || 0;
    }
    let chargesOpenAmount = 0;
    let chargesOpenCount = 0;
    for (const c of charges) {
      if (c.status === "isento") continue;
      if (c.remaining <= 0) continue;
      chargesOpenCount += 1;
      chargesOpenAmount += c.remaining;
    }
    return {
      duesOpenCount,
      duesOpenAmount,
      chargesOpenCount,
      chargesOpenAmount,
      totalOpen: duesOpenAmount + chargesOpenAmount,
    };
  }, [charges, data?.dues]);

  if (error) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {error.message}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Situação financeira</p>
          <p className="text-xs text-muted-foreground">
            {data
              ? `${data.member.full_name} · ${kindLabel(data.member.kind)} · ${statusLabel(data.member.status)}`
              : "Mensalidades e cobranças deste membro"}
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="rounded-[12px] p-4">
              <div className="text-xs text-muted-foreground">Total em aberto</div>
              <div
                className={`mt-1 text-xl font-bold ${
                  (showMensalidades
                    ? summary.totalOpen
                    : summary.chargesOpenAmount) > 0
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {formatBRL(
                  showMensalidades
                    ? summary.totalOpen
                    : summary.chargesOpenAmount,
                )}
              </div>
            </Card>
            <Card className="rounded-[12px] p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" /> Mensalidades
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatBRL(showMensalidades ? summary.duesOpenAmount : 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {showMensalidades ? summary.duesOpenCount : 0} competência
                {(showMensalidades ? summary.duesOpenCount : 0) === 1 ? "" : "s"}
              </div>
            </Card>
            <Card className="rounded-[12px] p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Banknote className="h-3.5 w-3.5" /> Cobranças
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatBRL(summary.chargesOpenAmount)}
              </div>
              <div className="text-xs text-muted-foreground">
                {summary.chargesOpenCount} em aberto
              </div>
            </Card>
          </div>

          {showMensalidades ? (
            <Card className="rounded-[12px] p-5">
              <h3 className="mb-3 text-sm font-semibold">
                Mensalidades · {year}
                <span className="ml-2 font-normal text-muted-foreground">
                  · padrão {formatBRL(defaultAmount)}
                </span>
              </h3>
              {(data?.dues.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma competência registrada neste ano.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {(data?.dues ?? []).map((d) => {
                    const status = d.status;
                    const future =
                      status === "em_aberto" &&
                      isFutureMonth(year, d.competence_month);
                    const overdue =
                      !future &&
                      isDueOverdue(year, d.competence_month, status);
                    const style = future
                      ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
                      : status === "pago"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : status === "isento"
                          ? "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
                          : status === "desligado"
                            ? "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
                            : overdue
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
                    const cellLabel = future
                      ? "·"
                      : overdue
                        ? "Atrasado"
                        : (DUE_STATUS_LABEL[status] ?? status);
                    const exemptTip =
                      status === "isento" && memberLite
                        ? autoDueExemptTip(memberLite, year, d.competence_month)
                        : null;
                    return (
                      <div
                        key={d.id}
                        title={exemptTip ?? undefined}
                        className={`rounded-[8px] px-2 py-2 text-center ${style}`}
                      >
                        <div className="text-xs font-medium">
                          {MONTH_SHORT[d.competence_month - 1] ??
                            d.competence_month}
                        </div>
                        <div className="text-[11px] opacity-80">{cellLabel}</div>
                        <div className="mt-0.5 text-xs font-semibold">
                          {formatBRL(Number(d.amount))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : null}

          <Card className="rounded-[12px] p-5">
            <h3 className="mb-3 text-sm font-semibold">Cobranças</h3>
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma cobrança atribuída a este membro.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {charges.map((c) => {
                  const pct =
                    c.amount > 0
                      ? Math.min(100, Math.round((c.amount_paid / c.amount) * 100))
                      : 0;
                  return (
                    <li
                      key={c.id}
                      className="space-y-1.5 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {c.description}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.category} · venc. {formatDateBR(c.due_date)}
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {c.remaining <= 0 || c.status === "pago"
                            ? "Quitada"
                            : c.amount_paid > 0
                              ? "Parcial"
                              : (DUE_STATUS_LABEL[c.status] ?? c.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {formatBRL(c.amount_paid)} de {formatBRL(c.amount)}
                        </span>
                        {c.remaining > 0 && c.status !== "isento" ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            resta {formatBRL(c.remaining)}
                          </span>
                        ) : null}
                      </div>
                      {c.status !== "isento" ? (
                        <Progress value={pct} className="h-1.5" />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function MemberFrequencyTab({
  year,
  onYearChange,
  portalData,
  isLoading,
  error,
}: {
  token: string;
  demolayId: string;
  year: number;
  onYearChange: (y: number) => void;
  portalData: Awaited<ReturnType<typeof getPublicMemberPortal>> | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const data = portalData;

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2];
  }, []);

  const statusByEvent = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of data?.attendance ?? []) map.set(a.event_id, a.status);
    return map;
  }, [data?.attendance]);

  const events = useMemo(
    () => [...(data?.events ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    [data?.events],
  );

  const recorded = useMemo(
    () => events.filter((ev) => statusByEvent.has(ev.id)),
    [events, statusByEvent],
  );

  const stats = useMemo(() => {
    let present = 0;
    for (const ev of recorded) {
      if (statusByEvent.get(ev.id) === "presente") present += 1;
    }
    const total = recorded.length;
    return {
      present,
      total,
      pct: total ? Math.round((present / total) * 100) : null,
    };
  }, [recorded, statusByEvent]);

  if (error) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {error.message}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Chamadas obrigatórias</p>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <Card className="rounded-[12px] p-5">
            <div className="text-sm font-medium text-muted-foreground">
              Frequência em itens obrigatórios
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className="text-3xl font-bold"
                style={{
                  color:
                    stats.pct === null
                      ? "var(--muted-foreground)"
                      : stats.pct >= 75
                        ? "#047857"
                        : "#B91C1C",
                }}
              >
                {stats.pct == null ? "—" : `${stats.pct}%`}
              </span>
              <span className="text-sm text-muted-foreground">
                {stats.present} de {stats.total} contabilizáveis
              </span>
            </div>
          </Card>
          <Card className="rounded-[12px] p-0">
            {recorded.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">
                Nenhum registro de presença neste ano.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recorded.map((ev) => {
                  const status = statusByEvent.get(ev.id);
                  return (
                    <li key={ev.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{ev.title}</span>
                        <Badge variant="secondary">{typeLabel(ev.event_type)}</Badge>
                        <Badge variant="default">Contabilizável</Badge>
                        <span
                          className="ml-auto text-xs font-semibold"
                          style={{
                            color:
                              status === "presente"
                                ? "#047857"
                                : status === "pendente"
                                  ? "#D97706"
                                  : "#B91C1C",
                          }}
                        >
                          {status === "presente"
                            ? "Presente"
                            : status === "pendente"
                              ? "Pendente"
                              : "Ausente"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTimeBR(ev.starts_at)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function MemberCadastroTab({
  token,
  demolayId,
  accent,
}: {
  token: string;
  demolayId: string;
  accent: string;
}) {
  const [member, setMember] = useState<CadastroLookupMember | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [address, setAddress] = useState({
    zip: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  });
  const [guardians, setGuardians] = useState<EditableGuardian[]>([]);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");
  const cepSeq = useRef(createCepLookupSeq()).current;
  const [done, setDone] = useState(false);

  const lookup = useMutation({
    mutationFn: () =>
      lookupLobbyMemberCadastro({ data: { token, demolayId } }),
    onSuccess: (data) => {
      setDone(false);
      setMember(data.member);
      setPhone(data.member.phone ?? "");
      setEmail(data.member.email ?? "");
      setCpf("");
      setRg("");
      const addr = (data.member.address ?? {}) as Record<string, string>;
      setAddress({
        zip: maskCepInput(addr.zip ?? ""),
        street: addr.street ?? "",
        number: addr.number ?? "",
        complement: addr.complement ?? "",
        neighborhood: addr.neighborhood ?? "",
        city: addr.city ?? "",
        state: addr.state ?? "",
        country: addr.country ?? "Brasil",
      });
      setGuardians(
        isUnder21(data.member.birth_date)
          ? (data.guardians ?? []).slice(0, 2).map((g: CadastroLookupGuardian) => ({
              id: g.id,
              full_name: g.full_name,
              relationship: g.relationship ?? "",
              cpf: "",
              phone: g.phone ?? "",
              email: g.email ?? "",
              cpf_last2: g.cpf_last2,
            }))
          : [],
      );
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível carregar o cadastro"),
  });

  useEffect(() => {
    lookup.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, demolayId]);

  const save = useMutation({
    mutationFn: () => {
      if (!member) throw new Error("Cadastro não carregado");
      return submitLobbyMemberCadastro({
        data: {
          token,
          demolayId: member.demolay_id || demolayId,
          phone,
          email,
          address,
          cpf,
          rg,
          guardians: isUnder21(member.birth_date)
            ? guardians.map((g) => ({
                id: g.id,
                relationship: g.relationship,
                cpf: g.cpf,
                phone: g.phone,
                email: g.email,
              }))
            : [],
        },
      });
    },
    onSuccess: (res) => {
      setDone(true);
      if (res.changed) toast.success("Cadastro atualizado");
      else toast.message("Nenhuma alteração detectada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  async function doLookupCep(raw: string) {
    const cep = digitsOnly(raw);
    if (cep.length !== 8 || cep === lastLookedUp.current) return;
    lastLookedUp.current = cep;
    const reqId = cepSeq.begin();
    setCepStatus("loading");
    setCepError("");
    try {
      const data = await lookupCep(raw);
      if (!cepSeq.isCurrent(reqId)) return;
      setAddress((a) => ({
        ...a,
        zip: data.zip,
        street: data.street,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        country: data.country,
      }));
      setCepStatus("ok");
    } catch (e) {
      if (!cepSeq.isCurrent(reqId)) return;
      setCepStatus("error");
      setCepError(
        e instanceof Error ? e.message : "Não foi possível buscar o CEP",
      );
    }
  }

  function handleCepChange(raw: string) {
    const masked = maskCepInput(raw);
    setDone(false);
    setAddress((a) => ({ ...a, zip: masked }));
    const digits = digitsOnly(masked);
    if (digits.length < 8) {
      cepSeq.invalidate();
      lastLookedUp.current = "";
      setCepStatus("idle");
      setCepError("");
      return;
    }
    void doLookupCep(masked);
  }

  function patchGuardian(id: string, patch: Partial<EditableGuardian>) {
    setDone(false);
    setGuardians((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function editPhone(value: string) {
    setDone(false);
    setPhone(value);
  }
  function editEmail(value: string) {
    setDone(false);
    setEmail(value);
  }
  function editCpf(value: string) {
    setDone(false);
    setCpf(value);
  }
  function editRg(value: string) {
    setDone(false);
    setRg(value);
  }
  function editAddress(patch: Partial<typeof address>) {
    setDone(false);
    setAddress((a) => ({ ...a, ...patch }));
  }

  if (lookup.isPending && !member) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar o cadastro.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 rounded-[12px] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{member.full_name}</h3>
            <p className="text-sm text-muted-foreground">ID {member.demolay_id}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{kindLabel(member.kind)}</Badge>
            <Badge variant="secondary">{statusLabel(member.status)}</Badge>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 rounded-[12px] p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Dados editáveis</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input
              value={phone}
              placeholder="(00) 00000-0000"
              onChange={(e) => editPhone(maskPhoneInput(e.target.value))}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => editEmail(e.target.value)}
            />
          </Field>
          <Field label="CPF">
            <Input
              value={cpf}
              placeholder={formatCpfMask(member.cpf_last2)}
              onChange={(e) => editCpf(maskCpfInput(e.target.value))}
            />
          </Field>
          <Field label="RG">
            <Input
              value={rg}
              placeholder={formatRgMask(member.rg_last2)}
              onChange={(e) => editRg(e.target.value.slice(0, 20))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CEP">
            <div className="relative">
              <Input
                value={address.zip}
                placeholder="00000-000"
                inputMode="numeric"
                onChange={(e) => handleCepChange(e.target.value)}
                onBlur={() => void doLookupCep(address.zip)}
              />
              {cepStatus === "loading" && (
                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </Field>
          <Field label="Endereço">
            <Input
              value={address.street}
              onChange={(e) => editAddress({ street: e.target.value })}
            />
          </Field>
          <Field label="Número">
            <Input
              value={address.number}
              onChange={(e) => editAddress({ number: e.target.value })}
            />
          </Field>
          <Field label="Complemento">
            <Input
              value={address.complement}
              onChange={(e) => editAddress({ complement: e.target.value })}
            />
          </Field>
          <Field label="Bairro">
            <Input
              value={address.neighborhood}
              onChange={(e) => editAddress({ neighborhood: e.target.value })}
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={address.city}
              onChange={(e) => editAddress({ city: e.target.value })}
            />
          </Field>
          <Field label="UF">
            <Input
              maxLength={2}
              value={address.state}
              onChange={(e) =>
                editAddress({ state: e.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="País">
            <Input
              value={address.country}
              onChange={(e) => editAddress({ country: e.target.value })}
            />
          </Field>
        </div>
        {cepError ? <p className="text-xs text-destructive">{cepError}</p> : null}
      </Card>

      {isUnder21(member.birth_date) &&
        guardians.map((g, idx) => (
          <Card key={g.id} className="space-y-4 rounded-[12px] p-4">
            <h3 className="text-sm font-semibold">
              Responsável {idx + 1}
              <span className="ml-2 font-normal text-muted-foreground">{g.full_name}</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Parentesco">
                <Select
                  value={g.relationship || undefined}
                  onValueChange={(v) => patchGuardian(g.id, { relationship: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(GUARDIAN_RELATIONSHIPS as readonly string[])
                      .concat(
                        g.relationship &&
                          !(GUARDIAN_RELATIONSHIPS as readonly string[]).includes(g.relationship)
                          ? [g.relationship]
                          : [],
                      )
                      .map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="CPF">
                <Input
                  value={g.cpf}
                  placeholder={formatCpfMask(g.cpf_last2)}
                  onChange={(e) => patchGuardian(g.id, { cpf: maskCpfInput(e.target.value) })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={g.phone}
                  placeholder="(00) 00000-0000"
                  onChange={(e) =>
                    patchGuardian(g.id, { phone: maskPhoneInput(e.target.value) })
                  }
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={g.email}
                  onChange={(e) => patchGuardian(g.id, { email: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        ))}

      <Button
        type="button"
        className="w-full"
        style={{ backgroundColor: accent }}
        disabled={save.isPending || done}
        onClick={() => save.mutate()}
      >
        {save.isPending ? (
          "Salvando…"
        ) : done ? (
          <>
            <Check className="mr-2 h-4 w-4" /> Enviado
          </>
        ) : (
          "Salvar atualização"
        )}
      </Button>
    </div>
  );
}
