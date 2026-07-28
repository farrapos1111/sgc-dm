-- 1. Subcategorias dinâmicas definidas pelas comissões
CREATE TABLE public.cash_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('eventos','hospitalaria')),
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cash_subcategories_unique
  ON public.cash_subcategories (chapter_id, scope, coalesce(calendar_event_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX cash_subcategories_chapter_idx ON public.cash_subcategories (chapter_id, scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_subcategories TO authenticated;
GRANT ALL ON public.cash_subcategories TO service_role;

ALTER TABLE public.cash_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcategorias visiveis para o capitulo"
  ON public.cash_subcategories FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

CREATE POLICY "comissao gerencia suas subcategorias"
  ON public.cash_subcategories FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'tesouraria')
    OR public.can_manage_commission(chapter_id, scope)
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'tesouraria')
    OR public.can_manage_commission(chapter_id, scope)
  );

CREATE TRIGGER set_updated_at_cash_subcategories
  BEFORE UPDATE ON public.cash_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Lançamentos guardam subcategoria e evento vinculado (snapshot textual)
ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL;

-- 3. Categoria padrão "Evento" -> "Eventos"
UPDATE public.cash_categories SET name = 'Eventos' WHERE name = 'Evento';
UPDATE public.cash_entries SET category = 'Eventos' WHERE category = 'Evento';

CREATE OR REPLACE FUNCTION public.tg_seed_cash_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.cash_categories (chapter_id, name, sort_order, is_system)
  VALUES
    (NEW.id, 'Eventos', 10, true),
    (NEW.id, 'Mensalidades', 20, true),
    (NEW.id, 'Hospitalaria', 30, true),
    (NEW.id, 'SCDB / GCE', 40, true),
    (NEW.id, 'Entretenimento', 50, true),
    (NEW.id, 'Outras', 90, true)
  ON CONFLICT (chapter_id, name) DO NOTHING;
  RETURN NEW;
END;
$function$;