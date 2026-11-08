import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { consoleAbsoluteUrl } from "@/lib/realm";

/** Telas globais que saíram do app das instituições e agora vivem no Console. */
export function MovedToConsole({ title, path }: { title: string; path: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        title="Esta tela agora fica no Console"
        description="Configurações globais da plataforma são feitas pelos administradores do Templo Virtual em console.templovirtual.app."
        action={
          <Button asChild variant="outline">
            <a href={consoleAbsoluteUrl(path)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Console
            </a>
          </Button>
        }
      />
    </div>
  );
}
