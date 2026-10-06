import { Navigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  publicOrgSlugForToken,
  type PublicOrgSection,
} from "@/lib/org-public-path.functions";

const LOBBY_SECTION: Record<string, PublicOrgSection | "index"> = {
  "": "index",
  fluxo: "fluxo",
  mensalidades: "mensalidades",
  presencas: "frequencia",
  eu: "perfil",
};

export function lobbyMaskSection(
  pathname: string,
  token: string,
): PublicOrgSection | "index" | null {
  const prefix = `/c/${token}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
  const rest = pathname.slice(prefix.length).replace(/^\//, "").split("/")[0] ?? "";
  if (!(rest in LOBBY_SECTION)) return null;
  return LOBBY_SECTION[rest] ?? "index";
}

export function PublicTokenMask({
  token,
  section,
}: {
  token: string;
  section: PublicOrgSection | "index";
}) {
  const { data } = useQuery({
    queryKey: ["public-org-slug", token],
    queryFn: () => publicOrgSlugForToken({ data: { token } }),
    retry: false,
    staleTime: Infinity,
  });
  if (!data?.slug) return null;
  if (section === "index") {
    return <Navigate to="/$org" params={{ org: data.slug }} replace />;
  }
  if (section === "fluxo") {
    return <Navigate to="/$org/fluxo" params={{ org: data.slug }} replace />;
  }
  if (section === "mensalidades") {
    return <Navigate to="/$org/mensalidades" params={{ org: data.slug }} replace />;
  }
  if (section === "frequencia") {
    return <Navigate to="/$org/frequencia" params={{ org: data.slug }} replace />;
  }
  if (section === "calendario") {
    return <Navigate to="/$org/calendario" params={{ org: data.slug }} replace />;
  }
  if (section === "nominata") {
    return <Navigate to="/$org/nominata" params={{ org: data.slug }} replace />;
  }
  return <Navigate to="/$org/perfil" params={{ org: data.slug }} replace />;
}

export function useLobbyPublicMask(token: string) {
  const { pathname } = useLocation();
  const section = lobbyMaskSection(pathname, token);
  if (!section) return null;
  return <PublicTokenMask token={token} section={section} />;
}
