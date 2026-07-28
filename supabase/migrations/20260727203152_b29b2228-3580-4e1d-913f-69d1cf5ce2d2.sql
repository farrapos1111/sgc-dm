ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS logo_url text;

CREATE POLICY "chapters_update_admins" ON public.chapters
  FOR UPDATE TO authenticated
  USING (public.has_any_role(id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor']))
  WITH CHECK (public.has_any_role(id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor']));