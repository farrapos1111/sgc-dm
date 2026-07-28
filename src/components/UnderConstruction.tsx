import { Construction } from "lucide-react";
import { EmptyState } from "./EmptyState";

export function UnderConstruction({ label }: { label: string }) {
  return (
    <EmptyState
      icon={<Construction className="h-7 w-7" />}
      title="Em construção"
      description={`A tela de ${label} será liberada em breve.`}
    />
  );
}
