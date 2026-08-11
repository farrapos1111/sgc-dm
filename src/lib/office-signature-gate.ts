import { isRedirect, redirect } from "@tanstack/react-router";
import { needsSignatureForOffices } from "@/lib/office-signatures.functions";

/** Redireciona se faltar assinatura de cargo. Falha de rede não derruba a navegação. */
export async function redirectIfNeedsOfficeSignature(): Promise<void> {
  try {
    const { needsSignature } = await needsSignatureForOffices();
    if (needsSignature) {
      throw redirect({ to: "/auth/assinatura" });
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.error("[office-signature] check failed", e);
  }
}

/** Pós-login: true se precisa assinar; falha de rede → false (não bloqueia login). */
export async function checkNeedsOfficeSignature(): Promise<boolean> {
  try {
    const { needsSignature } = await needsSignatureForOffices();
    return Boolean(needsSignature);
  } catch (e) {
    console.error("[office-signature] check failed", e);
    return false;
  }
}
