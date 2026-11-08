import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, Pencil, PlusCircle, Search, Trash2, Users, X } from "lucide-react";
import {
  createFdjMember,
  deleteFdjMember,
  getFdjMember,
  getFdjMemberPii,
  getMyFdjFichas,
  provisionFdjMemberAccount,
  listFdjMembers,
  updateFdjMember,
  type FdjMemberRow,
} from "@/lib/fdj-members.functions";
import {
  ageFrom,
  formatCpfMask,
  formatDateBR,
  formatRgMask,
  maskCepInput,
  maskCpfInput,
  maskPhoneInput,
  statusLabel,
} from "@/lib/format";
import { Field, GUARDIAN_RELATIONSHIPS } from "@/components/members/MemberFields";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/* Textos                                                              */
/* ------------------------------------------------------------------ */

const FDJ_CONSENT_TEXT =
  "Autorizo o tratamento dos dados pessoais da filha sob minha responsabilidade pelo Bethel, exclusivamente para fins administrativos, de comunicação e de participação em atividades da Ordem Internacional das Filhas de Jó, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Este consentimento pode ser revogado a qualquer momento junto à administração do Bethel.";

const MINOR_AGE = 18;

type AccountResult = Awaited<ReturnType<typeof provisionFdjMemberAccount>>;
/** Resultado do acesso criado junto com a ficha, mostrado uma vez na ficha. */
const freshAccounts = new Map<string, AccountResult>();

const listKey = (chapterId: string, q: string, status: string) =>
  ["fdj-members", chapterId, q, status] as const;
const memberKey = (id: string) => ["fdj-member", id] as const;

/* ------------------------------------------------------------------ */
/* Lista                                                               */
/* ------------------------------------------------------------------ */

