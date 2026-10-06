import { Link } from "@tanstack/react-router";
import { createContext, useContext, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { PublicLobbyChapter } from "@/lib/lobby-share.functions";
import type { PublicOrgSection } from "@/lib/org-public-path.functions";

export type PublicLobbyContextValue = {
  token: string;
  chapter: PublicLobbyChapter;
  /** Slug público (/farrapos/fluxo). Ausente nos links antigos com token. */
  slug?: string;
  sections?: Partial<Record<PublicOrgSection, boolean>>;
};

/** Context isolado do módulo de rota — evita instância duplicada com lazy routes. */
export const PublicLobbyContext = createContext<PublicLobbyContextValue | null>(
  null,
);

export function usePublicLobby() {
  const ctx = useContext(PublicLobbyContext);
  if (!ctx) throw new Error("usePublicLobby fora do layout /c/$token");
  return ctx;
}

export function LobbyBackLink({ children }: { children?: ReactNode }) {
  const { token, slug } = usePublicLobby();
  const className =
    "mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground";
  if (slug) {
    return (
      <Link to="/$org" params={{ org: slug }} className={className}>
        <ArrowLeft className="h-4 w-4" />
        {children ?? "Voltar ao menu"}
      </Link>
    );
  }
  return (
    <Link
      to="/c/$token"
      params={{ token }}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" />
      {children ?? "Voltar ao menu"}
    </Link>
  );
}
