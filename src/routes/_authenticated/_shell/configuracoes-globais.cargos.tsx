import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import {
  listPositionCatalog,
  removeCatalogPositionFromOrgType,
  reorderCatalogPositions,
  upsertCatalogPosition,
  type CatalogPosition,
  type PositionOrgTypeRow,
} from "@/lib/position-catalog.functions";
import {
  ORG_TYPE_FILTER_LABELS,
  ORG_TYPES_UI,
  ROLE_GROUPS,
  ROLE_GROUP_LABELS,
  orgTypeHasRoleGroups,
  type OrgType,
  type OrgTypeUi,
  type RoleGroup,
} from "@/lib/org-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/_shell/configuracoes-globais/cargos",
)({
  head: () => ({
    meta: [
      { title: "Cargos globais — Templo Virtual" },
      {
        name: "description",
        content:
          "Catálogo de cargos designáveis a membros (mesmo da Gestão), por tipo de instituição.",
      },
    ],
  }),
  component: CargosGlobaisPage,
});

type ListKey = string;

function listKey(orgType: OrgType, roleGroup: RoleGroup | null): ListKey {
  return `${orgType}|${roleGroup ?? "flat"}`;
}

function CargosGlobaisPage() {
  const { isAdminTotal } = useChapterAccess();
  const qc = useQueryClient();

  const catalogQ = useQuery({
    queryKey: ["position-catalog"],
    enabled: isAdminTotal,
    queryFn: () => listPositionCatalog(),
  });

  const positions = catalogQ.data?.positions ?? [];
  const positionOrgTypes = catalogQ.data?.positionOrgTypes ?? [];

  const positionById = useMemo(() => {
    const m = new Map<number, CatalogPosition>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  const [orgType, setOrgType] = useState<OrgTypeUi>("capitulo");
  const [createCtx, setCreateCtx] = useState<{
    orgType: OrgType;
    roleGroup: RoleGroup | null;
  } | null>(null);
  const [editPos, setEditPos] = useState<{
    position: CatalogPosition;
    orgType: OrgType;
    roleGroup: RoleGroup | null;
  } | null>(null);
  const [deleteCtx, setDeleteCtx] = useState<{
    positionId: number;
    orgType: OrgType;
    label: string;
  } | null>(null);

  const [formLabel, setFormLabel] = useState("");
  const [orderOverride, setOrderOverride] = useState<
    Record<ListKey, number[]>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function scopesFor(
    ot: OrgType,
    group: RoleGroup | null,
  ): PositionOrgTypeRow[] {
    return positionOrgTypes
      .filter((x) => {
        if (x.org_type !== ot) return false;
        if (group == null) return x.role_group == null;
        return x.role_group === group;
      })
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function idsForList(ot: OrgType, group: RoleGroup | null): number[] {
    const key = listKey(ot, group);
    if (orderOverride[key]) return orderOverride[key]!;
    return scopesFor(ot, group)
      .map((s) => s.position_id)
      .filter((id) => positionById.has(id));
  }

  const upsertMut = useMutation({
    mutationFn: () => {
      if (editPos) {
        return upsertCatalogPosition({
          data: {
            id: editPos.position.id,
            label: formLabel.trim(),
            orgType: editPos.orgType,
            roleGroup: editPos.roleGroup,
          },
        });
      }
      if (!createCtx) throw new Error("Contexto ausente");
      return upsertCatalogPosition({
        data: {
          label: formLabel.trim(),
          orgType: createCtx.orgType,
          roleGroup: createCtx.roleGroup,
        },
      });
    },
    onSuccess: async () => {
      toast.success(editPos ? "Cargo atualizado" : "Cargo criado");
      setCreateCtx(null);
      setEditPos(null);
      setOrderOverride({});
      await qc.invalidateQueries({ queryKey: ["position-catalog"] });
      await qc.invalidateQueries({ queryKey: ["org-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (args: { positionId: number; orgType: OrgType }) =>
      removeCatalogPositionFromOrgType({ data: args }),
    onSuccess: async () => {
      toast.success("Cargo removido");
      setDeleteCtx(null);
      setOrderOverride({});
      await qc.invalidateQueries({ queryKey: ["position-catalog"] });
      await qc.invalidateQueries({ queryKey: ["org-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: (args: {
      orgType: OrgType;
      roleGroup: RoleGroup | null;
      orderedPositionIds: number[];
    }) => reorderCatalogPositions({ data: args }),
    onError: (e: Error) => {
      toast.error(e.message);
      setOrderOverride({});
      void qc.invalidateQueries({ queryKey: ["position-catalog"] });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["position-catalog"] });
      await qc.invalidateQueries({ queryKey: ["org-catalog"] });
      setOrderOverride({});
    },
  });

  function openCreate(ot: OrgType, group: RoleGroup | null) {
    setEditPos(null);
    setFormLabel("");
    setCreateCtx({ orgType: ot, roleGroup: group });
  }

  function openEdit(
    position: CatalogPosition,
    ot: OrgType,
    group: RoleGroup | null,
  ) {
    setCreateCtx(null);
    setEditPos({ position, orgType: ot, roleGroup: group });
    setFormLabel(position.label);
  }

  function onDragEnd(
    ot: OrgType,
    group: RoleGroup | null,
    event: DragEndEvent,
  ) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = idsForList(ot, group);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    setOrderOverride((prev) => ({ ...prev, [listKey(ot, group)]: next }));
    reorderMut.mutate({
      orgType: ot,
      roleGroup: group,
      orderedPositionIds: next,
    });
  }

  if (!isAdminTotal) {
    return (
      <div>
        <PageHeader title="Cargos" subtitle="Acesso restrito" />
        <EmptyState
          title="Sem permissão"
          description="Apenas Administradores Totais podem configurar o catálogo de cargos."
        />
      </div>
    );
  }

  const dialogOpen = createCtx != null || editPos != null;

  return (
    <div>
      <PageHeader
        title="Cargos"
        subtitle="Mesmo catálogo da Gestão → Cargos e Comissões. Adicione funções designáveis a membros."
      />

      <Tabs
        value={orgType}
        onValueChange={(v) => {
          setOrgType(v as OrgTypeUi);
          setOrderOverride({});
        }}
      >
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          {ORG_TYPES_UI.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs">
              {ORG_TYPE_FILTER_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        {ORG_TYPES_UI.map((t) => (
          <TabsContent key={t} value={t} className="mt-0">
            {catalogQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : orgTypeHasRoleGroups(t) ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {ROLE_GROUPS.map((group) => (
                  <PositionListCard
                    key={group}
                    title={ROLE_GROUP_LABELS[group]}
                    orgType={t}
                    roleGroup={group}
                    positionIds={idsForList(t, group)}
                    positionById={positionById}
                    sensors={sensors}
                    onDragEnd={(e) => onDragEnd(t, group, e)}
                    onAdd={() => openCreate(t, group)}
                    onEdit={(p) => openEdit(p, t, group)}
                    onDelete={(p) =>
                      setDeleteCtx({
                        positionId: p.id,
                        orgType: t,
                        label: p.label,
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <PositionListCard
                title={`Cargos — ${ORG_TYPE_FILTER_LABELS[t]}`}
                orgType={t}
                roleGroup={null}
                positionIds={idsForList(t, null)}
                positionById={positionById}
                sensors={sensors}
                onDragEnd={(e) => onDragEnd(t, null, e)}
                onAdd={() => openCreate(t, null)}
                onEdit={(p) => openEdit(p, t, null)}
                onDelete={(p) =>
                  setDeleteCtx({
                    positionId: p.id,
                    orgType: t,
                    label: p.label,
                  })
                }
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreateCtx(null);
            setEditPos(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editPos ? "Editar cargo" : "Novo cargo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {ORG_TYPE_FILTER_LABELS[
                (createCtx?.orgType ?? editPos?.orgType)!
              ]}
              {(createCtx?.roleGroup ?? editPos?.roleGroup)
                ? ` · ${ROLE_GROUP_LABELS[(createCtx?.roleGroup ?? editPos?.roleGroup)!]}`
                : ""}
            </p>
            <div>
              <Label htmlFor="pos-label">Nome</Label>
              <Input
                id="pos-label"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="ex.: Mestre de Cerimônias"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                O código interno é gerado automaticamente a partir do nome.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateCtx(null);
                setEditPos(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!formLabel.trim() || upsertMut.isPending}
              onClick={() => upsertMut.mutate()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteCtx != null}
        onOpenChange={(o) => {
          if (!o) setDeleteCtx(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cargo?</AlertDialogTitle>
            <AlertDialogDescription>
              Remover “{deleteCtx?.label}” de{" "}
              {deleteCtx
                ? ORG_TYPE_FILTER_LABELS[deleteCtx.orgType]
                : ""}
              . Deixa de aparecer na Gestão deste tipo. Se não estiver em outro
              tipo e não for de sistema, o cargo é excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteCtx &&
                removeMut.mutate({
                  positionId: deleteCtx.positionId,
                  orgType: deleteCtx.orgType,
                })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PositionListCard({
  title,
  orgType,
  roleGroup,
  positionIds,
  positionById,
  sensors,
  onDragEnd,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  orgType: OrgType;
  roleGroup: RoleGroup | null;
  positionIds: number[];
  positionById: Map<number, CatalogPosition>;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
  onAdd: () => void;
  onEdit: (p: CatalogPosition) => void;
  onDelete: (p: CatalogPosition) => void;
}) {
  return (
    <Card className="rounded-[12px] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {positionIds.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Nenhum cargo. Adicione funções designáveis a membros.
        </p>
      ) : (
        <DndContext
          id={`${orgType}-${roleGroup ?? "flat"}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={positionIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1.5">
              {positionIds.map((id) => {
                const pos = positionById.get(id);
                if (!pos) return null;
                return (
                  <SortablePositionRow
                    key={id}
                    position={pos}
                    onEdit={() => onEdit(pos)}
                    onDelete={() => onDelete(pos)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  );
}

function SortablePositionRow({
  position,
  onEdit,
  onDelete,
}: {
  position: CatalogPosition;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: position.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1.5",
        isDragging && "z-10 opacity-90 shadow-md",
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm font-medium"
        onClick={onEdit}
      >
        {position.label}
      </button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 shrink-0 px-2 text-destructive"
        title="Remover"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
