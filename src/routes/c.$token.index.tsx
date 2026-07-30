import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  ClipboardList,
  IdCard,
  Receipt,
  UserRound,
  Wallet,
} from "lucide-react";
import { usePublicLobby } from "@/context/PublicLobbyContext";
import { lobbyMemberStorageKey } from "@/lib/lobby-share.functions";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/c/$token/")({
  ssr: false,
  component: PublicLobbyIndex,
});

function PublicLobbyIndex() {
  const { token, chapter } = usePublicLobby();
  const [hasMember] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem(lobbyMemberStorageKey(token)));
  });

  const accent = chapter.primary_color || "#9E1B32";

  const publicLinks = useMemo(
    () => [
      {
        to: "/c/$token/mensalidades" as const,
        label: "Mensalidades",
        hint: "Calendário anual do capítulo",
        icon: Receipt,
      },
      {
        to: "/c/$token/fluxo" as const,
        label: "Fluxo de caixa",
        hint: "Entradas e saídas",
        icon: Wallet,
      },
      {
        to: "/c/$token/presencas" as const,
        label: "Presenças e frequência",
        hint: "Visão geral das chamadas",
        icon: CalendarCheck,
      },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Aberto a todos</h2>
        <div className="flex flex-col gap-3">
          {publicLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              params={{ token }}
              className="flex min-h-14 items-center gap-3 rounded-[12px] border border-border bg-card px-4 py-3 transition hover:bg-muted/40"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
                style={{ backgroundColor: accent }}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{item.label}</span>
                <span className="block text-sm text-muted-foreground">{item.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Com seu ID DeMolay</h2>
        <Link
          to="/c/$token/eu"
          params={{ token }}
          className="flex min-h-14 items-center gap-3 rounded-[12px] border border-border bg-card px-4 py-3 transition hover:bg-muted/40"
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
            style={{ backgroundColor: accent }}
          >
            {hasMember ? (
              <UserRound className="h-5 w-5" />
            ) : (
              <IdCard className="h-5 w-5" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">Área do membro</span>
            <span className="block text-sm text-muted-foreground">
              {hasMember
                ? "Cobranças, cadastro e minha frequência"
                : "Informe seu ID para cobranças, cadastro e frequência"}
            </span>
          </span>
        </Link>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Seus dados ficam só nesta sessão do navegador até você fechar a aba.
        </p>
      </section>
    </div>
  );
}
