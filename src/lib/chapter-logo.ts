import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const LOGO_BUCKET = "chapter-logos";

/** URL assinada temporária para exibir a logo do capítulo (bucket privado). */
export function useChapterLogo(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

/** Baixa a logo e converte para data URL (necessário para embutir no PDF). */
export async function loadLogoDataUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .download(path);
  if (error || !data) return null;
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(data);
  });
}
