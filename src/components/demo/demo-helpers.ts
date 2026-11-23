import { toast } from "sonner";

export const notInDemo = () =>
  toast("Disponível na versão completa", {
    description: "A demonstração mostra as principais telas. Solicite acesso para usar tudo.",
  });

export const fieldClass =
  "min-h-[46px] w-full rounded-[12px] border border-tv-border bg-tv-bg px-3.5 text-[15px] outline-none focus:border-tv-primary";
