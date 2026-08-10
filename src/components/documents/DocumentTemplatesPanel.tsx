import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
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
import { AVAILABLE_VARS } from "@/lib/minute-vars";
import { MinuteBodyEditor } from "@/components/minutes/MinuteBodyEditor";
import { formatDateTimeBR } from "@/lib/format";
import { matchesLooseSearch, cn } from "@/lib/utils";

export type DocTemplate = {
  id: string;
  name: string;
  body: string;
  updated_at: string;
};

type Props = {
  chapterId: string;
  templates: DocTemplate[];
  editable: boolean;
  /** Chave react-query a invalidar após mutações. */
  queryKey: readonly unknown[];
  /** Ex.: "ata" | "ofício" — usado em textos de ajuda. */
  kind: "ata" | "oficio";
  createTemplate: (input: {
    chapterId: string;
    name: string;
    body: string;
  }) => Promise<unknown>;
  saveTemplate: (input: {
    id: string;
    name: string;
    body: string;
  }) => Promise<unknown>;
  deleteTemplate: (input: { id: string }) => Promise<unknown>;
};

function previewSnippet(body: string, max = 140): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "Modelo vazio — clique para editar.";
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function countVars(body: string): number {
  return (body.match(/\[[^\]\n]+\]/g) ?? []).length;
}

