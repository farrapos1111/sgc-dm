import { ImagePlus, Loader2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ID_DOC_KINDS,
  ID_DOC_LABELS,
  MAX_DOC_BYTES,
  type IdDocKind,
} from "@/lib/member-documents";

export type DocPathsState = Record<IdDocKind, string | null>;
export type DocPreviewState = Record<IdDocKind, string | null>;

export const emptyDocPaths = (): DocPathsState => ({
  rg_front: null,
  rg_back: null,
  cpf_front: null,
  cpf_back: null,
});

type Props = {
  paths: DocPathsState;
  previews: DocPreviewState;
  uploading?: IdDocKind | null;
  disabled?: boolean;
  onPick: (kind: IdDocKind, file: File) => void | Promise<void>;
  onClear?: (kind: IdDocKind) => void;
};

export function DocumentUploadFields({
  paths,
  previews,
  uploading = null,
  disabled,
  onPick,
  onClear,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ID_DOC_KINDS.map((kind) => {
        const preview = previews[kind];
        const hasPath = Boolean(paths[kind]);
        const busy = uploading === kind;
        const inputId = `investigation-doc-${kind}`;
        const labelText = ID_DOC_LABELS[kind];
        return (
          <div key={kind} className="space-y-1.5">
            <Label htmlFor={inputId} className="text-sm">
              {labelText} <span className="text-destructive">*</span>
            </Label>
            <div className="relative overflow-hidden rounded-[12px] border border-dashed border-border bg-muted/30">
              {preview || hasPath ? (
                <div className="relative aspect-[4/3] bg-muted">
                  {preview ? (
                    <img
                      src={preview}
                      alt={labelText}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      Documento enviado
                    </div>
                  )}
                  {!disabled && onClear && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-2 h-8 w-8"
                      onClick={() => onClear(kind)}
                      aria-label={`Remover ${labelText}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={disabled || busy}
                    aria-label={`Substituir ${labelText}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void onPick(kind, file);
                    }}
                  />
                </div>
              ) : (
                <label
                  htmlFor={inputId}
                  className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  <span>
                    {busy
                      ? `Enviando ${labelText}…`
                      : `Toque para enviar ${labelText}`}
                  </span>
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={disabled || busy}
                    aria-label={labelText}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void onPick(kind, file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function validateDocFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Envie uma imagem";
  if (file.size > MAX_DOC_BYTES) return "Imagem maior que 3 MB";
  return null;
}

/** Lê arquivo como data URL para preview local. */
export function readFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });
}
