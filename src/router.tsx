import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const QUERY_STALE_MS = 60_000;
const QUERY_GC_MS = 30 * 60_000;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_MS,
        gcTime: QUERY_GC_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // "intent" dispara preloadRoute em Links e quebra com _nonReactive em rotas ssr:false
    defaultPreload: false,
    defaultPreloadStaleTime: QUERY_STALE_MS,
    defaultPendingMs: 200,
    defaultPendingMinMs: 0,
  });

  return router;
};
