/** Cargos que exigem assinatura digital no capítulo atual. */
export const OFFICE_SIGNATURE_REQUIRED_CODES = [
  "mestre_conselheiro",
  "presidente_conselho",
  "presidente_conselho_consultivo",
  "conselheiro_consultor",
  "consultor",
  "tesoureiro",
  "escrivao",
] as const;

/** Normaliza aliases de role/cargo para o código canônico persistido. */
export function canonicalOfficeSignatureCode(code: string): string {
  switch (code) {
    case "presidente_conselho":
      return "presidente_conselho_consultivo";
    case "consultor":
      return "conselheiro_consultor";
    default:
      return code;
  }
}

export function isOfficeSignatureRequiredCode(code: string): boolean {
  return (OFFICE_SIGNATURE_REQUIRED_CODES as readonly string[]).includes(code);
}

export const OFFICE_SIGNATURE_LABELS: Record<string, string> = {
  mestre_conselheiro: "Mestre Conselheiro",
  presidente_conselho_consultivo: "Presidente do Conselho Consultivo",
  conselheiro_consultor: "Conselheiro Consultor",
  tesoureiro: "Tesoureiro",
  escrivao: "Escrivão",
};
