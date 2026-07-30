import { Link } from "@tanstack/react-router";
import { createContext, useContext, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { PublicLobbyChapter } from "@/lib/lobby-share.functions";

export type PublicLobbyContextValue = {
  token: string;
  chapter: PublicLobbyChapter;
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
  const { token } = usePublicLobby();
  return (
    <Link
      to="/c/$token"
      params={{ token }}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {children ?? "Voltar ao menu"}
    </Link>
  );
}
