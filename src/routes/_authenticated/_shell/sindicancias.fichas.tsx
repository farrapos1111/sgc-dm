import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderSearch, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { formatDateBR } from "@/lib/format";
import { createFile, deleteFile, listFiles, updateFileStatus } from "@/lib/investigations.functions";

export const Route = createFileRoute("/_authenticated/_shell/sindicancias/fichas")({
  head: () => ({
    meta: [
      { title: "Fichas de Sindicância — SG-CDM" },
      { name: "description", content: "Fichas de candidatos em sindicância." },
    ],
  }),
  component: Fichas,
});

export const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  arquivada: "Arquivada",
};

function Fichas() {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const writable = canManage("sindicancias");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("todas");
  const [form, setForm] = useState({
    candidate_name: "",
    candidate_birth_date: "",
    candidate_phone: "",
    candidate_email: "",
    guardian_name: "",
    referred_by: "",
    notes: "",
  });

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["investigation-files", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listFiles({ data: { chapterId: active!.chapter_id } }),
  });

  const visible = files.filter((f) => filter === "todas" || f.status === filter);

  const create = useMutation({
    mutationFn: () => createFile({ data: { chapterId: active!.chapter_id, ...form } }),
    onSuccess: async () => {
      toast.success("Ficha criada");
      setOpen(false);
      setForm({
        candidate_name: "", candidate_birth_date: "", candidate_phone: "",
        candidate_email: "", guardian_name: "", referred_by: "", notes: "",
      });
      await qc.invalidateQueries({ queryKey: ["investigation-files"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: any }) => updateFileStatus({ data: v }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["investigation-files"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFile({ data: { id } }),
    onSuccess: async () => {
      toast.success("Ficha excluída");
      await qc.invalidateQueries({ queryKey: ["investigation-files"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div>
      <PageHeader
        title="Fichas"
        subtitle="Candidatos em processo de sindicância."
        actions={
          writable ? (
            <Button onClick={() => setOpen((v) => !v)} style={{ backgroundColor: active?.chapter.primary_color }}>
              <Plus className="mr-2 h-4 w-4" /> Nova ficha
            </Button>
          ) : null
        }
      />

      <div className="mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {open && writable && (
        <Card className="mb-6 space-y-4 rounded-[12px] p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Nome do candidato *</Label>
              <Input value={form.candidate_name} onChange={(e) => setForm((f) => ({ ...f, candidate_name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Nascimento</Label>
              <Input type="date" value={form.candidate_birth_date} onChange={(e) => setForm((f) => ({ ...f, candidate_birth_date: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Telefone</Label>
              <Input value={form.candidate_phone} onChange={(e) => setForm((f) => ({ ...f, candidate_phone: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">E-mail</Label>
              <Input value={form.candidate_email} onChange={(e) => setForm((f) => ({ ...f, candidate_email: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Responsável</Label>
              <Input value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Indicado por</Label>
              <Input value={form.referred_by} onChange={(e) => setForm((f) => ({ ...f, referred_by: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.candidate_name.trim()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {create.isPending ? "Salvando…" : "Salvar ficha"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FolderSearch className="h-7 w-7" />}
          title="Nenhuma ficha cadastrada"
          description="As fichas de candidatos aparecerão aqui."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((f) => (
            <Card key={f.id} className="rounded-[12px] p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{f.candidate_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.candidate_birth_date ? formatDateBR(f.candidate_birth_date) : "—"}
                    {f.referred_by ? ` · indicado por ${f.referred_by}` : ""}
                  </div>
                </div>
                <Badge variant="secondary">{STATUS_LABELS[f.status] ?? f.status}</Badge>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {f.candidate_phone && <div>{f.candidate_phone}</div>}
                {f.candidate_email && <div className="truncate">{f.candidate_email}</div>}
                {f.guardian_name && <div>Responsável: {f.guardian_name}</div>}
                {f.notes && <p className="pt-1 text-foreground">{f.notes}</p>}
              </div>
              {writable && (
                <div className="mt-4 flex items-center gap-2">
                  <Select value={f.status} onValueChange={(v) => setStatus.mutate({ id: f.id, status: v })}>
                    <SelectTrigger className="h-11 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
