-- Throttle de tentativas de login (anti brute-force). Acesso só via service role.

CREATE TABLE IF NOT EXISTS public.auth_login_throttle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('ip', 'identifier')),
  scope_key text NOT NULL,
  fail_count integer NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_key)
);

CREATE INDEX IF NOT EXISTS auth_login_throttle_locked_idx
  ON public.auth_login_throttle (locked_until)
  WHERE locked_until IS NOT NULL;

COMMENT ON TABLE public.auth_login_throttle IS
  'Contadores de falha de login por IP e por identificador (hash). Sem RLS pública.';

ALTER TABLE public.auth_login_throttle ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_login_throttle FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_login_throttle TO service_role;
