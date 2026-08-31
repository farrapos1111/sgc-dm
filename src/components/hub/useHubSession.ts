import { useEffect } from "react";
import { getClientRealm } from "@/lib/realm";

/**
 * No apex (hub), a landing é sempre pública — sem ler sessão,
 * cookie, localStorage ou sessionStorage, e sem redirecionar.
 * Em subdomínio de esfera (odm/fdj/loja), manda para o app.
 */
export function useHubHostGuard() {
  useEffect(() => {
    if (getClientRealm()) {
      window.location.replace("/inicio");
    }
  }, []);
}
