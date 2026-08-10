import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { updateChaveTemplate } from "@/lib/chapter.functions";
import {
  CHAVE_VARIABLES,
  DEFAULT_CHAVE_TEMPLATE,
  chavePreviewItem,
  chaveValues,
  renderChaveTemplate,
} from "@/lib/chave-do-dia";
import { MinuteBodyEditor } from "@/components/minutes/MinuteBodyEditor";
import { KeyRound, RotateCcw, Save } from "lucide-react";

const CHAVE_VAR_TOKENS = CHAVE_VARIABLES.map((v) => `[${v.key}]`);

/** Editor do modelo padrão da "chave do dia", com variáveis dinâmicas. */
export function ChaveTemplateCard() {
  const { active, refetch } = useActiveChapter();
  const { can } = useChapterAccess();
  const isAdmin = can("admin") || can("secretaria");
  const saved =
    ((active?.chapter as any)?.settings?.chave_template as string | undefined) ??
    DEFAULT_CHAVE_TEMPLATE;

  const [template, setTemplate] = useState(saved);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTemplate(saved);
  }, [saved]);

  const preview = useMemo(() => {
    const item = chavePreviewItem();
    return renderChaveTemplate(
      template,
      chaveValues(item, { chapterName: active?.chapter.name ?? "" }),
    );
  }, [template, active?.chapter.name]);

  function insertVar(key: string) {
    if (!isAdmin) return;
    const el = areaRef.current;
    const token = `[${key}]`;
    if (!el) {
      setTemplate((t) => `${t}${token}`);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const save = useMutation({
    mutationFn: () =>
      updateChaveTemplate({
        data: { chapter_id: active!.chapter_id, template: template.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Modelo da chave do dia salvo");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar o modelo"),
  });

  const dirty = template.trim() !== saved.trim();

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <KeyRound className="h-5 w-5" /> Chave do dia
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Modelo usado ao copiar a chave do dia no calendário e na tela inicial. Use as variáveis
        entre colchetes — digite <span className="font-mono">[</span> para sugestões — elas
        são substituídas pelos dados do compromisso.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {CHAVE_VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            title={v.label}
            disabled={!isAdmin}
            onClick={() => insertVar(v.key)}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            [{v.key}]
          </button>
        ))}
      </div>

      <MinuteBodyEditor
        chapterId={active?.chapter_id ?? ""}
        value={template}
        onChange={setTemplate}
        editable={isAdmin}
        rows={16}
        className="font-mono text-xs"
        enableMentions={false}
        enableVars
        showAutocompleteToggle={false}
        autocompleteOn
        varTokens={CHAVE_VAR_TOKENS}
        textareaRef={areaRef}
        placeholder="Digite [ para variáveis dinâmicas…"
      />

      <div className="mt-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Pré-visualização</div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-muted/40 p-3 text-xs">
          {preview}
        </pre>
      </div>

      {isAdmin && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            style={{ backgroundColor: "var(--chapter-primary)" }}
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            <Save className="mr-2 h-4 w-4" />
            {save.isPending ? "Salvando…" : "Salvar modelo"}
          </Button>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => setTemplate(DEFAULT_CHAVE_TEMPLATE)}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
          </Button>
        </div>
      )}
    </Card>
  );
}
