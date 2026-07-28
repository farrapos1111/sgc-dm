CREATE TABLE public.cash_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_categories TO authenticated;
GRANT ALL ON public.cash_categories TO service_role;

ALTER TABLE public.cash_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_categories_select" ON public.cash_categories
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

CREATE POLICY "cash_categories_write" ON public.cash_categories
  FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria'))
  WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));

CREATE TRIGGER cash_categories_updated_at
  BEFORE UPDATE ON public.cash_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL;

-- Preset padrão de categorias para os capítulos existentes
INSERT INTO public.cash_categories (chapter_id, name, sort_order, is_system)
SELECT c.id, v.name, v.sort_order, true
FROM public.chapters c
CROSS JOIN (VALUES
  ('Evento', 10),
  ('Mensalidades', 20),
  ('Hospitalaria', 30),
  ('SCDB / GCE', 40),
  ('Entretenimento', 50),
  ('Outras', 90)
) AS v(name, sort_order)
ON CONFLICT (chapter_id, name) DO NOTHING;

-- Novos capítulos recebem o preset automaticamente
CREATE OR REPLACE FUNCTION public.tg_seed_cash_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cash_categories (chapter_id, name, sort_order, is_system)
  VALUES
    (NEW.id, 'Evento', 10, true),
    (NEW.id, 'Mensalidades', 20, true),
    (NEW.id, 'Hospitalaria', 30, true),
    (NEW.id, 'SCDB / GCE', 40, true),
    (NEW.id, 'Entretenimento', 50, true),
    (NEW.id, 'Outras', 90, true)
  ON CONFLICT (chapter_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chapters_seed_cash_categories
  AFTER INSERT ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_cash_categories();