/** Labels de status de ficha/sindicância (investigation_files / sindicâncias). */
export const INVESTIGATION_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  votacao_comissao: "Votação Comissão",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  arquivada: "Arquivada",
};

/** Alias usado nas rotas de sindicâncias. */
export const STATUS_LABELS = INVESTIGATION_STATUS_LABELS;