export function DocumentTemplatesPanel({
  chapterId,
  templates,
  editable,
  queryKey,
  kind,
  createTemplate,
  saveTemplate,
  deleteTemplate,
}: Props) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [varsOpen, setVarsOpen] = useState(false);

  const kindNoun = kind === "ata" ? "ata" : "ofício";
  const kindPlural = kind === "ata" ? "atas" : "ofícios";

  const filtered = useMemo(() => {
    const q = search.trim();
    const rows = q
      ? templates.filter(
          (t) =>
            matchesLooseSearch(t.name, q) || matchesLooseSearch(t.body, q),
        )
      : templates;
    return [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [templates, search]);

  const create = useMutation({
    mutationFn: () =>
      createTemplate({
        chapterId,
        name: newName.trim(),
        body: "",
      }),
    onSuccess: async (res) => {
      toast.success("Modelo criado");
      setNewName("");
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: [...queryKey] });
      const id = (res as { id?: string } | undefined)?.id;
      if (id) setExpandedId(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyVar(token: string) {
    void navigator.clipboard?.writeText(token).then(
      () => toast.message(`Copiado ${token}`),
      () => toast.message(token),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Modelos de {kindNoun}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {templates.length === 0
              ? `Nenhum modelo cadastrado.`
              : `${templates.length} modelo${templates.length === 1 ? "" : "s"} · use variáveis entre colchetes para preencher dados automaticamente`}
          </p>
        </div>
        {editable ? (
          <Button
            size="sm"
            style={{ backgroundColor: "var(--chapter-primary)" }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo modelo
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden rounded-[12px]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs hover:bg-muted/40"
          onClick={() => setVarsOpen((v) => !v)}
          aria-expanded={varsOpen}
        >
          <span className="font-medium text-foreground">
            Variáveis dinâmicas
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              varsOpen && "rotate-180",
            )}
          />
        </button>
        {varsOpen ? (
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Digite <span className="font-mono">[</span> no texto do modelo para
              autocompletar, ou clique para copiar. Ao inserir o modelo na{" "}
              {kindNoun}, as variáveis são preenchidas com o capítulo e os
              oficiais da vigência atual. As não reconhecidas permanecem entre
              colchetes.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => copyVar(v)}
                  className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground hover:border-[color:var(--chapter-primary)] hover:text-[color:var(--chapter-primary)]"
                  title={`Copiar ${v}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {templates.length > 0 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo por nome ou trecho…"
            className="h-10 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="Nenhum modelo"
          description={`Crie modelos reutilizáveis com variáveis dinâmicas para agilizar a redação de ${kindPlural}.`}
          action={
            editable ? (
              <Button
                style={{ backgroundColor: "var(--chapter-primary)" }}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo modelo
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Nenhum modelo encontrado com essa busca.
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <TemplateEditorCard
                template={t}
                chapterId={chapterId}
                editable={editable}
                expanded={expandedId === t.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === t.id ? null : t.id))
                }
                kindPlural={kindPlural}
                onSave={async (name, body) => {
                  await saveTemplate({ id: t.id, name, body });
                  await qc.invalidateQueries({ queryKey: [...queryKey] });
                }}
                onDelete={async () => {
                  const ok = await confirm({
                    title: "Excluir modelo?",
                    description: `Excluir “${t.name}”? As ${kindPlural} já redigidas não são afetadas.`,
                    confirmLabel: "Excluir",
                  });
                  if (!ok) return;
                  await deleteTemplate({ id: t.id });
                  await qc.invalidateQueries({ queryKey: [...queryKey] });
                  toast.success("Modelo excluído");
                  if (expandedId === t.id) setExpandedId(null);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setNewName("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo modelo de {kindNoun}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input
              id="tpl-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={
                kind === "ata"
                  ? "Ex.: Ata ordinária padrão"
                  : "Ex.: Ofício de comunicação"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) create.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              style={{ backgroundColor: "var(--chapter-primary)" }}
              disabled={!newName.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}

function TemplateEditorCard({
  template,
  chapterId,
  editable,
  expanded,
  onToggle,
  kindPlural,
  onSave,
  onDelete,
}: {
  template: DocTemplate;
  chapterId: string;
  editable: boolean;
  expanded: boolean;
  onToggle: () => void;
  kindPlural: string;
  onSave: (name: string, body: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setName(template.name);
    setBody(template.body);
  }, [template.name, template.body, template.id]);

  const dirty = name !== template.name || body !== template.body;
  const vars = countVars(body);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome do modelo");
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), body);
      toast.success("Modelo salvo");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function insertVarAtCursor(token: string) {
    const el = bodyRef.current;
    if (!el || !editable) {
      void navigator.clipboard?.writeText(token);
      toast.message(`Copiado ${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <Card className="overflow-hidden rounded-[12px]">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{template.name}</div>
            {!expanded ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {previewSnippet(template.body)}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>Atualizado {formatDateTimeBR(template.updated_at)}</span>
              {vars > 0 ? (
                <span>
                  · {vars} variável{vars === 1 ? "" : "eis"}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        {editable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="m-2 h-9 w-9 shrink-0 text-muted-foreground"
            aria-label={`Excluir modelo ${template.name}`}
            disabled={deleting}
            onClick={async (e) => {
              e.stopPropagation();
              setDeleting(true);
              try {
                await onDelete();
              } catch (err: any) {
                toast.error(err?.message ?? "Erro ao excluir");
              } finally {
                setDeleting(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor={`tpl-name-${template.id}`}>Nome</Label>
            <Input
              id={`tpl-name-${template.id}`}
              value={name}
              disabled={!editable}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_VARS.slice(0, 8).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVarAtCursor(v)}
                  className="rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-[color:var(--chapter-primary)] hover:text-foreground"
                >
                  {v}
                </button>
              ))}
              <span className="self-center text-[10px] text-muted-foreground">
                + digite [ no texto
              </span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`tpl-body-${template.id}`}>Texto do modelo</Label>
            <MinuteBodyEditor
              id={`tpl-body-${template.id}`}
              chapterId={chapterId}
              value={body}
              onChange={setBody}
              editable={editable}
              rows={14}
              enableMentions={false}
              enableVars
              showAutocompleteToggle={false}
              autocompleteOn
              textareaRef={bodyRef}
              placeholder={`Escreva o texto-base da ${kindPlural.slice(0, -1)}… Digite [ para variáveis dinâmicas.`}
              className="min-h-[220px] font-mono text-sm leading-relaxed"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty ? (
              <span className="mr-auto text-xs text-amber-600 dark:text-amber-400">
                Alterações não salvas
              </span>
            ) : (
              <span className="mr-auto text-xs text-muted-foreground">
                Sem alterações pendentes
              </span>
            )}
            {editable ? (
              <Button
                style={{ backgroundColor: "var(--chapter-primary)" }}
                disabled={!dirty || saving || !name.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
