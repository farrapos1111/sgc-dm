-- Inventário de funções SECURITY DEFINER executáveis por usuários logados.
-- Rode no SQL Editor de produção depois de cada migration e revise a lista:
-- toda função aqui roda com privilégio do dono e precisa validar o chamador
-- (auth.uid(), has_permission...) por conta própria.
--
-- Se a função não aparece em src/ (grep pelo nome) nem em políticas
-- RLS, provavelmente é helper interno — revogue o EXECUTE de authenticated
-- (ou mova para um schema privado).

WITH secdef AS (
  SELECT
    p.oid,
    p.oid::regprocedure AS assinatura,
    p.proname,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
    position('auth.uid()' IN pg_get_functiondef(p.oid)) > 0 AS usa_auth_uid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.prokind = 'f'
),
em_policies AS (
  SELECT DISTINCT s.proname
  FROM secdef s
  JOIN pg_policies pol
    ON coalesce(pol.qual, '') || coalesce(pol.with_check, '') LIKE '%' || s.proname || '(%'
)
SELECT
  s.assinatura,
  s.anon,
  s.authenticated,
  s.usa_auth_uid,
  (ep.proname IS NOT NULL) AS usada_em_rls
FROM secdef s
LEFT JOIN em_policies ep ON ep.proname = s.proname
WHERE s.anon OR s.authenticated
ORDER BY s.anon DESC, s.usa_auth_uid, s.proname;
