import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Abre e fecha conteúdo com animação de altura (grid 0fr → 1fr), sem medir.
 * O conteúdo só existe enquanto aberto (e durante a animação de fechar).
 */
export function Expand({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // dois quadros depois de montar: o navegador precisa pintar o estado
      // fechado antes, senão a transição não acontece
      let id2 = 0;
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(id1);
        cancelAnimationFrame(id2);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;
  return (
    <div className={cn("tv-expand", className)} data-open={shown ? "true" : "false"}>
      <div>{children}</div>
    </div>
  );
}
