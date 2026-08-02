-- Link members ↔ auth profiles; flag for forced password change on first access.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'Quando true, o usuário deve redefinir a senha antes de usar o sistema.';

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.members.user_id IS
  'Conta de autenticação vinculada a esta ficha de membro (1:1 quando preenchido).';

CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_unique
  ON public.members (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS members_user_id_idx
  ON public.members (user_id)
  WHERE user_id IS NOT NULL;
