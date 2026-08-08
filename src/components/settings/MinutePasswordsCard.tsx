import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { canManageMinutePasswordsAccess } from "@/lib/permissions";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { updateMinutePasswords } from "@/lib/chapter.functions";
import {
  MINUTE_KINDS,
  MINUTE_KIND_LABELS,
  parseMinutePasswords,
  type MinutePasswords,
} from "@/lib/minute-kinds";

/** Senhas do link público da ata, por tipo — só Escrivão, PCC e MC. */
export function MinutePasswordsCard() {
  const { active, refetch } = useActiveChapter();
  const { ctx } = useChapterAccess();
  const allowed = canManageMinutePasswordsAccess(ctx);
  const saved = parseMinutePasswords(
    (active?.chapter as { settings?: Record<string, unknown> } | undefined)
      ?.settings,
  );
  const [passwords, setPasswords] = useState<MinutePasswords>(saved);

  useEffect(() => {
    setPasswords(saved);
  }, [saved.publica, saved.grau_iniciatico, saved.grau_demolay]);

  const dirty = MINUTE_KINDS.some(
    (k) => passwords[k].trim() !== saved[k].trim(),
  );

  const save = useMutation({
    mutationFn: () =>
      updateMinutePasswords({
        data: {
          chapter_id: active!.chapter_id,
          passwords: {
            publica: passwords.publica,
            grau_iniciatico: passwords.grau_iniciatico,
            grau_demolay: passwords.grau_demolay,
          },
        },
      }),
    onSuccess: async () => {
      toast.success("Senhas das atas salvas");
      await refetch();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  if (!allowed) return null;

  return (
    <Card className="rounded-[12px] p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lock className="h-5 w-5" /> Senhas das atas
      </div>
      <p className="text-sm text-muted-foreground">
        Senhas do link público por tipo de ata (visitantes e feedback).
        Membros com grau adequado entram com ID DeMolay, sem senha. Visível
        apenas para Escrivão, Presidente do Conselho e Mestre Conselheiro.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {MINUTE_KINDS.map((kind) => (
          <div key={kind}>
            <Label htmlFor={`minute-pw-${kind}`} className="mb-1.5 block text-xs">
              {MINUTE_KIND_LABELS[kind]}
            </Label>
            <Input
              id={`minute-pw-${kind}`}
              type="password"
              autoComplete="new-password"
              value={passwords[kind]}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, [kind]: e.target.value }))
              }
              placeholder="Definir senha"
            />
          </div>
        ))}
      </div>
      <Button
        style={{ backgroundColor: "var(--chapter-primary)" }}
        disabled={save.isPending || !dirty}
        onClick={() => save.mutate()}
      >
        <Save className="mr-2 h-4 w-4" />
        {save.isPending ? "Salvando…" : "Salvar senhas"}
      </Button>
    </Card>
  );
}
