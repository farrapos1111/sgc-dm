import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CarteirinhaDados } from "@/components/proficiency/types";
import { grauOf } from "@/lib/format";

export type LinkedMemberSummary = {
  id: string;
  chapterId: string;
  chapterName: string;
  chapterNumber: string;
  city: string | null;
  uf: string | null;
  fullName: string;
  demolayId: string | null;
  masonicId: string | null;
  status: string;
  kind: string;
  grauLabel: string;
  examGrauIniciatico: string | null;
  examGrauDemolay: string | null;
  iniciacaoOrdem: string | null;
  iniciacaoGrauDemolay: string | null;
};

export type ProficiencyCardView = {
  id: string;
  chapterId: string;
  memberId: string;
  status: "active" | "revoked";
  issuedAt: string;
  revokedAt: string | null;
  verificationCode: string;
  dados: CarteirinhaDados;
};

export type MyDemolayProfile = {
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
  members: LinkedMemberSummary[];
  cards: ProficiencyCardView[];
};

type ChapterJoin = {
  id: string;
  name: string;
  number: string;
  city: string | null;
  state: { uf: string } | null;
};

type LodgeRow = { name: string; address: string | null; is_primary: boolean };

function ymd(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function isoDateOnly(value: string | null | undefined): string {
  const y = ymd(value);
  return y ?? "";
}

function buildEndereco(
  lodge: LodgeRow | null,
  cidade: string,
  uf: string,
): string[] {
  const lines: string[] = [];
  if (lodge?.name) lines.push(lodge.name);
  if (lodge?.address) lines.push(lodge.address);
  if (cidade || uf) {
    lines.push([cidade, uf].filter(Boolean).join(" — "));
  }
  return lines;
}

function toDados(input: {
  nome: string;
  capitulo: string;
  numero: string;
  cidade: string;
  uf: string;
  registro: string | null;
  foto: string | null;
  profIniciatico: string | null;
  profDemolay: string | null;
  validade: string | null;
  assinaturaMembro: string | null;
  assinaturaConsultor: string | null;
  qr: string | null;
  codigo: string;
  emissao: string;
  endereco: string[];
}): CarteirinhaDados {
  return {
    nome: input.nome,
    capitulo: input.capitulo,
    numero: input.numero,
    cidade: input.cidade,
    uf: input.uf,
    registro: input.registro || "—",
    foto: input.foto || "",
    proficiencia: {
      iniciatico: ymd(input.profIniciatico),
      demolay: ymd(input.profDemolay),
    },
    validade: isoDateOnly(input.validade),
    assinaturaMembro: input.assinaturaMembro || "",
    assinaturaConsultor: input.assinaturaConsultor || "",
    qr: input.qr || "",
    codigo: input.codigo,
    emissao: isoDateOnly(input.emissao),
    endereco: input.endereco,
  };
}

function randomSuffix(len = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function findLinkedMemberIds(
  supabase: {
    from: (t: string) => any;
  },
  userId: string,
  email: string | null,
): Promise<{ ids: string[]; fullName: string | null }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const fullName = (profile?.full_name as string | null) ?? null;

  // Prefer hard link members.user_id → auth user
  const { data: byUser } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId);
  if (byUser && byUser.length > 0) {
    return {
      ids: byUser.map((m: { id: string }) => m.id),
      fullName,
    };
  }

  // Fallback legado: e-mail / nome
  const filters: string[] = [];
  if (email) filters.push(`email.eq.${email}`);
  if (fullName) filters.push(`full_name.eq.${fullName}`);
  if (filters.length === 0) return { ids: [], fullName };

  const { data: members } = await supabase.from("members").select("id").or(filters.join(","));

  return {
    ids: (members ?? []).map((m: { id: string }) => m.id),
    fullName,
  };
}

