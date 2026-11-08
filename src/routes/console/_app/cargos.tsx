import { createFileRoute } from "@tanstack/react-router";
import { PositionCatalogManager } from "@/components/console/PositionCatalogManager";

export const Route = createFileRoute("/console/_app/cargos")({
  component: PositionCatalogManager,
});
