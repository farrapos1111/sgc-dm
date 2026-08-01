import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Gavel, Plus, Trash2 } from "lucide-react";
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
import { todayYmd } from "@/lib/timezone";
import {
  createProcess, deleteProcess, listFiles, listProcesses, updateProcess,
} from "@/lib/investigations.functions";

export const Route = createFileRoute("/_authenticated/_shell/sindicancias/processos")({
  head: () => ({
    meta: [
      { title: "Processos de Sindicância — SG-CDM" },
      { name: "description", content: "Acompanhamento dos processos da comissão de sindicâncias." },
    ],
  }),
  component: Processos,
});

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberto",
  em_andamento: "Em andamento",
  aprovada: "Aprovado",
  reprovada: "Reprovado",
  arquivada: "Arquivado",
};

function Processos() {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const writable = canManage("sindicancias");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    file_id: "",
    opened_at: todayYmd(),
    opinion: "",
  });

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ["investigation-processes", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listProcesses({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: files = [] } = useQuery({
    queryKey: ["investigation-files", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listFiles({ data: { chapterId: active!.chapter_id } }),
  });

  const create = useMutation({
    mutationFn: () =>
      createProcess({
        data: {
          chapterId: active!.chapter_id,
          title: form.title,
          file_id: form.file_id || null,
          opened_at: form.opened_at,
          opinion: form.opinion || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Processo aberto");
      setOpen(false);
      setForm({ title: "", file_id: "", opened_at: todayYmd(), opinion: "" });
      await qc.invalidateQueries({ queryKey: ["investigation-processes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status?: any; opinion?: string | null }) => updateProcess({ data: v }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["investigation-processes"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProcess({ data: { id } }),
    onSuccess: async () => {
      toast.success("Processo excluído");
      await qc.invalidateQueries({ queryKey: ["investigation-processes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div>
      <PageHeader
        title="Processos"
        subtitle="Processos de sindicância e seus pareceres."
        actions={
          writable ? (
            <Button onClick={() => setOpen((v) => !v)} style={{ backgroundColor: active?.chapter.primary_color }}>
              <Plus className="mr-2 h-4 w-4" /> Novo processo
            </Button>
          ) : null
        }
      />

      {open && writable && (
        <Card className="mb-6 space-y-4 rounded-[12px] p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Ficha vinculada</Label>
              <Select value={form.file_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, file_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {files.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.candidate_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Abertura</Label>
              <Input type="date" value={form.opened_at} onChange={(e) => setForm((f) => ({ ...f, opened_at: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Parecer inicial</Label>
              <Textarea value={form.opinion} onChange={(e) => setForm((f) => ({ ...f, opinion: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.title.trim()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {create.isPending ? "Salvando…" : "Abrir processo"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : processes.length === 0 ? (
        <EmptyState
          icon={<Gavel className="h-7 w-7" />}
          title="Nenhum processo aberto"
          description="Abra um processo para acompanhar a sindicância de um candidato."
        />
      ) : (
        <div className="space-y-4">
          {processes.map((p) => {
            const file = p.file as unknown as { candidate_name: string } | null;
            return (
              <Card key={p.id} className="rounded-[12px] p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Aberto em {formatDateBR(p.opened_at)}
                      {file ? ` · ${file.candidate_name}` : ""}
                    </div>
                  </div>
                  <Badge variant="secondary">{STATUS_LABELS[p.status] ?? p.status}</Badge>
                </div>
                {p.opinion && <p className="text-sm text-muted-foreground">{p.opinion}</p>}
                {writable && (
                  <div className="mt-4 flex items-center gap-2">
                    <Select value={p.status} onValueChange={(v) => update.mutate({ id: p.id, status: v })}>
                      <SelectTrigger className="h-11 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
