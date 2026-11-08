import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Pencil, Power, UserPlus } from "lucide-react";
import {
  CONSOLE_ROLES,
  consoleAddChapterUser,
  consoleGetChapter,
  consoleListAudit,
  consoleSetChapterActive,
  consoleProvisionFichaAccount,
  consoleUpdateChapterUser,
} from "@/lib/console/console.functions";
import { createMember } from "@/lib/members.functions";
import { createFdjMember } from "@/lib/fdj-members.functions";
import { realmAbsoluteUrl, isRealm } from "@/lib/realm";
import {
  ActiveBadge,
  AuditList,
  ConsoleTitle,
  RealmTag,
  TempPassword,
  errorText,
  formatDateTime,
} from "@/components/console/console-ui";
import { ChapterFormDialog } from "@/components/console/ChapterFormDialog";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/console/_app/instituicoes/$id")({
  component: ChapterPage,
});

const chapterKey = (id: string) => ["console", "chapter", id] as const;

function ChapterPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: chapterKey(id),
    queryFn: () => consoleGetChapter({ data: { id } }),
  });

  const toggleActive = useMutation({
    mutationFn: (active: boolean) => consoleSetChapterActive({ data: { id, active } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["console"] });
      toast.success("Situação atualizada");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (isPending) return <PageSkeleton />;
  const c = data?.chapter;
  if (!c || !data) {
    return <p className="text-sm text-muted-foreground">Instituição não encontrada.</p>;
  }
  const appUrl = isRealm(c.realm) ? `${realmAbsoluteUrl(c.realm)}/inicio` : null;

  return (
    <div>
      <Link
        to="/console/instituicoes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Instituições
      </Link>
      <ConsoleTitle
        title={`${c.name} nº ${c.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <RealmTag realm={c.realm} orgType={c.org_type} />
            <span>{[c.city, c.state?.uf, c.region?.name].filter(Boolean).join(" · ")}</span>
            <ActiveBadge active={c.active} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: c.active ? "Suspender instituição?" : "Reativar instituição?",
                  description: c.active
                    ? "Ninguém da instituição consegue usar o app enquanto ela estiver suspensa. Nenhum dado é apagado."
                    : "A instituição volta a aparecer para os usuários vinculados.",
                  confirmLabel: c.active ? "Suspender" : "Reativar",
                  destructive: c.active,
                });
                if (ok) toggleActive.mutate(!c.active);
              }}
            >
              <Power className="mr-2 h-4 w-4" /> {c.active ? "Suspender" : "Reativar"}
            </Button>
            {appUrl && (
              <Button variant="ghost" asChild>
                <a href={appUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> App
                </a>
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários ({data.users?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="membros">Membros ({data.members?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsersTab chapterId={id} users={data.users ?? []} />
        </TabsContent>
        <TabsContent value="membros">
          <MembersTab chapterId={id} realm={c.realm} members={data.members ?? []} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoryTab chapterId={id} createdAt={c.created_at} />
        </TabsContent>
      </Tabs>

      {editing && (
        <ChapterFormDialog
          initial={{
            id: c.id,
            name: c.name,
            number: c.number,
            org_type: c.org_type,
            city: c.city,
            state_id: c.state_id,
            region_id: c.region_id,
          }}
          onClose={() => setEditing(false)}
        />
      )}
      {dialog}
    </div>
  );
}

/* ------------------------------ Usuários ------------------------------ */

type UserLink = NonNullable<Awaited<ReturnType<typeof consoleGetChapter>>["users"]>[number];

function UsersTab({ chapterId, users }: { chapterId: string; users: UserLink[] }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const update = useMutation({
    mutationFn: (input: { linkId: string; role?: string; active?: boolean }) =>
      consoleUpdateChapterUser({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chapterKey(chapterId) });
      toast.success("Vínculo atualizado");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card className="mt-3 p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Contas com acesso a esta instituição e o papel base de cada uma.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Vincular
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <Link
              to="/console/pessoas/$userId"
              params={{ userId: u.user_id }}
              className="min-w-0 flex-1 hover:underline"
            >
              <p className="truncate text-sm font-medium">{u.profile?.full_name ?? "Sem nome"}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email ?? u.user_id}</p>
            </Link>
            <div className="flex items-center gap-2">
              <Select
                value={u.role?.name ?? ""}
                onValueChange={(role) => update.mutate({ linkId: u.id, role })}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder={u.role?.label ?? "—"} />
                </SelectTrigger>
                <SelectContent>
                  {CONSOLE_ROLES.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      {r.label}
                    </SelectItem>
                  ))}
                  {u.role && !CONSOLE_ROLES.some((r) => r.name === u.role!.name) && (
                    <SelectItem value={u.role.name}>{u.role.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={u.active ? "ghost" : "secondary"}
                onClick={() => update.mutate({ linkId: u.id, active: !u.active })}
              >
                {u.active ? "Remover acesso" : "Reativar"}
              </Button>
            </div>
          </li>
        ))}
        {!users.length && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            Ninguém vinculado ainda.
          </li>
        )}
      </ul>
      {adding && <AddUserDialog chapterId={chapterId} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddUserDialog({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin_total");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof consoleAddChapterUser>> | null>(
    null,
  );

  const add = useMutation({
    mutationFn: () =>
      consoleAddChapterUser({ data: { chapterId, fullName, email, role, sendEmail } }),
    onSuccess: (res) => {
      setResult(res);
      void qc.invalidateQueries({ queryKey: chapterKey(chapterId) });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular conta</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              {result.created ? "Conta criada" : "Conta existente vinculada"} para{" "}
              <strong>{email}</strong>.
            </p>
            {result.temporaryPassword && <TempPassword value={result.temporaryPassword} />}
            <p className="text-xs text-muted-foreground">
              E-mail:{" "}
              {result.emailStatus === "sent"
                ? "enviado"
                : result.emailStatus === "skipped"
                  ? "não enviado"
                  : `falhou (${result.emailError ?? "erro"})`}
            </p>
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Field label="Nome completo">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Papel">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSOLE_ROLES.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
              Se a conta for nova, enviar e-mail com senha temporária
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Vinculando..." : "Vincular"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Membros ------------------------------- */

type Ficha = NonNullable<Awaited<ReturnType<typeof consoleGetChapter>>["members"]>[number];

function MembersTab({
  chapterId,
  realm,
  members,
}: {
  chapterId: string;
  realm: string | null;
  members: Ficha[];
}) {
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState<Ficha | null>(null);
  const canAdd = realm === "odm" || realm === "fdj";
  return (
    <Card className="mt-3 p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {realm === "fdj"
            ? "Fichas do Bethel (fdj_members)."
            : realm === "loja"
              ? "Fichas da Loja (loja_members). Cadastro pelo Console ainda não disponível."
              : "Fichas ODM afiliadas a esta instituição."}
        </p>
        {canAdd && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Cadastrar
          </Button>
        )}
      </div>
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[m.extra, m.email].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            {m.user_id ? (
              <Link to="/console/pessoas/$userId" params={{ userId: m.user_id }}>
                <Badge variant="outline">com conta</Badge>
              </Link>
            ) : canAdd ? (
              <Button size="sm" variant="outline" onClick={() => setLinking(m)}>
                Criar acesso
              </Button>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                sem conta
              </Badge>
            )}
            <Badge variant={m.status === "regular" ? "secondary" : "destructive"}>{m.status}</Badge>
          </li>
        ))}
        {!members.length && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma ficha.</li>
        )}
      </ul>
      {adding && (
        <AddMemberDialog chapterId={chapterId} realm={realm} onClose={() => setAdding(false)} />
      )}
      {linking && (
        <AccessDialog
          chapterId={chapterId}
          esfera={realm === "fdj" ? "fdj" : "odm"}
          ficha={linking}
          onClose={() => setLinking(null)}
        />
      )}
    </Card>
  );
}

type AccountResult = Awaited<ReturnType<typeof consoleProvisionFichaAccount>>;

function AccountResultView({ email, result }: { email: string; result: AccountResult }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        {result.created
          ? `Conta criada para ${email}, vinculada à ficha e à instituição como membro.`
          : `${email} já tinha conta; foi ligada à ficha e à instituição (papel atual mantido).`}
      </p>
      {result.temporaryPassword && <TempPassword value={result.temporaryPassword} />}
      <p className="text-xs text-muted-foreground">
        E-mail:{" "}
        {result.emailStatus === "sent"
          ? "enviado"
          : result.emailStatus === "skipped"
            ? "não enviado"
            : `falhou (${result.emailError ?? "erro"}) — passe a senha diretamente`}
      </p>
    </div>
  );
}

function AccessDialog({
  chapterId,
  esfera,
  ficha,
  onClose,
}: {
  chapterId: string;
  esfera: "odm" | "fdj";
  ficha: Ficha;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(ficha.email ?? "");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<AccountResult | null>(null);
  const create = useMutation({
    mutationFn: () =>
      consoleProvisionFichaAccount({
        data: { esfera, fichaId: ficha.id, email: email.trim(), sendEmail },
      }),
    onSuccess: (res) => {
      setResult(res);
      void qc.invalidateQueries({ queryKey: chapterKey(chapterId) });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acesso de {ficha.full_name}</DialogTitle>
        </DialogHeader>
        {result ? (
          <>
            <AccountResultView email={email} result={result} />
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field label="E-mail de login">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
              Se a conta for nova, enviar e-mail com senha temporária
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Criando..." : "Criar acesso"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({
  chapterId,
  realm,
  onClose,
}: {
  chapterId: string;
  realm: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [birth, setBirth] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [kind, setKind] = useState<"demolay_ativo" | "senior" | "macom">("demolay_ativo");
  const [withAccount, setWithAccount] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<AccountResult | null>(null);
  const esfera = realm === "fdj" ? "fdj" : "odm";

  const add = useMutation({
    mutationFn: async () => {
      const created =
        esfera === "fdj"
          ? await createFdjMember({
              data: {
                chapter_id: chapterId,
                full_name: fullName,
                birth_date: birth || null,
                fdj_id: identifier,
                email,
                phone,
              } as never,
            })
          : await createMember({
              data: {
                chapter_id: chapterId,
                full_name: fullName,
                birth_date: birth || null,
                email,
                phone,
                demolay_id: identifier || null,
                kind,
                status: "regular",
              } as never,
            });
      if (!withAccount || !email.trim()) return null;
      try {
        return await consoleProvisionFichaAccount({
          data: { esfera, fichaId: created.id, email: email.trim(), sendEmail },
        });
      } catch (e) {
        toast.error(`Ficha salva, mas o acesso não foi criado: ${errorText(e)}`);
        return null;
      }
    },
    onSuccess: (account) => {
      void qc.invalidateQueries({ queryKey: chapterKey(chapterId) });
      toast.success("Ficha cadastrada");
      if (account) setResult(account);
      else onClose();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{result ? "Cadastro concluído" : "Cadastrar membro"}</DialogTitle>
        </DialogHeader>
        {result ? (
          <>
            <AccountResultView email={email} result={result} />
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Field label="Nome completo">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nascimento">
                <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
              </Field>
              <Field label={esfera === "fdj" ? "ID FDJ" : "ID DeMolay"}>
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={withAccount}
                />
              </Field>
              <Field label="Telefone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            {esfera === "odm" && (
              <Field label="Tipo">
                <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demolay_ativo">DeMolay ativo</SelectItem>
                    <SelectItem value="senior">Sênior</SelectItem>
                    <SelectItem value="macom">Maçom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={withAccount}
                  onCheckedChange={(v) => setWithAccount(v === true)}
                />
                Criar acesso ao sistema (conta com este e-mail)
              </label>
              {withAccount && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
                  Enviar e-mail com a senha temporária
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastro rápido. Documentos, endereço e responsável a secretaria completa no app.
              Cargos de administração se dão na aba Usuários.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Histórico ----------------------------- */

function HistoryTab({ chapterId, createdAt }: { chapterId: string; createdAt: string }) {
  const { data } = useQuery({
    queryKey: ["console", "audit", "chapter", chapterId],
    queryFn: () =>
      consoleListAudit({ data: { targetType: "chapter", targetId: chapterId, limit: 100 } }),
  });
  return (
    <Card className="mt-3 px-5 py-2">
      <AuditList items={data?.items ?? []} empty="Nenhuma ação do Console nesta instituição." />
      <p className="border-t border-border py-2 text-xs text-muted-foreground">
        Criada em {formatDateTime(createdAt)}
      </p>
    </Card>
  );
}

/* ------------------------------ Peças --------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