export function FdjMembersList({ chapterId }: { chapterId: string }) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "regular" | "irregular">("all");

  useEffect(() => {
    const t = window.setTimeout(() => setQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isPending, isFetching } = useQuery({
    queryKey: listKey(chapterId, q, status),
    queryFn: () => listFdjMembers({ data: { chapterId, search: q, status } }),
    placeholderData: keepPreviousData,
  });

  if (isPending && !data) return <PageSkeleton />;

  const members = data?.members ?? [];
  const canManage = data?.canManage ?? false;

  return (
    <div className={isFetching ? "opacity-80 transition-opacity" : undefined}>
      <PageHeader
        title="Filhas do Bethel"
        subtitle={`${members.length} ${members.length === 1 ? "ficha" : "fichas"}`}
        actions={
          canManage ? (
            <Button asChild>
              <Link to="/membros/novo">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova filha
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou ID FDJ"
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="regular">Regulares</SelectItem>
            <SelectItem value="irregular">Irregulares</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={q || status !== "all" ? "Nenhuma ficha encontrada" : "Nenhuma filha cadastrada"}
          description={
            q || status !== "all"
              ? "Ajuste a busca ou os filtros."
              : canManage
                ? "Cadastre as filhas do Bethel para começar."
                : "A secretaria do Bethel ainda não cadastrou filhas."
          }
          action={
            canManage && !q && status === "all" ? (
              <Button asChild>
                <Link to="/membros/novo">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nova filha
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {members.map((m) => {
            const age = ageFrom(m.birth_date);
            return (
              <Link
                key={m.id}
                to="/membros/$id"
                params={{ id: m.id }}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(m.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      m.fdj_id ? `ID ${m.fdj_id}` : null,
                      age !== null ? `${age} anos` : null,
                      m.initiation_date ? `Iniciada em ${formatDateBR(m.initiation_date)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulário (novo / editar)                                          */
/* ------------------------------------------------------------------ */

type FormState = {
  full_name: string;
  birth_date: string;
  fdj_id: string;
  status: "regular" | "irregular";
  initiation_date: string;
  cpf: string;
  rg: string;
  phone: string;
  email: string;
  address: {
    zip: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  guardian: { full_name: string; relationship: string; phone: string; email: string };
  notes: string;
  consent: boolean;
  createAccount: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  birth_date: "",
  fdj_id: "",
  status: "regular",
  initiation_date: "",
  cpf: "",
  rg: "",
  phone: "",
  email: "",
  address: {
    zip: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  },
  guardian: { full_name: "", relationship: "", phone: "", email: "" },
  notes: "",
  consent: false,
  createAccount: true,
};

function formFromRow(m: FdjMemberRow): FormState {
  const a = (m.address ?? {}) as Record<string, string>;
  const g = m.guardian ?? {};
  return {
    full_name: m.full_name,
    birth_date: m.birth_date ?? "",
    fdj_id: m.fdj_id ?? "",
    status: m.status,
    initiation_date: m.initiation_date ?? "",
    cpf: "",
    rg: "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    address: {
      zip: a.zip ?? "",
      street: a.street ?? "",
      number: a.number ?? "",
      complement: a.complement ?? "",
      neighborhood: a.neighborhood ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
    },
    guardian: {
      full_name: g.full_name ?? "",
      relationship: g.relationship ?? "",
      phone: g.phone ?? "",
      email: g.email ?? "",
    },
    notes: m.notes ?? "",
    consent: Boolean(m.consent_text_version),
    createAccount: false,
  };
}

export function FdjMemberCreate({ chapterId }: { chapterId: string }) {
  return <FdjMemberForm chapterId={chapterId} initial={null} />;
}

export function FdjMemberEdit({ id }: { id: string }) {
  const { data, isPending } = useQuery({
    queryKey: memberKey(id),
    queryFn: () => getFdjMember({ data: { id } }),
  });
  if (isPending) return <PageSkeleton />;
  if (!data?.member) return <NotFound />;
  if (!data.canManage) {
    return (
      <EmptyState
        title="Sem permissão"
        description="Somente a secretaria ou a administração do Bethel podem editar fichas."
      />
    );
  }
  return <FdjMemberForm chapterId={data.member.chapter_id} initial={data.member} />;
}

function FdjMemberForm({
  chapterId,
  initial,
}: {
  chapterId: string;
  initial: FdjMemberRow | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(initial);
  const [f, setF] = useState<FormState>(() => (initial ? formFromRow(initial) : emptyForm));
  const [cpfChanged, setCpfChanged] = useState(false);
  const [rgChanged, setRgChanged] = useState(false);

  const age = ageFrom(f.birth_date || null);
  const isMinor = age === null || age < MINOR_AGE;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const setAddr = (k: keyof FormState["address"], v: string) =>
    setF((prev) => ({ ...prev, address: { ...prev.address, [k]: v } }));
  const setGuardian = (k: keyof FormState["guardian"], v: string) =>
    setF((prev) => ({ ...prev, guardian: { ...prev.guardian, [k]: v } }));

  const mutation = useMutation({
    mutationFn: async () => {
      const common = {
        full_name: f.full_name,
        birth_date: f.birth_date || null,
        fdj_id: f.fdj_id,
        status: f.status,
        initiation_date: f.initiation_date || null,
        phone: f.phone,
        email: f.email,
        address: f.address,
        guardian: f.guardian.full_name.trim() ? f.guardian : null,
        notes: f.notes,
      };
      if (initial) {
        await updateFdjMember({
          data: {
            id: initial.id,
            ...common,
            cpf: cpfChanged ? f.cpf : undefined,
            rg: rgChanged ? f.rg : undefined,
            cpf_changed: cpfChanged,
            rg_changed: rgChanged,
          },
        });
        return initial.id;
      }
      const res = await createFdjMember({
        data: { chapter_id: chapterId, ...common, cpf: f.cpf, rg: f.rg, consent: f.consent },
      });
      if (f.createAccount && f.email.trim()) {
        try {
          const account = await provisionFdjMemberAccount({ data: { id: res.id } });
          freshAccounts.set(res.id, account);
        } catch (e) {
          toast.error(
            `Ficha salva, mas o acesso não foi criado: ${e instanceof Error ? zodMessage(e.message) : ""}`,
          );
        }
      }
      return res.id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["fdj-members", chapterId] });
      void qc.invalidateQueries({ queryKey: memberKey(id) });
      toast.success(isEdit ? "Ficha atualizada" : "Filha cadastrada");
      void navigate({ to: "/membros/$id", params: { id } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? zodMessage(err.message) : "Não foi possível salvar");
    },
  });

  const needsConsent = !isEdit && isMinor && f.guardian.full_name.trim().length > 0;
  const canSubmit =
    f.full_name.trim().length >= 2 && !mutation.isPending && (!needsConsent || f.consent);

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={initial ? { id: initial.id } : null} />
      <PageHeader
        title={isEdit ? "Editar ficha" : "Nova filha"}
        subtitle={isEdit ? initial!.full_name : "Cadastro de filha do Bethel"}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        className="space-y-5"
      >
        <Section title="Dados pessoais">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome completo *">
                <Input
                  required
                  value={f.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  autoFocus={!isEdit}
                />
              </Field>
            </div>
            <Field label="Data de nascimento">
              <Input
                type="date"
                value={f.birth_date}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </Field>
            <Field label="ID FDJ">
              <Input
                value={f.fdj_id}
                onChange={(e) => set("fdj_id", e.target.value)}
                placeholder="Opcional"
              />
            </Field>
            <Field
              label={
                isEdit && initial?.cpf_last2
                  ? `CPF (atual ${formatCpfMask(initial.cpf_last2)})`
                  : "CPF"
              }
            >
              <Input
                inputMode="numeric"
                value={f.cpf}
                onChange={(e) => {
                  set("cpf", maskCpfInput(e.target.value));
                  setCpfChanged(true);
                }}
                placeholder={isEdit ? "Deixe em branco para manter" : "000.000.000-00"}
              />
            </Field>
            <Field
              label={
                isEdit && initial?.rg_last2 ? `RG (atual ${formatRgMask(initial.rg_last2)})` : "RG"
              }
            >
              <Input
                value={f.rg}
                onChange={(e) => {
                  set("rg", e.target.value);
                  setRgChanged(true);
                }}
                placeholder={isEdit ? "Deixe em branco para manter" : ""}
              />
            </Field>
          </div>
        </Section>

        <Section title="Bethel">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de iniciação">
              <Input
                type="date"
                value={f.initiation_date}
                onChange={(e) => set("initiation_date", e.target.value)}
              />
            </Field>
            <Field label="Situação">
              <Select
                value={f.status}
                onValueChange={(v) => set("status", v as FormState["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Contato e endereço">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone">
              <Input
                inputMode="tel"
                value={f.phone}
                onChange={(e) => set("phone", maskPhoneInput(e.target.value))}
                placeholder="(51) 90000-0000"
              />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
              {!isEdit && f.email.trim() && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={f.createAccount}
                    onCheckedChange={(v) => set("createAccount", v === true)}
                  />
                  Criar acesso ao sistema com este e-mail
                </label>
              )}
            </Field>
            <Field label="CEP">
              <Input
                inputMode="numeric"
                value={f.address.zip}
                onChange={(e) => setAddr("zip", maskCepInput(e.target.value))}
              />
            </Field>
            <Field label="Rua">
              <Input value={f.address.street} onChange={(e) => setAddr("street", e.target.value)} />
            </Field>
            <Field label="Número">
              <Input value={f.address.number} onChange={(e) => setAddr("number", e.target.value)} />
            </Field>
            <Field label="Complemento">
              <Input
                value={f.address.complement}
                onChange={(e) => setAddr("complement", e.target.value)}
              />
            </Field>
            <Field label="Bairro">
              <Input
                value={f.address.neighborhood}
                onChange={(e) => setAddr("neighborhood", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-[1fr_5rem] gap-4">
              <Field label="Cidade">
                <Input value={f.address.city} onChange={(e) => setAddr("city", e.target.value)} />
              </Field>
              <Field label="UF">
                <Input
                  maxLength={2}
                  value={f.address.state}
                  onChange={(e) => setAddr("state", e.target.value.toUpperCase())}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Responsável"
          hint={isMinor ? "Obrigatório para menores de idade." : "Opcional para maiores de idade."}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do responsável">
              <Input
                value={f.guardian.full_name}
                onChange={(e) => setGuardian("full_name", e.target.value)}
              />
            </Field>
            <Field label="Parentesco">
              <Select
                value={f.guardian.relationship || undefined}
                onValueChange={(v) => setGuardian("relationship", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {GUARDIAN_RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Telefone do responsável">
              <Input
                inputMode="tel"
                value={f.guardian.phone}
                onChange={(e) => setGuardian("phone", maskPhoneInput(e.target.value))}
              />
            </Field>
            <Field label="E-mail do responsável">
              <Input
                type="email"
                value={f.guardian.email}
                onChange={(e) => setGuardian("email", e.target.value)}
              />
            </Field>
          </div>

          {needsConsent && (
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <Checkbox
                checked={f.consent}
                onCheckedChange={(v) => set("consent", v === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">{FDJ_CONSENT_TEXT}</span>
            </label>
          )}
        </Section>

        <Section title="Observações">
          <Textarea
            rows={3}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anotações internas da secretaria"
          />
        </Section>

        <div className="flex justify-end gap-2 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              initial
                ? navigate({ to: "/membros/$id", params: { id: initial.id } })
                : navigate({ to: "/membros" })
            }
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha                                                               */
/* ------------------------------------------------------------------ */

export function FdjMemberDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pii, setPii] = useState<{ cpf: string | null; rg: string | null } | null>(null);
  const { confirm, dialog } = useConfirmDialog();

  const { data, isPending } = useQuery({
    queryKey: memberKey(id),
    queryFn: () => getFdjMember({ data: { id } }),
  });

  const [account, setAccount] = useState<AccountResult | null>(() => {
    const fresh = freshAccounts.get(id) ?? null;
    freshAccounts.delete(id);
    return fresh;
  });

  const revealMut = useMutation({
    mutationFn: () => getFdjMemberPii({ data: { id } }),
    onSuccess: setPii,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível exibir"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFdjMember({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fdj-members"] });
      toast.success("Ficha excluída");
      void navigate({ to: "/membros" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir"),
  });

  if (isPending) return <PageSkeleton />;
  const m = data?.member;
  if (!m) return <NotFound />;
  const canManage = data.canManage;
  const age = ageFrom(m.birth_date);
  const a = (m.address ?? {}) as Record<string, string>;
  const addressLine = [
    [a.street, a.number].filter(Boolean).join(", "),
    a.complement,
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join("/"),
    a.zip,
  ]
    .filter((s) => s && s.trim())
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={null} />
      <PageHeader
        title={m.full_name}
        subtitle={
          [m.fdj_id ? `ID FDJ ${m.fdj_id}` : null, age !== null ? `${age} anos` : null]
            .filter(Boolean)
            .join(" · ") || "Filha do Bethel"
        }
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/membros/$id/editar" params={{ id: m.id }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
              {!m.user_id && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Excluir ficha?",
                      description: `A ficha de ${m.full_name} será apagada definitivamente. Use apenas para cadastros feitos por engano; para afastamentos, marque como irregular.`,
                    });
                    if (ok) deleteMut.mutate();
                  }}
                  aria-label="Excluir ficha"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="space-y-5">
        <Section title="Dados pessoais" aside={<StatusBadge status={m.status} />}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Item k="Nascimento" v={formatDateBR(m.birth_date)} />
            <Item k="Iniciação" v={formatDateBR(m.initiation_date)} />
            <Item
              k="CPF"
              v={
                pii
                  ? pii.cpf
                    ? maskCpfInput(pii.cpf)
                    : "—"
                  : m.cpf_last2
                    ? formatCpfMask(m.cpf_last2)
                    : "—"
              }
            />
            <Item k="RG" v={pii ? (pii.rg ?? "—") : m.rg_last2 ? formatRgMask(m.rg_last2) : "—"} />
          </dl>
          {canManage && !pii && (m.cpf_last2 || m.rg_last2) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => revealMut.mutate()}
              disabled={revealMut.isPending}
            >
              <Eye className="mr-2 h-4 w-4" />
              Mostrar CPF e RG
            </Button>
          )}
        </Section>

        <AccessSection
          member={m}
          canManage={canManage}
          result={account}
          onCreated={(res) => {
            setAccount(res);
            void qc.invalidateQueries({ queryKey: memberKey(id) });
            void qc.invalidateQueries({ queryKey: ["fdj-members"] });
          }}
        />

        <Section title="Contato">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Item k="Telefone" v={m.phone || "—"} />
            <Item k="E-mail" v={m.email || "—"} />
            <div className="sm:col-span-2">
              <Item k="Endereço" v={addressLine || "—"} />
            </div>
          </dl>
        </Section>

        <Section title="Responsável">
          {m.guardian?.full_name ? (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item k="Nome" v={m.guardian.full_name} />
              <Item k="Parentesco" v={m.guardian.relationship || "—"} />
              <Item k="Telefone" v={m.guardian.phone || "—"} />
              <Item k="E-mail" v={m.guardian.email || "—"} />
              {m.consent_signed_at && (
                <div className="sm:col-span-2">
                  <Item
                    k="Consentimento LGPD"
                    v={`Registrado em ${formatDateBR(m.consent_signed_at)}`}
                  />
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum responsável informado.</p>
          )}
        </Section>

        {m.notes && (
          <Section title="Observações">
            <p className="whitespace-pre-wrap text-sm">{m.notes}</p>
          </Section>
        )}
      </div>

      {dialog}
    </div>
  );
}

function AccessSection({
  member,
  canManage,
  result,
  onCreated,
}: {
  member: FdjMemberRow;
  canManage: boolean;
  result: AccountResult | null;
  onCreated: (res: AccountResult) => void;
}) {
  const [email, setEmail] = useState(member.email ?? "");
  const create = useMutation({
    mutationFn: () => provisionFdjMemberAccount({ data: { id: member.id, email: email.trim() } }),
    onSuccess: (res) => {
      toast.success(res.created ? "Acesso criado" : "Conta existente vinculada");
      onCreated(res);
    },
    onError: (e) => toast.error(e instanceof Error ? zodMessage(e.message) : "Não foi possível"),
  });

  if (!member.user_id && !canManage) return null;

  return (
    <Section
      title="Acesso ao sistema"
      aside={
        member.user_id ? (
          <Badge variant="secondary">Com acesso</Badge>
        ) : (
          <Badge variant="outline">Sem acesso</Badge>
        )
      }
    >
      {result ? (
        <div className="space-y-3 text-sm">
          <p>
            {result.created
              ? "Conta criada. A filha entra com o e-mail e a senha temporária abaixo e troca a senha no primeiro acesso."
              : "Este e-mail já tinha conta; ela foi ligada a esta ficha e ao Bethel com a senha atual."}
          </p>
          {result.temporaryPassword && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <code className="font-mono">{result.temporaryPassword}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(result.temporaryPassword ?? "");
                  toast.success("Senha copiada");
                }}
              >
                Copiar
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            E-mail de boas-vindas:{" "}
            {result.emailStatus === "sent"
              ? "enviado"
              : result.emailStatus === "skipped"
                ? "não enviado"
                : `falhou (${result.emailError ?? "erro"}) — passe a senha diretamente`}
            . Esta senha não aparece de novo.
          </p>
        </div>
      ) : member.user_id ? (
        <p className="text-sm text-muted-foreground">
          Esta filha já entra no sistema com a própria conta ({member.email ?? "e-mail da ficha"}).
        </p>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail da filha"
          />
          <Button type="submit" disabled={create.isPending || !email.trim()}>
            {create.isPending ? "Criando..." : "Criar acesso"}
          </Button>
        </form>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function Item({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm">{v}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "regular" ? "secondary" : "destructive"}>
      {statusLabel(status)}
    </Badge>
  );
}

function BackLink({ to }: { to: { id: string } | null }) {
  const cls =
    "mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground";
  if (to) {
    return (
      <Link to="/membros/$id" params={to} className={cls}>
        <ArrowLeft className="h-4 w-4" />
        Voltar à ficha
      </Link>
    );
  }
  return (
    <Link to="/membros" className={cls}>
      <ArrowLeft className="h-4 w-4" />
      Filhas
    </Link>
  );
}

function NotFound() {
  return (
    <EmptyState
      title="Ficha não encontrada"
      description="Ela pode ter sido excluída ou pertencer a outro Bethel."
      action={
        <Button variant="outline" asChild>
          <Link to="/membros">Voltar para a lista</Link>
        </Button>
      }
    />
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

/** Erros de validação do zod chegam como JSON; mostra só a primeira mensagem. */
function zodMessage(msg: string): string {
  try {
    const parsed = JSON.parse(msg) as { message?: string }[];
    if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message;
  } catch {
    /* mensagem comum */
  }
  return msg;
}

/* ------------------------------------------------------------------ */
/* Perfil da filha (conta logada)                                      */
/* ------------------------------------------------------------------ */

export function FdjMyProfile({
  chapterId,
  header,
  passwordPanel,
}: {
  chapterId: string;
  header: { fullName: string | null; email: string | null };
  passwordPanel: ReactNode;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["my-fdj-fichas"],
    queryFn: () => getMyFdjFichas(),
  });
  const fichas = data?.fichas ?? [];
  const mine = fichas.find((f) => f.chapter_id === chapterId) ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Meu perfil"
        subtitle={
          header.fullName
            ? `${header.fullName}${header.email ? ` · ${header.email}` : ""}`
            : "Seu perfil no Bethel"
        }
      />
      <div className="space-y-5">
        {isPending ? (
          <PageSkeleton />
        ) : mine ? (
          <Section title="Minha ficha" aside={<StatusBadge status={mine.status} />}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item k="Nome" v={mine.full_name} />
              <Item k="ID FDJ" v={mine.fdj_id || "—"} />
              <Item k="Nascimento" v={formatDateBR(mine.birth_date)} />
              <Item k="Iniciação" v={formatDateBR(mine.initiation_date)} />
              <Item k="Telefone" v={mine.phone || "—"} />
              <Item k="E-mail" v={mine.email || "—"} />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Algum dado errado? Peça à secretaria do Bethel para corrigir.
            </p>
          </Section>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground">
            Sua conta ainda não está ligada a uma ficha deste Bethel. Peça à secretaria para abrir a
            sua ficha e usar “Criar acesso” com o seu e-mail.
          </Card>
        )}
        {passwordPanel}
      </div>
    </div>
  );
}
