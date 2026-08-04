import { useCallback, useRef, useState } from "react";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual de exclusão (vermelho). Default: true */
  destructive?: boolean;
};

/**
 * Substitui window.confirm por AlertDialog no estilo da plataforma.
 * Uso: const { confirm, dialog } = useConfirmDialog(); … {dialog}
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmDialogOptions>({
    title: "",
    confirmLabel: "Excluir",
    cancelLabel: "Cancelar",
    destructive: true,
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const finish = useCallback((value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    setOpts({
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      destructive: true,
      ...options,
    });
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const destructive = opts.destructive !== false;

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish(false);
      }}
    >
      <AlertDialogContent className="rounded-[12px] sm:rounded-[12px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title}</AlertDialogTitle>
          {opts.description ? (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            {opts.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              destructive &&
                buttonVariants({ variant: "destructive" }),
            )}
            onClick={(e) => {
              e.preventDefault();
              finish(true);
            }}
          >
            {opts.confirmLabel ?? "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
