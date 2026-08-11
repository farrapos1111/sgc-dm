import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, type ReactNode } from "react";

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando página">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-[190px]" />
        <Skeleton className="h-9 w-[190px]" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[12px]" />
        ))}
      </div>
    </div>
  );
}

/** Só mostra o skeleton se o Suspense passar de `delayMs` (evita flash em cache hit). */
export function DelayedPageSkeleton({
  delayMs = 120,
}: {
  delayMs?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  if (!show) {
    return <div className="min-h-[12rem]" aria-busy="true" />;
  }
  return <PageSkeleton />;
}

export function DelayedSuspenseFallback({
  delayMs = 120,
  children,
}: {
  delayMs?: number;
  children?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  if (!show) return children ?? <div className="min-h-[12rem]" aria-busy="true" />;
  return <PageSkeleton />;
}
