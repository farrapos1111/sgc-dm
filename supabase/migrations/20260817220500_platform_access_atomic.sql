-- RPCs atômicos para matriz platform_access (escopo reservado / futuro).

CREATE OR REPLACE FUNCTION public.set_platform_access_role_org_type(
  _role_id uuid,
  _org_type text,
  _enabled boolean,
  _role_group text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.platform_access_roles%ROWTYPE;
  v_max integer;
  v_remaining integer;
BEGIN
  SELECT * INTO v_role FROM public.platform_access_roles WHERE id = _role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cargo não encontrado';
  END IF;

  IF _enabled THEN
    SELECT coalesce(max(sort_order), 0) INTO v_max
    FROM public.platform_access_role_org_types
    WHERE org_type = _org_type
      AND (
        (_role_group IS NULL AND role_group IS NULL)
        OR role_group IS NOT DISTINCT FROM _role_group
      );

    INSERT INTO public.platform_access_role_org_types (
      role_id, org_type, role_group, sort_order
    ) VALUES (
      _role_id, _org_type, _role_group, v_max + 10
    )
    ON CONFLICT (role_id, org_type) DO UPDATE
      SET role_group = EXCLUDED.role_group;

    RETURN jsonb_build_object('ok', true, 'deletedRole', false);
  END IF;

  DELETE FROM public.platform_access_role_org_types
  WHERE role_id = _role_id AND org_type = _org_type;

  SELECT count(*)::integer INTO v_remaining
  FROM public.platform_access_role_org_types
  WHERE role_id = _role_id;

  IF v_remaining = 0 THEN
    IF v_role.is_system THEN
      RAISE EXCEPTION 'Não é possível remover o último vínculo de um cargo de sistema';
    END IF;
    DELETE FROM public.platform_access_roles WHERE id = _role_id;
    RETURN jsonb_build_object('ok', true, 'deletedRole', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'deletedRole', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_platform_access_roles(
  _org_type text,
  _role_group text,
  _ordered_role_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _ordered_role_ids IS NULL OR cardinality(_ordered_role_ids) < 1 THEN
    RAISE EXCEPTION 'Lista de cargos vazia';
  END IF;

  UPDATE public.platform_access_role_org_types pot
  SET sort_order = (v.ord::integer) * 10
  FROM unnest(_ordered_role_ids) WITH ORDINALITY AS v(role_id, ord)
  WHERE pot.role_id = v.role_id
    AND pot.org_type = _org_type
    AND (
      (_role_group IS NULL AND pot.role_group IS NULL)
      OR pot.role_group IS NOT DISTINCT FROM _role_group
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_access_role_org_type(uuid, text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_platform_access_roles(text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_access_role_org_type(uuid, text, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reorder_platform_access_roles(text, text, uuid[])
  TO service_role;
