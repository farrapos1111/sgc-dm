import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { formatBRL, formatDateBR } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
import { createMenu, deleteMenu, listMenus } from "@/lib/hospitality.functions";

export const Route = createFileRoute("/_authenticated/_shell/hospitalaria/cardapios")({
  head: () => ({
    meta: [
      { title: "Cardápios — SG-CDM" },
      { name: "description", content: "Cardápios da hospitalaria do capítulo." },
    ],
  }),
  component: Cardapios,
});

function Cardapios() {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const writable = canManage("hospitalaria");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    menu_date: todayYmd(),
    items: "",
    estimated_cost: 0,
    notes: "",
  });

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ["hospitality-menus", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listMenus({ data: { chapterId: active!.chapter_id } }),
  });

  const create = useMutation({
    mutationFn: () =>
      createMenu({
        data: { chapterId: active!.chapter_id, ...form, estimated_cost: Number(form.estimated_cost) },
      }),
    onSuccess: async () => {
      toast.success("Cardápio salvo");
      setOpen(false);
      setForm({
        title: "",
        menu_date: todayYmd(),
        items: "",
        estimated_cost: 0,
        notes: "",
      });
      await qc.invalidateQueries({ queryKey: ["hospitality-menus"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMenu({ data: { id } }),
    onSuccess: async () => {
      toast.success("Cardápio excluído");
      await qc.invalidateQueries({ queryKey: ["hospitality-menus"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div>
      <PageHeader
        title="Cardápios"
        subtitle="Planejamento das refeições e custos estimados."
        actions={
          writable ? (
            <Button onClick={() => setOpen((v) => !v)} style={{ backgroundColor: active?.chapter.primary_color }}>
              <Plus className="mr-2 h-4 w-4" /> Novo cardápio
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
              <Label className="mb-1.5 block text-sm">Data</Label>
              <Input type="date" value={form.menu_date} onChange={(e) => setForm((f) => ({ ...f, menu_date: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Custo estimado (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.estimated_cost}
                onChange={(e) => setForm((f) => ({ ...f, estimated_cost: Number(e.target.value) }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Itens</Label>
              <Textarea value={form.items} onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))} />
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
              disabled={create.isPending || !form.title.trim()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {create.isPending ? "Salvando…" : "Salvar cardápio"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : menus.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-7 w-7" />}
          title="Nenhum cardápio cadastrado"
          description="Cadastre o cardápio das próximas sessões e eventos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {menus.map((m) => (
            <Card key={m.id} className="rounded-[12px] p-5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{formatDateBR(m.menu_date)}</div>
                </div>
                {writable && (
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              {m.items && <p className="whitespace-pre-line text-sm text-muted-foreground">{m.items}</p>}
              <div className="mt-3 text-sm font-medium">{formatBRL(Number(m.estimated_cost))}</div>
              {m.notes && <p className="mt-2 text-xs text-muted-foreground">{m.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
