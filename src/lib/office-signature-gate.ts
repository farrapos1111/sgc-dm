import { isRedirect, redirect } from "@tanstack/react-router";
import { needsSignatureForOffices } from "@/lib/office-signatures.functions";

/** Redireciona se faltar assinatura de cargo; propaga falhas (não mascara como “ok”). */
export async function redirectIfNeedsOfficeSignature(): Promise<void> {
  try {
    const { needsSignature } = await needsSignatureForOffices();
    if (needsSignature) {
      throw redirect({ to: "/auth/assinatura" });
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    throw e;
  }
}

/** Pós-login: true se precisa assinar; propaga erro de rede/RPC. */
export async function checkNeedsOfficeSignature(): Promise<boolean> {
  const { needsSignature } = await needsSignatureForOffices();
  return needsSignature;
}
