-- Imagem de assinatura dos e-mails do capítulo.
-- Arquivo fica na pasta {chapter_id}/email-signature/ do bucket chapter-logos.

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS email_signature_url text;

COMMENT ON COLUMN public.chapters.email_signature_url IS
  'Path no bucket chapter-logos da imagem de assinatura dos e-mails.';
