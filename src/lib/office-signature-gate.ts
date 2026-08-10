import { isRedirect, redirect } from "@tanstack/react-router";
import { needsSignatureForOffices } from "@/lib/office-signatures.functions";

/** Soft gate: redireciona se faltar assinatura de cargo; erros de rede são ignorados. */
export async function redirectIfNeedsOfficeSignature(): Promise<void> {
  try {
    const { needsSignature } = await needsSignatureForOffices();
    if (needsSignature) {
      throw redirect({ to: "/auth/assinatura" });
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
  }
}

/** Soft check para pós-login (navigate em vez de throw redirect). */
export async function checkNeedsOfficeSignature(): Promise<boolean> {
  try {
    const { needsSignature } = await needsSignatureForOffices();
    return needsSignature;
  } catch {
    return false;
  }
}
