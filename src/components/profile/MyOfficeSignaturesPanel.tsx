import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import { SignaturePad } from "@/components/investigations/SignaturePad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeBR } from "@/lib/format";
import {
  listMyOfficeSignatures,
  saveOfficeSignature,
  type MyOfficeSignatureRow,
} from "@/lib/office-signatures.functions";

export function MyOfficeSignaturesPanel({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<MyOfficeSignatureRow | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["my-office-signatures", memberId],
    queryFn: () => listMyOfficeSignatures({ data: { memberId } }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || !draft?.trim()) {
        throw new Error("Informe a assinatura (desenho ou PNG).");
      }
      return saveOfficeSignature({
        data: {
          memberId: editing.memberId,
          chapterId: editing.chapterId,
          positionCode: editing.positionCode,
          signatureDataUrl: draft,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Assinatura atualizada");
      setEditing(null);
      setDraft(null);
      await qc.invalidateQueries({
        queryKey: ["my-office-signatures", memberId],
      });
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : "Não foi possível salvar a assinatura",
      ),
  });

  const rows = listQ.data ?? [];

  if (listQ.isLoading) {
    return (
      <Card className="rounded-[12px] p-5">
        <p className="text-sm text-muted-foreground">Carregando assinaturas…</p>
      </Card>
    );
  }

  if (rows.length === 0) return null;

  return (
    <>
      <Card className="rounded-[12px] p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <PenLine className="h-4 w-4" />
          Assinatura digital
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Cargos da vigência atual que usam assinatura. Você pode redesenhar ou
          enviar um PNG com fundo transparente.
        </p>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={`${row.memberId}:${row.chapterId}:${row.positionCode}`}
              className="flex flex-col gap-3 rounded-lg border border-border/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.positionLabel}</span>
                  {row.signatureDataUrl ? (
                    <Badge variant="secondary">Registrada</Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.chapterName}
                  {row.updatedAt
                    ? ` · atualizada em ${formatDateTimeBR(row.updatedAt)}`
                    : ""}
                </div>
                {row.signatureDataUrl ? (
                  <div
                    className="mt-2 inline-flex h-14 max-w-full items-center overflow-hidden rounded-md border border-border px-2"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
                      backgroundSize: "10px 10px",
                      backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
                      backgroundColor: "#fff",
                    }}
                  >
                    <img
                      src={row.signatureDataUrl}
                      alt={`Assinatura de ${row.positionLabel}`}
                      className="max-h-12 max-w-[220px] object-contain"
                    />
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setEditing(row);
                  setDraft(row.signatureDataUrl);
                }}
              >
                {row.signatureDataUrl ? "Atualizar" : "Registrar"}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editing?.signatureDataUrl ? "Atualizar" : "Registrar"} assinatura
            </DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {editing.positionLabel}
                </span>
                {" · "}
                {editing.chapterName}
              </p>
              <SignaturePad
                key={`${editing.memberId}-${editing.chapterId}-${editing.positionCode}-${editing.updatedAt ?? "new"}`}
                label="Sua assinatura"
                value={draft}
                onChange={setDraft}
                disabled={save.isPending}
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={save.isPending}
              onClick={() => {
                setEditing(null);
                setDraft(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={save.isPending || !draft?.trim()}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Salvando…" : "Salvar assinatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
