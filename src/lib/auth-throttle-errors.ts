/** Predicado compartilhado: tabela auth_login_throttle ausente (migration ainda não aplicada). */

export function isMissingAuthLoginThrottleTable(message: string): boolean {
  return (
    /relation ["']?public\.auth_login_throttle["']? does not exist/i.test(
      message,
    ) ||
    /relation ["']?auth_login_throttle["']? does not exist/i.test(message) ||
    /table ["']?auth_login_throttle["']? does not exist/i.test(message)
  );
}
