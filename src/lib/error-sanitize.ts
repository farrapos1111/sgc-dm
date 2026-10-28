/**
 * Traduz erros técnicos (Postgres/PostgREST/Auth) em mensagens para o usuário.
 * As server functions repassam `error.message` do Supabase; sem isto, o
 * navegador recebe nomes de tabelas, constraints e políticas RLS.
 * Mensagens escritas pelo próprio app (em português) passam inalteradas.
 */

export const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente.";

const CONSTRAINT_MESSAGES: Record<string, string> = {
  members_email_format_ck: "E-mail inválido. Confira o endereço informado.",
  members_full_name_length_ck: "Nome deve ter entre 1 e 200 caracteres.",
};

const RULES: Array<[RegExp, string]> = [
  [/row-level security|permission denied|insufficient_privilege/i, "Você não tem permissão para esta ação."],
  [/duplicate key value/i, "Já existe um registro com esses dados."],
  [/violates foreign key constraint/i, "Este registro está vinculado a outros dados e não pode ser alterado ou excluído."],
  [/violates not-null constraint/i, "Preencha todos os campos obrigatórios."],
  [/violates check constraint/i, "Algum campo tem um valor inválido. Confira os dados."],
  [/invalid input (syntax|value)|out of range|date\/time field value/i, "Algum campo tem formato inválido. Confira os dados."],
  [/^Unauthorized|JWT expired|invalid JWT|refresh token/i, SESSION_EXPIRED_MESSAGE],
  [/value too long for type/i, "Algum campo passou do tamanho máximo."],
  [
    /does not exist|schema cache|PGRST\d+|could not find the function|syntax error at or near|statement timeout/i,
    "Erro interno ao processar a solicitação. Tente novamente; se persistir, avise a Comissão de Tecnologia.",
  ],
];

type ZodLikeIssue = { message?: string; path?: Array<string | number> };

function zodMessage(error: unknown): string | null {
  const issues = (error as { issues?: ZodLikeIssue[] } | null)?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  const first = issues[0];
  const msg = first?.message?.trim();
  if (!msg) return "Dados inválidos. Confira os campos.";
  // Mensagens padrão do Zod vêm em inglês ("Required", "Invalid email"...).
  if (/^[\x20-\x7E]+$/.test(msg) && !/[áéíóúãõç]/i.test(msg)) {
    const field = first.path?.length ? ` (${first.path.join(".")})` : "";
    return `Dados inválidos${field}. Confira os campos.`;
  }
  return msg;
}

/** Mensagem segura para o usuário; null = manter a original. */
export function userFacingMessage(error: unknown): string | null {
  const zod = zodMessage(error);
  if (zod) return zod;
  if (!(error instanceof Error)) return null;
  const message = error.message ?? "";
  const constraint = /constraint "([a-z0-9_]+)"/i.exec(message)?.[1];
  if (constraint && CONSTRAINT_MESSAGES[constraint]) return CONSTRAINT_MESSAGES[constraint];
  for (const [pattern, friendly] of RULES) {
    if (pattern.test(message)) return friendly;
  }
  return null;
}

/** Redirects/notFound do router e erros HTTP já tratados passam direto. */
export function isControlFlowError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  return (
    "isRedirect" in error ||
    "isNotFound" in error ||
    "statusCode" in error ||
    error instanceof Response
  );
}
