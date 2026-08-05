import { digitsOnly, maskCepInput } from "@/lib/format";

export type BrasilApiCep = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
};

export type CepLookupResult = {
  zip: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

/** Consulta CEP na BrasilAPI (8 dígitos). Lança Error se não encontrado/falhar. */
export async function lookupCep(raw: string): Promise<CepLookupResult> {
  const cep = digitsOnly(raw);
  if (cep.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos");
  }
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!res.ok) {
    throw new Error(
      res.status === 404 ? "CEP não encontrado" : "Não foi possível buscar o CEP",
    );
  }
  const payload = (await res.json()) as BrasilApiCep;
  return {
    zip: maskCepInput(payload.cep || cep),
    street: payload.street ?? "",
    neighborhood: payload.neighborhood ?? "",
    city: payload.city ?? "",
    state: (payload.state ?? "").toUpperCase(),
    country: "Brasil",
  };
}

/**
 * Atualiza o CEP mascarado e dispara lookup quando completo.
 * Retorna o valor mascarado e se deve limpar o status de lookup.
 */
export function handleCepChange(
  raw: string,
  onZip: (masked: string) => void,
): { masked: string; complete: boolean } {
  const masked = maskCepInput(raw);
  onZip(masked);
  return { masked, complete: digitsOnly(masked).length === 8 };
}

export { maskCepInput, digitsOnly };
