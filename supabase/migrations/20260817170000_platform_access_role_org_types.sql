-- Quais cargos existem em cada tipo de instituição.

CREATE TABLE IF NOT EXISTS public.platform_access_role_org_types (
  role_id uuid NOT NULL REFERENCES public.platform_access_roles(id) ON DELETE CASCADE,
  org_type text NOT NULL
    CHECK (org_type IN ('capitulo', 'bethel', 'loja', 'priorado', 'castelo', 'apj', 'outro')),
  PRIMARY KEY (role_id, org_type)
);

CREATE INDEX IF NOT EXISTS platform_access_role_org_types_org_idx
  ON public.platform_access_role_org_types (org_type);

ALTER TABLE public.platform_access_role_org_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_access_role_org_types_select ON public.platform_access_role_org_types;
CREATE POLICY platform_access_role_org_types_select
  ON public.platform_access_role_org_types
  FOR SELECT TO authenticated USING (true);

-- membro: todos os tipos de instituição
INSERT INTO public.platform_access_role_org_types (role_id, org_type)
SELECT r.id, ot.org_type
FROM public.platform_access_roles r
CROSS JOIN (
  SELECT unnest(ARRAY[
    'capitulo','bethel','loja','priorado','castelo','apj','outro'
  ]) AS org_type
) ot
WHERE r.key = 'membro'
ON CONFLICT DO NOTHING;

-- demais cargos (DeMolay e aliases): apenas capítulo por padrão
INSERT INTO public.platform_access_role_org_types (role_id, org_type)
SELECT r.id, 'capitulo'
FROM public.platform_access_roles r
WHERE r.key <> 'membro'
ON CONFLICT DO NOTHING;
