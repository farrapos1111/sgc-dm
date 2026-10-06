import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { PublicLobbyChapter } from "@/lib/lobby-share.functions";

export const PUBLIC_ORG_SECTIONS = [
  "fluxo",
  "mensalidades",
  "frequencia",
  "perfil",
] as const;

export type PublicOrgSection = (typeof PUBLIC_ORG_SECTIONS)[number];

export type PublicOrgPath = {
  slug: string;
  token: string | null;
  sections: Record<PublicOrgSection, boolean>;
  chapter: PublicLobbyChapter;
};

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function throwPublicRpcError(error: { message: string }, context: string): never {
  console.error(`[org-public-path] ${context}:`, error.message);
  throw new Error("Não foi possível concluir a solicitação.");
}

export function publicOrgHref(slug: string, section?: PublicOrgSection) {
  return section ? `/${slug}/${section}` : `/${slug}`;
}

export const getChapterPublicSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ chapterId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: slug, error } = await context.supabase.rpc(
      "chapter_public_slug" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    const value = typeof slug === "string" ? slug.trim() : "";
    if (!value) throw new Error("Não foi possível montar o link público");
    return { slug: value };
  });

export const publicOrgSlugForToken = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ token: z.string().trim().min(16).max(128) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: slug, error } = await supabase.rpc(
      "public_org_slug_for_token" as never,
      { _token: data.token } as never,
    );
    if (error) throwPublicRpcError(error, "publicOrgSlugForToken");
    const value = typeof slug === "string" ? slug.trim() : "";
    if (!value) throw new Error("Link indisponível");
    return { slug: value };
  });

export const resolvePublicOrgPath = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        slug: z.string().trim().min(1).max(80),
        section: z.enum(["index", ...PUBLIC_ORG_SECTIONS]),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "resolve_public_org_path" as never,
      { _slug: data.slug, _section: data.section } as never,
    );
    if (error) throwPublicRpcError(error, "resolvePublicOrgPath");
    return payload as PublicOrgPath;
  });

export function useChapterPublicSlug(chapterId: string | undefined) {
  return useQuery({
    queryKey: ["chapter-public-slug", chapterId],
    enabled: Boolean(chapterId),
    staleTime: 60_000,
    queryFn: () => getChapterPublicSlug({ data: { chapterId: chapterId! } }),
  });
}
