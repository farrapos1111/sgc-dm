import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { consoleLookups, consoleSaveChapter } from "@/lib/console/console.functions";
import { ORG_TYPES, ORG_TYPE_LABELS, normalizeOrgType, type OrgType } from "@/lib/org-types";
import { errorText } from "@/components/console/console-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type ChapterFormInitial = {
  id: string;
  name: string;
  number: string;
  org_type: string;
  city: string | null;
  state_id: string;
  region_id: string | null;
};

export function ChapterFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: ChapterFormInitial | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: lookups } = useQuery({
    queryKey: ["console", "lookups"],
    queryFn: () => consoleLookups(),
    staleTime: 5 * 60_000,
  });
  const [name, setName] = useState(initial?.name ?? "");
  const [number, setNumber] = useState(initial?.number ?? "");
  const [orgType, setOrgType] = useState<OrgType>(
    normalizeOrgType(initial?.org_type ?? "capitulo"),
  );
  const [city, setCity] = useState(initial?.city ?? "");
  const [stateId, setStateId] = useState(initial?.state_id ?? "");
  const [regionId, setRegionId] = useState(initial?.region_id ?? "none");
  const regions = (lookups?.regions ?? []).filter((r) => r.state_id === stateId);

  const save = useMutation({
    mutationFn: () =>
      consoleSaveChapter({
        data: {
          id: initial?.id,
          name,
          number,
          org_type: orgType,
          city: city || null,
          state_id: stateId,
          region_id: regionId === "none" ? null : regionId,
        },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["console"] });
      toast.success(initial ? "Instituição atualizada" : "Instituição criada");
      onClose();
      onSaved?.(res.id);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar instituição" : "Nova instituição"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Número">
              <Input value={number} onChange={(e) => setNumber(e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={orgType} onValueChange={(v) => setOrgType(v as OrgType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ORG_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cidade">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Estado">
              <Select
                value={stateId}
                onValueChange={(v) => {
                  setStateId(v);
                  setRegionId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(lookups?.states ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Região">
              <Select value={regionId} onValueChange={setRegionId} disabled={!stateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem região</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {initial && normalizeOrgType(initial.org_type) !== orgType && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Mudar o tipo pode trocar a esfera da instituição (ODM / FDJ / Loja). As fichas já
              cadastradas continuam na tabela da esfera antiga.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !stateId}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
