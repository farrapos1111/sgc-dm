import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { createEvent } from "@/lib/events.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/eventos/novo")({
  head: () => ({ meta: [{ title: "Novo evento — SG-CDM" }] }),
  component: NovoEvento,
});

function NovoEvento() {
  const { active } = useActiveChapter();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
    goal_amount: 0,
    status: "rascunho" as "rascunho" | "publicado",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Sem capítulo ativo");
      if (!form.name.trim() || !form.starts_at) {
        throw new Error("Preencha nome e data de início");
      }
      return createEvent({
        data: {
          chapter_id: active.chapter_id,
          name: form.name.trim(),
          description: form.description,
          location: form.location,
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
          goal_amount: Number(form.goal_amount) || 0,
          status: form.status,
        },
      });
    },
    onSuccess: async (res) => {
      toast.success("Evento criado");
      await qc.invalidateQueries({ queryKey: ["events"] });
      navigate({ to: "/eventos/$id", params: { id: res.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar"),
  });

  return (
    <div>
      <PageHeader
        title="Novo evento"
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/eventos" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        }
      />

      <Card className="rounded-[12px] p-6 space-y-4">
        <div>
          <Label className="mb-1.5 block text-sm">Nome *</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Descrição</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">Local</Label>
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Meta (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.goal_amount}
              onChange={(e) => setForm((f) => ({ ...f, goal_amount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Início *</Label>
            <Input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Término</Label>
            <Input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ backgroundColor: active?.chapter.primary_color }}
          >
            {mutation.isPending ? "Salvando…" : (<><Check className="mr-2 h-4 w-4" /> Criar evento</>)}
          </Button>
        </div>
      </Card>
    </div>
  );
}
