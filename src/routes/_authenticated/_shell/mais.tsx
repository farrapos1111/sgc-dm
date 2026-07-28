import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Repeat, Building2, Landmark, Settings, BookOpen } from "lucide-react";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/_shell/mais")({
  head: () => ({
    meta: [
      { title: "Mais — SG-CDM" },
      { name: "description", content: "Opções e sessão." },
    ],
  }),
  component: MaisPage,
});

function MaisPage() {
  const { active, memberships } = useActiveChapter();
  const navigate = useNavigate();

  async function signOut() {
    if (typeof window !== "undefined") window.localStorage.removeItem("sgcdm.activeChapterId");
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <div>
      <PageHeader title="Mais" subtitle="Preferências e sessão." />
      <div className="space-y-4">
        <Card className="rounded-[12px] p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-5 w-5" /> Capítulo ativo
          </div>
          <div className="text-base font-semibold">{active?.chapter.name}</div>
          <div className="text-sm text-muted-foreground">
            Nº {active?.chapter.number} · {active?.role.label}
          </div>
          {memberships.length > 1 && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate({ to: "/selecionar-capitulo" })}
            >
              <Repeat className="mr-2 h-4 w-4" /> Trocar de capítulo
            </Button>
          )}
        </Card>
        <Card className="rounded-[12px] p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Settings className="h-5 w-5" /> Configurações
          </div>
          <div className="text-sm text-muted-foreground">
            Logo do capítulo usada nas atas em PDF e identidade visual.
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate({ to: "/configuracoes" })}
          >
            Abrir configurações
          </Button>
        </Card>
        {can(active?.role.name, "secretaria") && (
          <Card className="rounded-[12px] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Landmark className="h-5 w-5" /> Gestão
            </div>
            <div className="text-sm text-muted-foreground">
              Cargos do capítulo, conselho consultivo e comissões por vigência.
            </div>
            <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/gestao" })}>
              Abrir gestão
            </Button>
          </Card>
        )}
        <Card className="rounded-[12px] p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-5 w-5" /> Documentação
          </div>
          <div className="text-sm text-muted-foreground">
            Guias técnicos, do usuário e de contribuição open source.
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate({ to: "/documentacao" })}
          >
            Abrir documentação
          </Button>
        </Card>
        <Card className="rounded-[12px] p-5">
          <Button variant="destructive" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </Card>
      </div>
    </div>
  );
}
