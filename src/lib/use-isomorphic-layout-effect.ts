import { useEffect, useLayoutEffect } from "react";

/** useLayoutEffect no client; useEffect no SSR (sem warning). */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
