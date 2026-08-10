/** Códigos de cargo usados nas assinaturas do PDF de ofício. */
export const OFICIO_PDF_SIGNATURE_CODES = [
  "presidente_conselho_consultivo",
  "mestre_conselheiro",
  "escrivao",
] as const;

type OficioSignatureSlot = {
  positionCode: string;
  signatureDataUrl: string | null;
};

/**
 * Carrega assinaturas oficiais para PDF de ofício.
 * Propaga erros — o chamador decide se aborta a exportação.
 */
export async function loadOficioSignatureMap(
  chapterId: string | null | undefined,
): Promise<Record<string, OficioSignatureSlot>> {
  if (!chapterId) return {};
  const { listChapterOfficeSignatures } = await import(
    "@/lib/office-signatures.functions"
  );
  const slots = await listChapterOfficeSignatures({
    data: {
      chapterId,
      positionCodes: [...OFICIO_PDF_SIGNATURE_CODES],
    },
  });
  return Object.fromEntries(slots.map((s) => [s.positionCode, s]));
}