async function loadLodgeMap(
  supabase: { from: (t: string) => any },
  chapterIds: string[],
): Promise<Map<string, LodgeRow>> {
  const map = new Map<string, LodgeRow>();
  if (chapterIds.length === 0) return map;
  const { data } = await supabase
    .from("chapter_lodges")
    .select("chapter_id, name, address, is_primary")
    .in("chapter_id", chapterIds)
    .order("is_primary", { ascending: false });
  for (const row of data ?? []) {
    if (map.has(row.chapter_id)) continue;
    map.set(row.chapter_id, {
      name: row.name,
      address: row.address,
      is_primary: row.is_primary,
    });
  }
  return map;
}

function mapCardRow(
  row: {
    id: string;
    chapter_id: string;
    member_id: string;
    status: string;
    issued_at: string;
    revoked_at: string | null;
    registro_scdb: string | null;
    photo_url: string | null;
    prof_iniciatico: string | null;
    prof_demolay: string | null;
    valid_until: string | null;
    member_signature_url: string | null;
    consultor_signature_url: string | null;
    qr_url: string | null;
    verification_code: string;
    member: {
      full_name: string;
      demolay_id: string | null;
    } | null;
    chapter: ChapterJoin | null;
  },
  lodge: LodgeRow | null,
): ProficiencyCardView {
  const chapter = row.chapter;
  const member = row.member;
  const cidade = chapter?.city ?? "";
  const uf = chapter?.state?.uf ?? "";
  return {
    id: row.id,
    chapterId: row.chapter_id,
    memberId: row.member_id,
    status: row.status === "revoked" ? "revoked" : "active",
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    verificationCode: row.verification_code,
    dados: toDados({
      nome: member?.full_name ?? "—",
      capitulo: chapter?.name ?? "—",
      numero: chapter?.number ?? "—",
      cidade,
      uf,
      registro: row.registro_scdb ?? member?.demolay_id ?? null,
      foto: row.photo_url,
      profIniciatico: row.prof_iniciatico,
      profDemolay: row.prof_demolay,
      validade: row.valid_until,
      assinaturaMembro: row.member_signature_url,
      assinaturaConsultor: row.consultor_signature_url,
      qr: row.qr_url,
      codigo: row.verification_code,
      emissao: row.issued_at,
      endereco: buildEndereco(lodge, cidade, uf),
    }),
  };
}

const cardSelect = `
  id, chapter_id, member_id, status, issued_at, revoked_at,
  registro_scdb, photo_url, prof_iniciatico, prof_demolay, valid_until,
  member_signature_url, consultor_signature_url, qr_url, verification_code,
  member:members(full_name, demolay_id),
  chapter:chapters(id, name, number, city, state:states(uf))
`;

export const getMyDemolayProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyDemolayProfile> => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const { ids, fullName } = await findLinkedMemberIds(
      context.supabase,
      context.userId,
      email,
    );

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", context.userId)
      .maybeSingle();

    if (ids.length === 0) {
      return {
        profile: {
          id: context.userId,
          fullName: profile?.full_name ?? fullName,
          email,
        },
        members: [],
        cards: [],
      };
    }

    const { data: memberRows, error: membersError } = await context.supabase
      .from("members")
      .select(
        `id, chapter_id, full_name, demolay_id, masonic_id, status, kind,
         exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay,
         chapter:chapters(id, name, number, city, state:states(uf))`,
      )
      .in("id", ids)
      .order("full_name", { ascending: true });
    if (membersError) throw new Error(membersError.message);

    const members: LinkedMemberSummary[] = (memberRows ?? []).map((m: any) => {
      const chapter = m.chapter as ChapterJoin | null;
      return {
        id: m.id,
        chapterId: m.chapter_id,
        chapterName: chapter?.name ?? "—",
        chapterNumber: chapter?.number ?? "—",
        city: chapter?.city ?? null,
        uf: chapter?.state?.uf ?? null,
        fullName: m.full_name,
        demolayId: m.demolay_id,
        masonicId: m.masonic_id,
        status: m.status,
        kind: m.kind,
        grauLabel: grauOf(m).label,
        examGrauIniciatico: m.exam_grau_iniciatico,
        examGrauDemolay: m.exam_grau_demolay,
        iniciacaoOrdem: m.iniciacao_ordem,
        iniciacaoGrauDemolay: m.iniciacao_grau_demolay,
      };
    });

    const { data: cardRows, error: cardsError } = await context.supabase
      .from("proficiency_cards")
      .select(cardSelect)
      .in("member_id", ids)
      .eq("status", "active")
      .order("issued_at", { ascending: false });
    if (cardsError) throw new Error(cardsError.message);

    const chapterIds = [
      ...new Set((cardRows ?? []).map((c: any) => c.chapter_id as string)),
    ];
    const lodgeMap = await loadLodgeMap(context.supabase, chapterIds);

    const cards = (cardRows ?? []).map((row: any) =>
      mapCardRow(row, lodgeMap.get(row.chapter_id) ?? null),
    );

    return {
      profile: {
        id: context.userId,
        fullName: profile?.full_name ?? fullName,
        email,
      },
      members,
      cards,
    };
  });

