/** IDs de demonstração do [Supademo](https://supademo.com). Preencha via `.env`. */

export type SupademoSlotId =
  | "overview"
  | "secretaria"
  | "tesouraria"
  | "gestao"
  | "comissoes";

const FROM_ENV: Record<SupademoSlotId, string | undefined> = {
  overview: import.meta.env.VITE_SUPADEMO_OVERVIEW,
  secretaria: import.meta.env.VITE_SUPADEMO_SECRETARIA,
  tesouraria: import.meta.env.VITE_SUPADEMO_TESOURARIA,
  gestao: import.meta.env.VITE_SUPADEMO_GESTAO,
  comissoes: import.meta.env.VITE_SUPADEMO_COMISSOES,
};

export function getSupademoDemoId(slot: SupademoSlotId): string | null {
  const raw = FROM_ENV[slot]?.trim();
  return raw ? raw : null;
}

export function supademoEmbedUrl(demoId: string): string {
  const id = demoId.replace(/^https?:\/\/[^/]+\/(?:embed|demo)\//, "");
  return `https://app.supademo.com/embed/${id}?embed_v=2`;
}
