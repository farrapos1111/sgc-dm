import { getRequest } from "@tanstack/react-start/server";
import {
  getDevRealmOverride,
  resolveRealmFromHost,
  type Realm,
} from "@/lib/realm";

/** Só no servidor. Não importar em módulos de cliente. */
export function getServerRequestRealm(): Realm | null {
  const req = getRequest();
  const host = req.headers.get("host") ?? "";
  return resolveRealmFromHost(
    host,
    req.headers.get("x-dev-realm") || getDevRealmOverride(),
  );
}