export const listMemberProficiencyCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        memberId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<ProficiencyCardView[]> => {
    const { data: rows, error } = await context.supabase
      .from("proficiency_cards")
      .select(cardSelect)
      .eq("chapter_id", data.chapterId)
      .eq("member_id", data.memberId)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);

    const lodgeMap = await loadLodgeMap(context.supabase, [data.chapterId]);
    return (rows ?? []).map((row: any) =>
      mapCardRow(row, lodgeMap.get(row.chapter_id) ?? null),
    );
  });

export const issueProficiencyCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        memberId: z.string().uuid(),
        registroScdb: z.string().optional().nullable(),
        profIniciatico: z.string().optional().nullable(),
        profDemolay: z.string().optional().nullable(),
        validUntil: z.string().optional().nullable(),
        photoUrl: z.string().optional().nullable(),
        memberSignatureUrl: z.string().optional().nullable(),
        consultorSignatureUrl: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<ProficiencyCardView> => {
    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select(
        "id, chapter_id, full_name, demolay_id, exam_grau_iniciatico, exam_grau_demolay",
      )
      .eq("id", data.memberId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("Membro não encontrado");
    if (member.chapter_id !== data.chapterId) {
      throw new Error("Membro não pertence a este capítulo");
    }

    const { data: chapter, error: chapterError } = await context.supabase
      .from("chapters")
      .select("id, name, number, city, state:states(uf)")
      .eq("id", data.chapterId)
      .maybeSingle();
    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) throw new Error("Capítulo não encontrado");

    const year = new Date().getFullYear();
    const chapterNum = String(chapter.number || "CAP").replace(/\s+/g, "");
    const verificationCode = `${chapterNum}-${year}-${randomSuffix(4)}`;

    const validUntil =
      data.validUntil?.trim() ||
      `${year}-12-31`;

    const payload = {
      chapter_id: data.chapterId,
      member_id: data.memberId,
      issued_by: context.userId,
      status: "active" as const,
      registro_scdb:
        data.registroScdb?.trim() || member.demolay_id || null,
      photo_url: data.photoUrl?.trim() || null,
      prof_iniciatico:
        data.profIniciatico?.trim() ||
        ymd(member.exam_grau_iniciatico) ||
        null,
      prof_demolay:
        data.profDemolay?.trim() || ymd(member.exam_grau_demolay) || null,
      valid_until: validUntil,
      member_signature_url: data.memberSignatureUrl?.trim() || null,
      consultor_signature_url: data.consultorSignatureUrl?.trim() || null,
      qr_url: null,
      verification_code: verificationCode,
      note: data.note?.trim() || null,
    };

    const { data: inserted, error } = await context.supabase
      .from("proficiency_cards")
      .insert(payload)
      .select(cardSelect)
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Este membro já possui uma carteirinha ativa neste capítulo. Revogue a atual antes de emitir outra.",
        );
      }
      throw new Error(error.message);
    }

    const lodgeMap = await loadLodgeMap(context.supabase, [data.chapterId]);
    return mapCardRow(inserted as any, lodgeMap.get(data.chapterId) ?? null);
  });

export const revokeProficiencyCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        cardId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("proficiency_cards")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: context.userId,
      })
      .eq("id", data.cardId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
