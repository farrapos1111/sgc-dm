import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  FileDown,
  FolderSearch,
  Gavel,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { formatDateBR } from "@/lib/format";
import { fromAppTzDateTimeLocal, toAppTzDateTimeLocal, todayYmd } from "@/lib/timezone";
import { listMembers } from "@/lib/members.functions";
import { exportInvestigationFilePdf } from "@/lib/investigation-pdf";
import {
  canRevealIdDocuments,
  createFile,
  createSindicanciaFromFile,
  deleteFile,
  getFileForEdit,
  getIdDocumentUrl,
  getSindicanciaTemplates,
  listFiles,
  revealInvestigationPii,
  updateFile,
  updateFileOpinion,
  updateFileStatus,
  uploadInvestigationDoc,
  DEFAULT_SINDICANCIA_PARECER,
  type InvestigationFileRow,
} from "@/lib/investigations.functions";
import {
  emptyInvestigationFile,
  InvestigationFileForm,
  validateInvestigationForm,
  type InvestigationFileFormValue,
} from "@/components/investigations/InvestigationFileForm";
import {
  emptyDocPaths,
  readFilePreview,
  validateDocFile,
  type DocPreviewState,
} from "@/components/investigations/DocumentUploadFields";
import { MemberSearchSelect } from "@/components/investigations/MemberSearchSelect";
import { LEGACY_ID_DOC_LABELS, type IdDocKind, type LegacyIdDocKind } from "@/lib/member-documents";
import { STATUS_LABELS } from "@/lib/investigation-labels";
import { fileToBase64 } from "@/lib/file-to-base64";

export { STATUS_LABELS } from "@/lib/investigation-labels";

export const Route = createFileRoute("/_authenticated/_shell/sindicancias/fichas")({
  head: () => ({
    meta: [
      { title: "Fichas de Sindicância — Templo Virtual" },
      { name: "description", content: "Fichas de candidatos em sindicância." },
    ],
  }),
  component: Fichas,
});

