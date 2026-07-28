ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_chapter_id IS 'Capítulo ativo selecionado pelo usuário no SG-CDM.';
