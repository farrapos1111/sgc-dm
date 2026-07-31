-- Comissões por capítulo (cópias a partir do catálogo global).
-- Idempotente: pode reaplicar após falha/deadlock.
-- Trava as tabelas na mesma ordem para evitar deadlock com o app.

BEGIN;

SET LOCAL lock_timeout = '15s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

-- Ordem fixa + ACCESS EXCLUSIVE (DDL precisa; evita upgrade de lock / deadlock)
LOCK TABLE
  public.chapters,
  public.commissions,
  public.commission_members
IN ACCESS EXCLUSIVE MODE;

-- 1) Coluna sem FK inline (FK inline trava chapters + commissions juntos)
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS chapter_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commissions_chapter_id_fkey'
      AND conrelid = 'public.commissions'::regclass
  ) THEN
    ALTER TABLE public.commissions
      ADD CONSTRAINT commissions_chapter_id_fkey
      FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Sequence / default de id (setval final fica depois do clone)
CREATE SEQUENCE IF NOT EXISTS public.commissions_id_seq;
ALTER TABLE public.commissions
  ALTER COLUMN id SET DEFAULT nextval('public.commissions_id_seq');
ALTER SEQUENCE public.commissions_id_seq OWNED BY public.commissions.id;

-- 3) Unique: global vs por capítulo
ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_code_key;
DROP INDEX IF EXISTS public.commissions_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS commissions_global_code_uidx
  ON public.commissions (code)
  WHERE chapter_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commissions_chapter_code_uidx
  ON public.commissions (chapter_id, code)
  WHERE chapter_id IS NOT NULL;

-- 4) Clona templates para cada capítulo
INSERT INTO public.commissions (code, label, sort_order, chapter_id)
SELECT t.code, t.label, t.sort_order, ch.id
FROM public.chapters ch
CROSS JOIN public.commissions t
WHERE t.chapter_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.commissions x
    WHERE x.chapter_id = ch.id
      AND x.code = t.code
  );

-- Alinha a sequence ao maior id (ex.: 27 após clones)
SELECT setval(
  'public.commissions_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.commissions), 1), 1)
);

-- 5) Remapeia vínculos ainda apontando para template global
UPDATE public.commission_members cm
SET commission_id = copy.id
FROM public.commissions old,
     public.commissions copy
WHERE cm.commission_id = old.id
  AND old.chapter_id IS NULL
  AND copy.chapter_id = cm.chapter_id
  AND copy.code = old.code
  AND copy.id IS DISTINCT FROM old.id;

-- 6) FK com CASCADE (sem AccessExclusive longo demais: drop + add)
ALTER TABLE public.commission_members
  DROP CONSTRAINT IF EXISTS commission_members_commission_id_fkey;

ALTER TABLE public.commission_members
  ADD CONSTRAINT commission_members_commission_id_fkey
  FOREIGN KEY (commission_id) REFERENCES public.commissions(id) ON DELETE CASCADE;

-- 7) RLS / grants
DROP POLICY IF EXISTS commissions_select ON public.commissions;
CREATE POLICY commissions_select ON public.commissions
  FOR SELECT TO authenticated
  USING (
    chapter_id IS NULL
    OR public.can_read_chapter(chapter_id)
  );

DROP POLICY IF EXISTS commissions_write ON public.commissions;
CREATE POLICY commissions_write ON public.commissions
  FOR ALL TO authenticated
  USING (
    chapter_id IS NOT NULL
    AND public.has_permission(chapter_id, 'comissoes')
  )
  WITH CHECK (
    chapter_id IS NOT NULL
    AND public.has_permission(chapter_id, 'comissoes')
  );

GRANT INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.commissions_id_seq TO authenticated;

COMMIT;

-- Funções/triggers fora da transação longa de DDL (não precisam dos locks acima)
CREATE OR REPLACE FUNCTION public.tg_seed_chapter_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.commissions (code, label, sort_order, chapter_id)
  SELECT t.code, t.label, t.sort_order, NEW.id
  FROM public.commissions t
  WHERE t.chapter_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.commissions x
      WHERE x.chapter_id = NEW.id
        AND x.code = t.code
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chapters_seed_commissions ON public.chapters;
CREATE TRIGGER chapters_seed_commissions
  AFTER INSERT ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_seed_chapter_commissions();

CREATE OR REPLACE FUNCTION public.is_commission_member(_chapter_id uuid, _commission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    JOIN public.members m ON m.id = cm.member_id
    JOIN public.chapter_members ch ON ch.chapter_id = cm.chapter_id AND ch.active = true
    WHERE cm.chapter_id = _chapter_id
      AND c.code = _commission_code
      AND (c.chapter_id IS NULL OR c.chapter_id = _chapter_id)
      AND ch.user_id = auth.uid()
      AND lower(m.full_name) = lower(coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), '###'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commission_president(_chapter_id uuid, _commission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.chapter_id = _chapter_id
      AND c.code = _commission_code
      AND (c.chapter_id IS NULL OR c.chapter_id = _chapter_id)
      AND cm.role IN ('presidente','vice')
      AND lower(m.full_name) = lower(coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), '###'))
  );
$$;