function Fichas() {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const { canScreen } = useChapterAccess();
  const writable =
    canScreen("sindicancias_fichas", "edit") || canManage("sindicancias");
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [keepPii, setKeepPii] = useState({ cpf: false, rg: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "criado_desc" | "criado_asc" | "nome_asc" | "nome_desc" | "status"
  >("criado_desc");
  const [form, setForm] = useState<InvestigationFileFormValue>(emptyInvestigationFile());
  const [docPreviews, setDocPreviews] = useState<DocPreviewState>(emptyDocPaths());
  const [uploadingDoc, setUploadingDoc] = useState<IdDocKind | null>(null);
  const tempIdRef = useRef(crypto.randomUUID());
  const [openSind, setOpenSind] = useState(false);
  const [sindStart, setSindStart] = useState(() =>
    toAppTzDateTimeLocal(fromAppTzDateTimeLocal(`${todayYmd()}T19:00`)),
  );
  const [sindRoles, setSindRoles] = useState({
    senior_member_id: null as string | null,
    investigator_member_id: null as string | null,
    clerk_member_id: null as string | null,
  });
  const [revealed, setRevealed] = useState<{ cpf?: string; rg?: string }>({});
  const [docUrl, setDocUrl] = useState<{
    kind: LegacyIdDocKind;
    url: string;
  } | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["investigation-files", active?.chapter_id],
    enabled: !!active,
    queryFn: (): Promise<InvestigationFileRow[]> =>
      listFiles({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-lite", active?.chapter_id],
    enabled: !!active && (open || !!editId || !!detailId || openSind),
    queryFn: () => listMembers({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: templates } = useQuery({
    queryKey: ["sindicancia-templates", active?.chapter_id],
    enabled: !!active && !!detailId,
    queryFn: () =>
      getSindicanciaTemplates({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: revealAccess } = useQuery({
    queryKey: ["can-reveal-id-docs", active?.chapter_id],
    enabled: !!active && !!detailId,
    queryFn: () =>
      canRevealIdDocuments({ data: { chapterId: active!.chapter_id } }),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = files.filter((f) => filter === "todas" || f.status === filter);
    if (q) {
      list = list.filter((f) => {
        const hay = [
          f.candidate_name,
          f.candidate_email,
          f.candidate_phone,
          f.celular,
          f.guardian_name,
          f.sponsor_text,
          f.referred_by,
          f.notes,
          STATUS_LABELS[f.status],
          f.signup_source === "publico" ? "inscrição pública" : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list = [...list].sort((a, b) => {
      const ca = +new Date(a.created_at);
      const cb = +new Date(b.created_at);
      const na = a.candidate_name.localeCompare(b.candidate_name, "pt-BR");
      if (sort === "criado_asc") return ca - cb;
      if (sort === "criado_desc") return cb - ca;
      if (sort === "nome_asc") return na;
      if (sort === "nome_desc") return -na;
      if (sort === "status") {
        return (STATUS_LABELS[a.status] ?? a.status).localeCompare(
          STATUS_LABELS[b.status] ?? b.status,
          "pt-BR",
        );
      }
      return cb - ca;
    });
    return list;
  }, [files, filter, search, sort]);

  const detail = useMemo(
    () => files.find((f) => f.id === detailId) ?? null,
    [files, detailId],
  );

  const memberOpts = (
    members as Array<{ id: string; full_name: string; kind?: string | null }>
  ).map((m) => ({ id: m.id, full_name: m.full_name, kind: m.kind }));

  async function onDocPick(kind: IdDocKind, file: File) {
    if (!active) return;
    const err = validateDocFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploadingDoc(kind);
    try {
      const preview = await readFilePreview(file);
      const base64 = await fileToBase64(file);
      const res = await uploadInvestigationDoc({
        data: {
          chapterId: active.chapter_id,
          kind,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64,
          tempId: tempIdRef.current,
        },
      });
      setDocPreviews((p) => ({ ...p, [kind]: preview }));
      setForm((f) => ({ ...f, docs: { ...f.docs, [kind]: res.path } }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploadingDoc(null);
    }
  }

  const create = useMutation({
    mutationFn: () => {
      const v = validateInvestigationForm(form);
      if (v) throw new Error(v);
      return createFile({
        data: {
          chapterId: active!.chapter_id,
          candidate_name: form.candidate_name,
          candidate_birth_date: form.candidate_birth_date,
          cpf: form.cpf,
          rg: form.rg,
          candidate_email: form.candidate_email,
          candidate_phone: form.candidate_phone,
          celular: form.celular,
          address: form.address,
          guardians: form.guardians as [
            (typeof form.guardians)[0],
            (typeof form.guardians)[0],
          ],
          sponsor_member_id: form.sponsor_member_id,
          sponsor_text: form.sponsor_text || null,
          sponsor_phone: form.sponsor_phone || null,
          has_demolay_relative: form.has_demolay_relative,
          demolay_relative_name: form.demolay_relative_name || null,
          demolay_relative_chapter: form.demolay_relative_chapter || null,
          has_mason_relative: form.has_mason_relative,
          mason_relative_name: form.mason_relative_name || null,
          mason_relative_lodge: form.mason_relative_lodge || null,
          notes: form.notes,
          docs: {
            rg_front: form.docs.rg_front!,
            rg_back: form.docs.rg_back!,
          },
        },
      });
    },
    onSuccess: async () => {
      toast.success("Ficha criada");
      setOpen(false);
      setForm(emptyInvestigationFile());
      setDocPreviews(emptyDocPaths());
      tempIdRef.current = crypto.randomUUID();
      await qc.invalidateQueries({ queryKey: ["investigation-files"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const saveEdit = useMutation({
    mutationFn: () => {
      if (!editId) throw new Error("Ficha inválida");
      const v = validateInvestigationForm(form, {
        keepCpf: keepPii.cpf,
        keepRg: keepPii.rg,
      });
      if (v) throw new Error(v);
      return updateFile({
        data: {
          id: editId,
          keep_cpf: keepPii.cpf,
          keep_rg: keepPii.rg,
          keep_docs: {
            rg_front: Boolean(form.docs.rg_front),
            rg_back: Boolean(form.docs.rg_back),
          },
          candidate_name: form.candidate_name,
          candidate_birth_date: form.candidate_birth_date,
          cpf: form.cpf || undefined,
          rg: form.rg || undefined,
          candidate_email: form.candidate_email,
          candidate_phone: form.candidate_phone,
          celular: form.celular,
          address: form.address,
          guardians: form.guardians as [
            (typeof form.guardians)[0],
            (typeof form.guardians)[0],
          ],
          sponsor_member_id: form.sponsor_member_id,
          sponsor_text: form.sponsor_text || null,
          sponsor_phone: form.sponsor_phone || null,
          has_demolay_relative: form.has_demolay_relative,
          demolay_relative_name: form.demolay_relative_name || null,
          demolay_relative_chapter: form.demolay_relative_chapter || null,
          has_mason_relative: form.has_mason_relative,
          mason_relative_name: form.mason_relative_name || null,
          mason_relative_lodge: form.mason_relative_lodge || null,
          notes: form.notes,
          docs: {
            rg_front: form.docs.rg_front ?? "",
            rg_back: form.docs.rg_back ?? "",
          },
        },
      });
    },
    onSuccess: async () => {
      toast.success("Ficha atualizada");
      setEditId(null);
      setForm(emptyInvestigationFile());
      setDocPreviews(emptyDocPaths());
      await qc.invalidateQueries({ queryKey: ["investigation-files"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  async function startEdit(id: string) {
    try {
      const data = await getFileForEdit({ data: { id } });
      setForm({
        candidate_name: data.candidate_name,
        candidate_birth_date: data.candidate_birth_date,
        cpf: data.cpf,
        rg: data.rg,
        candidate_email: data.candidate_email,
        candidate_phone: data.candidate_phone,
        celular: data.celular,
        address: data.address,
        guardians: data.guardians,
        sponsor_member_id: data.sponsor_member_id,
        sponsor_text: data.sponsor_text,
        sponsor_phone: data.sponsor_phone,
        has_demolay_relative: data.has_demolay_relative,
        demolay_relative_name: data.demolay_relative_name,
        demolay_relative_chapter: data.demolay_relative_chapter,
        has_mason_relative: data.has_mason_relative,
        mason_relative_name: data.mason_relative_name,
        mason_relative_lodge: data.mason_relative_lodge,
        notes: data.notes,
        docs: {
          rg_front: data.docs.rg_front,
          rg_back: data.docs.rg_back,
        },
      });
      setKeepPii({ cpf: data.keep_cpf, rg: data.keep_rg });
      setDocPreviews(emptyDocPaths());
      tempIdRef.current = crypto.randomUUID();
      setDetailId(null);
      setEditId(id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível editar");
    }
  }

  const setStatus = useMutation({
    mutationFn: (v: {
      id: string;
      status: InvestigationFileRow["status"];
    }) => updateFileStatus({ data: v }),
    onSuccess: async () =>
      qc.invalidateQueries({ queryKey: ["investigation-files"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const saveOpinion = useMutation({
    mutationFn: (opinion: string) =>
      updateFileOpinion({ data: { id: detail!.id, opinion } }),
    onSuccess: async () => {
      toast.success("Parecer salvo");
      await qc.invalidateQueries({ queryKey: ["investigation-files"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar parecer"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFile({ data: { id } }),
    onSuccess: async () => {
      toast.success("Ficha excluída");
      setDetailId(null);
      await qc.invalidateQueries({ queryKey: ["investigation-files"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const openSindicancia = useMutation({
    mutationFn: () =>
      createSindicanciaFromFile({
        data: {
          chapterId: active!.chapter_id,
          fileId: detail!.id,
          start_at: fromAppTzDateTimeLocal(sindStart).toISOString(),
          senior_member_id: sindRoles.senior_member_id,
          investigator_member_id: sindRoles.investigator_member_id,
          clerk_member_id: sindRoles.clerk_member_id,
        },
      }),
    onSuccess: async () => {
      toast.success("Sindicância criada no calendário");
      setOpenSind(false);
      setSindRoles({
        senior_member_id: null,
        investigator_member_id: null,
        clerk_member_id: null,
      });
      setSindStart(
        toAppTzDateTimeLocal(fromAppTzDateTimeLocal(`${todayYmd()}T19:00`)),
      );
      await qc.invalidateQueries({ queryKey: ["sindicancias"] });
      await qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao criar sindicância"),
  });

  const [opinionDraft, setOpinionDraft] = useState("");

  function openDetail(id: string) {
    const f = files.find((x) => x.id === id);
    setDetailId(id);
    setOpinionDraft(f?.opinion ?? "");
    setRevealed({});
    setDocUrl(null);
  }

  function insertParecerTemplate() {
    const tpl = templates?.parecer || DEFAULT_SINDICANCIA_PARECER;
    const text = tpl
      .replaceAll("[indicado]", detail?.candidate_name ?? "")
      .replaceAll("[capítulo]", active?.chapter.name ?? "")
      .replaceAll("[capitulo]", active?.chapter.name ?? "")
      .replaceAll("[data]", formatDateBR(todayYmd()));
    setOpinionDraft(text);
  }

  async function revealField(field: "cpf" | "rg") {
    if (!detail) return;
    try {
      const res = await revealInvestigationPii({
        data: { fileId: detail.id, field },
      });
      setRevealed((r) => ({ ...r, [field]: res.value }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sem permissão");
    }
  }

  async function viewDoc(kind: LegacyIdDocKind) {
    if (!detail) return;
    try {
      const res = await getIdDocumentUrl({
        data: { entity: "investigation", id: detail.id, docKind: kind },
      });
      if (!res.url) {
        toast.error("Documento não disponível");
        return;
      }
      setDocUrl({ kind, url: res.url });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sem permissão");
    }
  }

  async function downloadPdf() {
    if (!detail || !active) return;
    await exportInvestigationFilePdf({
      chapterName: active.chapter.name,
      chapterCity: active.chapter.city,
      logoPath: active.chapter.logo_url,
      candidate_name: detail.candidate_name,
      candidate_birth_date: detail.candidate_birth_date,
      cpf: revealed.cpf ?? (detail.cpf_last2 ? `•••${detail.cpf_last2}` : null),
      rg: revealed.rg ?? (detail.rg_last2 ? `•••${detail.rg_last2}` : null),
      candidate_email: detail.candidate_email,
      candidate_phone: detail.candidate_phone,
      celular: detail.celular,
      address: detail.address as never,
      guardians: detail.guardians as never,
      sponsor: detail.sponsor_text ?? detail.referred_by,
      has_demolay_relative: detail.has_demolay_relative,
      demolay_relative_name: detail.demolay_relative_name,
      demolay_relative_chapter: detail.demolay_relative_chapter,
      has_mason_relative: detail.has_mason_relative,
      mason_relative_name: detail.mason_relative_name,
      mason_relative_lodge: detail.mason_relative_lodge,
      notes: detail.notes,
      opinion: detail.opinion,
      status: STATUS_LABELS[detail.status] ?? detail.status,
      created_at: detail.created_at,
    });
  }

  return (
    <div>
      <PageHeader
        title="Fichas"
        subtitle="Pré-cadastro de candidatos à sindicância."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/sindicancias/config">Configurações</Link>
            </Button>
            {writable ? (
              <Button
                onClick={() => {
                  setForm(emptyInvestigationFile());
                  setDocPreviews(emptyDocPaths());
                  tempIdRef.current = crypto.randomUUID();
                  setOpen(true);
                }}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nova ficha
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Pesquisar nome, e-mail, padrinho…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) =>
            setSort(
              v as
                | "criado_desc"
                | "criado_asc"
                | "nome_asc"
                | "nome_desc"
                | "status",
            )
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="criado_desc">Mais recentes</SelectItem>
            <SelectItem value="criado_asc">Mais antigas</SelectItem>
            <SelectItem value="nome_asc">Nome (A–Z)</SelectItem>
            <SelectItem value="nome_desc">Nome (Z–A)</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FolderSearch className="h-7 w-7" />}
          title={files.length === 0 ? "Nenhuma ficha" : "Nenhum resultado"}
          description={
            files.length === 0
              ? "Crie uma ficha ou compartilhe o link público de inscrição."
              : "Ajuste a pesquisa ou os filtros."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((f) => (
            <li key={f.id}>
              <Card className="rounded-[12px] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => openDetail(f.id)}
                  >
                    <div className="font-medium">{f.candidate_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.candidate_birth_date
                        ? formatDateBR(f.candidate_birth_date)
                        : "Nascimento —"}
                      {f.signup_source === "publico" ? " · Inscrição pública" : ""}
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {STATUS_LABELS[f.status] ?? f.status}
                    </Badge>
                    {writable && (
                      <Select
                        value={f.status}
                        onValueChange={(v) =>
                          setStatus.mutate({
                            id: f.id,
                            status: v as typeof f.status,
                          })
                        }
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
                        title="Editar"
                        onClick={() => void startEdit(f.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {writable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Excluir ficha?",
                            description: "Excluir esta ficha?",
                            confirmLabel: "Excluir",
                          });
                          if (ok) remove.mutate(f.id);
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
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-2xl md:max-w-4xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Nova ficha</DialogTitle>
          </DialogHeader>
          <InvestigationFileForm
            value={form}
            onChange={(p) => setForm((f) => ({ ...f, ...p }))}
            members={memberOpts}
            docPreviews={docPreviews}
            uploadingDoc={uploadingDoc}
            onDocPick={onDocPick}
            onDocClear={(kind) => {
              setDocPreviews((p) => ({ ...p, [kind]: null }));
              setForm((f) => ({ ...f, docs: { ...f.docs, [kind]: null } }));
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={create.isPending}
              onClick={() => create.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {create.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editId}
        onOpenChange={(o) => {
          if (!o) {
            setEditId(null);
            setForm(emptyInvestigationFile());
            setDocPreviews(emptyDocPaths());
            setKeepPii({ cpf: false, rg: false });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-2xl md:max-w-4xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Editar ficha</DialogTitle>
          </DialogHeader>
          {(keepPii.cpf || keepPii.rg) && (
            <p className="text-xs text-muted-foreground">
              CPF/RG mascarados: deixe em branco para manter o valor atual, ou
              preencha para substituir.
            </p>
          )}
          <InvestigationFileForm
            value={form}
            onChange={(p) => setForm((f) => ({ ...f, ...p }))}
            members={memberOpts}
            docPreviews={docPreviews}
            uploadingDoc={uploadingDoc}
            onDocPick={onDocPick}
            onDocClear={(kind) => {
              setDocPreviews((p) => ({ ...p, [kind]: null }));
              setForm((f) => ({ ...f, docs: { ...f.docs, [kind]: null } }));
            }}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditId(null);
                setForm(emptyInvestigationFile());
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={saveEdit.isPending}
              onClick={() => saveEdit.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {saveEdit.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.candidate_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Status: {STATUS_LABELS[detail.status] ?? detail.status}
                  {detail.candidate_email ? ` · ${detail.candidate_email}` : ""}
                </p>
                <p>
                  {[detail.candidate_phone, detail.celular]
                    .filter(Boolean)
                    .join(" · ") || "Sem telefone"}
                </p>
                <p>
                  Padrinho / Indicado por:{" "}
                  {detail.sponsor_text || detail.referred_by || "—"}
                </p>
              </div>

              <div className="space-y-2 rounded-[12px] border border-border/70 p-3">
                <p className="text-sm font-medium">CPF / RG</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span>
                    CPF:{" "}
                    {revealed.cpf ??
                      (detail.cpf_last2 ? `•••${detail.cpf_last2}` : "—")}
                  </span>
                  {revealAccess?.allowed && detail.has_cpf && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revealField("cpf")}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> Revelar
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span>
                    RG:{" "}
                    {revealed.rg ??
                      (detail.rg_last2 ? `•••${detail.rg_last2}` : "—")}
                  </span>
                  {revealAccess?.allowed && detail.has_rg && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revealField("rg")}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> Revelar
                    </Button>
                  )}
                </div>
                {revealAccess?.allowed && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(
                      Object.keys(LEGACY_ID_DOC_LABELS) as LegacyIdDocKind[]
                    )
                      .filter((k) => detail.docs[k])
                      .map((kind) => (
                      <Button
                        key={kind}
                        size="sm"
                        variant="secondary"
                        onClick={() => viewDoc(kind)}
                      >
                        {LEGACY_ID_DOC_LABELS[kind]}
                      </Button>
                    ))}
                  </div>
                )}
                {docUrl && (
                  <div className="pt-2">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {LEGACY_ID_DOC_LABELS[docUrl.kind]} (acesso registrado)
                    </p>
                    <img
                      src={docUrl.url}
                      alt={LEGACY_ID_DOC_LABELS[docUrl.kind]}
                      className="max-h-64 w-full rounded-md object-contain"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Parecer da Sindicância</Label>
                  {writable && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={insertParecerTemplate}
                    >
                      Inserir modelo
                    </Button>
                  )}
                </div>
                <Textarea
                  rows={8}
                  value={opinionDraft}
                  disabled={!writable}
                  onChange={(e) => setOpinionDraft(e.target.value)}
                />
                {writable && (
                  <Button
                    size="sm"
                    onClick={() => saveOpinion.mutate(opinionDraft)}
                    disabled={saveOpinion.isPending}
                  >
                    Salvar parecer
                  </Button>
                )}
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadPdf()}>
                    <FileDown className="mr-2 h-4 w-4" /> PDF
                  </Button>
                  {writable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void startEdit(detail.id)}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                  )}
                  {writable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenSind(true)}
                    >
                      <Gavel className="mr-2 h-4 w-4" /> Abrir sindicância
                    </Button>
                  )}
                </div>
                <Button variant="ghost" onClick={() => setDetailId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openSind} onOpenChange={setOpenSind}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir sindicância</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-sm">Início</Label>
              <Input
                type="datetime-local"
                value={sindStart}
                onChange={(e) => setSindStart(e.target.value)}
              />
            </div>
            <MemberSearchSelect
              label="Tio / Senior"
              members={memberOpts}
              kinds={["senior", "macom"]}
              memberId={sindRoles.senior_member_id}
              placeholder="Buscar Senior ou Tio…"
              hint="Somente membros Senior ou Maçom (Tio)."
              onChange={(id) =>
                setSindRoles((r) => ({ ...r, senior_member_id: id }))
              }
            />
            <MemberSearchSelect
              label="Sindicante"
              members={memberOpts}
              memberId={sindRoles.investigator_member_id}
              placeholder="Buscar membro…"
              onChange={(id) =>
                setSindRoles((r) => ({ ...r, investigator_member_id: id }))
              }
            />
            <MemberSearchSelect
              label="Escrivão de Parecer"
              members={memberOpts}
              memberId={sindRoles.clerk_member_id}
              placeholder="Buscar membro…"
              onChange={(id) =>
                setSindRoles((r) => ({ ...r, clerk_member_id: id }))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenSind(false)}>
              Cancelar
            </Button>
            <Button
              disabled={openSindicancia.isPending}
              onClick={() => openSindicancia.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {openSindicancia.isPending ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
