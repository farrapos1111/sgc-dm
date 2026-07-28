import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { formatDateBR } from "@/lib/format";
import { createDuty, deleteDuty, listDuties } from "@/lib/hospitality.functions";

export const Route = createFileRoute("/_authenticated/_shell/hospitalaria/escala")({
  head: () => ({
    meta: [
      { title: "Escala de Serviço — SG-CDM" },
      { name: "description", content: "Escala de serviço da hospitalaria do capítulo." },
    ],
  }),
  component: Escala,
});

function Escala() {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const writable = canManage("hospitalaria");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    member_id: "",
    duty_date: new Date().toISOString().slice(0, 10),
    role_label: "Serviço",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["hospitality-duties", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listDuties({ data: { chapterId: active!.chapter_id } }),
  });

  const duties = data?.duties ?? [];
  const members = data?.members ?? [];

  const create = useMutation({
    mutationFn: () => createDuty({ data: { chapterId: active!.chapter_id, ...form } }),
    onSuccess: async () => {
      toast.success("Escala registrada");
      setOpen(false);
      setForm({ member_id: "", duty_date: new Date().toISOString().slice(0, 10), role_label: "Serviço", notes: "" });
      await qc.invalidateQueries({ queryKey: ["hospitality-duties"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDuty({ data: { id } }),
    onSuccess: async () => {
      toast.success("Escala removida");
      await qc.invalidateQueries({ queryKey: ["hospitality-duties"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div>
      <PageHeader
        title="Escala de Serviço"
        subtitle="Distribuição das funções da hospitalaria."
        actions={
          writable ? (
            <Button onClick={() => setOpen((v) => !v)} style={{ backgroundColor: active?.chapter.primary_color }}>
              <Plus className="mr-2 h-4 w-4" /> Nova escala
            </Button>
          ) : null
        }
      />

      {open && writable && (
        <Card className="mb-6 space-y-4 rounded-[12px] p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-sm">Membro *</Label>
              <Select value={form.member_id} onValueChange={(v) => setForm((f) => ({ ...f, member_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Data</Label>
              <Input type="date" value={form.duty_date} onChange={(e) => setForm((f) => ({ ...f, duty_date: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Função</Label>
              <Input value={form.role_label} onChange={(e) => setForm((f) => ({ ...f, role_label: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.member_id}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {create.isPending ? "Salvando…" : "Salvar escala"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : duties.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-7 w-7" />}
          title="Nenhuma escala definida"
          description="Defina quem serve em cada data da hospitalaria."
        />
      ) : (
        <Card className="divide-y divide-border rounded-[12px]">
          {duties.map((d) => {
            const member = d.member as unknown as { full_name: string } | null;
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{member?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateBR(d.duty_date)} · {d.role_label}
                    {d.notes ? ` · ${d.notes}` : ""}
                  </div>
                </div>
                {writable && (
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(d.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
