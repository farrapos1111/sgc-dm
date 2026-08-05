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
         chapter:chapters!members_chapter_id_fkey(id, name, number, city, state:states(uf))`,
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

// ---------------------------------------------------------------------------
// Self-service: próprio perfil (cadastro, frequência, cobranças, histórico)
// ---------------------------------------------------------------------------

async function assertOwnMemberId(
  supabase: { from: (t: string) => any },
  userId: string,
  email: string | null,
  memberId: string,
): Promise<void> {
  const { ids } = await findLinkedMemberIds(supabase, userId, email);
  if (!ids.includes(memberId)) {
    throw new Error("Este cadastro não está vinculado à sua conta");
  }
}

const addressSchema = z.object({
  zip: z.string().optional().default(""),
  street: z.string().optional().default(""),
  number: z.string().optional().default(""),
  complement: z.string().optional().default(""),
  neighborhood: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  country: z.string().optional().default("Brasil"),
});

const guardianUpdateSchema = z.object({
  id: z.string().uuid(),
  relationship: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

export type MyCadastroMember = {
  id: string;
  chapter_id: string;
  chapter_name: string | null;
  full_name: string;
  birth_date: string | null;
  status: string;
  kind: string;
  demolay_id: string | null;
  masonic_id: string | null;
  phone: string;
  email: string;
  address: Record<string, string>;
  cpf_last2: string | null;
  rg_last2: string | null;
  iniciacao_ordem: string | null;
  exam_grau_iniciatico: string | null;
  iniciacao_grau_demolay: string | null;
  exam_grau_demolay: string | null;
};

export type MyCadastroGuardian = {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string;
  cpf_last2: string | null;
  is_primary: boolean;
};

export const getMyMemberCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await assertOwnMemberId(
      context.supabase,
      context.userId,
      email,
      data.memberId,
    );

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: member, error } = await supabaseAdmin
      .from("members")
      .select(
        `id, chapter_id, full_name, birth_date, status, kind, demolay_id, masonic_id,
         phone, email, address, cpf_last2, rg_last2,
         iniciacao_ordem, exam_grau_iniciatico, iniciacao_grau_demolay, exam_grau_demolay,
         chapter:chapters!members_chapter_id_fkey(name, number)`,
      )
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");

    const { data: guardians, error: gErr } = await supabaseAdmin
      .from("guardians")
      .select("id, full_name, relationship, phone, email, cpf_last2, is_primary")
      .eq("member_id", data.memberId)
      .order("is_primary", { ascending: false });
    if (gErr) throw new Error(gErr.message);

    const chapter = member.chapter as
      | { name?: string; number?: string }
      | { name?: string; number?: string }[]
      | null;
    const ch = Array.isArray(chapter) ? chapter[0] : chapter;
    const addr = (member.address ?? {}) as Record<string, string>;

    const cadastro: MyCadastroMember = {
      id: member.id,
      chapter_id: member.chapter_id,
      chapter_name: ch?.name
        ? `${ch.name}${ch.number ? ` nº ${ch.number}` : ""}`
        : null,
      full_name: member.full_name,
      birth_date: member.birth_date,
      status: member.status,
      kind: member.kind,
      demolay_id: member.demolay_id,
      masonic_id: member.masonic_id,
      phone: member.phone ?? "",
      email: member.email ?? "",
      address: {
        zip: addr.zip ?? "",
        street: addr.street ?? "",
        number: addr.number ?? "",
        complement: addr.complement ?? "",
        neighborhood: addr.neighborhood ?? "",
        city: addr.city ?? "",
        state: addr.state ?? "",
        country: addr.country ?? "Brasil",
      },
      cpf_last2: member.cpf_last2 ?? null,
      rg_last2: member.rg_last2 ?? null,
      iniciacao_ordem: member.iniciacao_ordem,
      exam_grau_iniciatico: member.exam_grau_iniciatico,
      iniciacao_grau_demolay: member.iniciacao_grau_demolay,
      exam_grau_demolay: member.exam_grau_demolay,
    };

    return {
      member: cadastro,
      guardians: (guardians ?? []).map((g) => ({
        id: g.id,
        full_name: g.full_name,
        relationship: g.relationship ?? "",
        phone: g.phone ?? "",
        email: g.email ?? "",
        cpf_last2: g.cpf_last2 ?? null,
        is_primary: Boolean(g.is_primary),
      })) as MyCadastroGuardian[],
    };
  });

export const updateMyMemberCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        phone: z.string().optional().default(""),
        email: z.string().optional().default(""),
        address: addressSchema,
        cpf: z.string().optional().default(""),
        rg: z.string().optional().default(""),
        guardians: z.array(guardianUpdateSchema).max(2).optional().default([]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await assertOwnMemberId(
      context.supabase,
      context.userId,
      email,
      data.memberId,
    );

    const { data: member, error } = await context.supabase
      .from("members")
      .select("id, demolay_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member?.demolay_id) {
      throw new Error(
        "Seu cadastro ainda não possui ID DeMolay. Peça à secretaria para preencher.",
      );
    }

    const { data: payload, error: rpcErr } = await context.supabase.rpc(
      "submit_member_cadastro_update" as never,
      {
        _demolay_id: member.demolay_id,
        _phone: data.phone || null,
        _email: data.email || null,
        _address: data.address,
        _cpf: data.cpf || null,
        _rg: data.rg || null,
        _guardians: data.guardians,
      } as never,
    );
    if (rpcErr) throw new Error(rpcErr.message);
    return payload as { ok: boolean; changed: boolean; member_id: string };
  });

export const getMyMemberAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await assertOwnMemberId(
      context.supabase,
      context.userId,
      email,
      data.memberId,
    );

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await supabaseAdmin
      .from("attendance_records")
      .select(
        "id, status, justification, calendar_event:calendar_events(id, title, event_type, mandatory, start_at)",
      )
      .eq("member_id", data.memberId);
    if (error) throw new Error(error.message);
    return (rows ?? []).sort((a: any, b: any) =>
      (b.calendar_event?.start_at ?? "").localeCompare(
        a.calendar_event?.start_at ?? "",
      ),
    );
  });

export const getMyMemberFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        chapterId: z.string().uuid(),
        year: z.number().int().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await assertOwnMemberId(
      context.supabase,
      context.userId,
      email,
      data.memberId,
    );

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { currentYearMonthInAppTz } = await import("@/lib/timezone");

    const { year: appYear, month: appMonth } = currentYearMonthInAppTz();
    const year = data.year ?? appYear;

    const { data: chapterRow } = await supabaseAdmin
      .from("chapters")
      .select("settings")
      .eq("id", data.chapterId)
      .maybeSingle();
    const settings = (chapterRow?.settings ?? {}) as Record<string, unknown>;
    const rawDefault = settings.default_dues_amount;
    const parsedDefault =
      typeof rawDefault === "number" ? rawDefault : Number(rawDefault);
    const defaultAmount =
      Number.isFinite(parsedDefault) && parsedDefault >= 0
        ? parsedDefault
        : 50;

    const [duesRes, chargesRes, memberRes] = await Promise.all([
      supabaseAdmin
        .from("member_dues")
        .select(
          "id, competence_year, competence_month, amount, status, paid_at, cash_entry_id",
        )
        .eq("chapter_id", data.chapterId)
        .eq("member_id", data.memberId)
        .eq("competence_year", year)
        .order("competence_month", { ascending: true }),
      supabaseAdmin
        .from("member_charges")
        .select(
          "id, kind, category, description, amount, due_date, status, paid_at, cash_entry_id, created_at",
        )
        .eq("chapter_id", data.chapterId)
        .eq("member_id", data.memberId)
        .order("due_date", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("members")
        .select("id, full_name, status, kind, birth_date, iniciacao_ordem")
        .eq("id", data.memberId)
        .maybeSingle(),
    ]);
    if (duesRes.error) throw new Error(duesRes.error.message);
    if (chargesRes.error) throw new Error(chargesRes.error.message);
    if (memberRes.error) throw new Error(memberRes.error.message);

    const charges = chargesRes.data ?? [];
    const chargeIds = charges.map((c) => c.id);
    const paidByCharge = new Map<string, number>();
    if (chargeIds.length) {
      const { data: payments, error: payErr } = await supabaseAdmin
        .from("member_charge_payments" as never)
        .select("charge_id, amount")
        .eq("chapter_id", data.chapterId)
        .in("charge_id", chargeIds);
      if (payErr) throw new Error(payErr.message);
      for (const p of (payments as Array<{
        charge_id: string;
        amount: number | string;
      }>) ?? []) {
        paidByCharge.set(
          p.charge_id,
          (paidByCharge.get(p.charge_id) ?? 0) + Number(p.amount),
        );
      }
    }

    const dues = (duesRes.data ?? []).map((d) => {
      const stored = Number(d.amount);
      const status = d.status as string;
      const amount =
        status === "pago" && Number.isFinite(stored) ? stored : defaultAmount;
      return {
        id: d.id,
        year: d.competence_year,
        month: d.competence_month,
        amount,
        status,
        paid_at: d.paid_at as string | null,
      };
    });

    const chargesOut = charges.map((c) => {
      const amount = Number(c.amount) || 0;
      let amountPaid = paidByCharge.get(c.id) ?? 0;
      if (amountPaid === 0 && c.status === "pago" && c.cash_entry_id) {
        amountPaid = amount;
      }
      amountPaid = Math.min(amountPaid, amount);
      return {
        id: c.id,
        kind: c.kind as string,
        category: c.category,
        description: c.description,
        amount,
        amount_paid: amountPaid,
        remaining: Math.max(0, amount - amountPaid),
        due_date: c.due_date as string,
        status: c.status as string,
        paid_at: c.paid_at as string | null,
      };
    });

    let duesOpenAmount = 0;
    let duesOpenCount = 0;
    for (const d of dues) {
      if (d.status !== "em_aberto") continue;
      if (d.year > appYear || (d.year === appYear && d.month > appMonth)) continue;
      duesOpenCount += 1;
      duesOpenAmount += d.amount;
    }

    let chargesOpenAmount = 0;
    let chargesOpenCount = 0;
    for (const c of chargesOut) {
      if (c.status === "isento") continue;
      if (c.remaining <= 0) continue;
      chargesOpenCount += 1;
      chargesOpenAmount += c.remaining;
    }

    return {
      year,
      defaultAmount,
      dues,
      charges: chargesOut,
      member: memberRes.data
        ? {
            id: memberRes.data.id,
            full_name: memberRes.data.full_name,
            status: memberRes.data.status,
            kind: memberRes.data.kind,
            birth_date: memberRes.data.birth_date,
            iniciacao_ordem: memberRes.data.iniciacao_ordem,
          }
        : null,
      summary: {
        duesOpenCount,
        duesOpenAmount,
        chargesOpenCount,
        chargesOpenAmount,
        totalOpen: duesOpenAmount + chargesOpenAmount,
      },
    };
  });

export const getMyMemberOrgHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await assertOwnMemberId(
      context.supabase,
      context.userId,
      email,
      data.memberId,
    );

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const [pos, com] = await Promise.all([
      supabaseAdmin
        .from("member_positions")
        .select(
          "id, chapter_id, term_year, term_semester, position:positions(id, code, label, scope), chapter:chapters(id, name, number)",
        )
        .eq("member_id", data.memberId)
        .order("term_year", { ascending: false })
        .order("term_semester", { ascending: false }),
      supabaseAdmin
        .from("commission_members")
        .select(
          "id, chapter_id, role, term_year, term_semester, commission:commissions(id, label), chapter:chapters(id, name, number)",
        )
        .eq("member_id", data.memberId)
        .order("term_year", { ascending: false })
        .order("term_semester", { ascending: false }),
    ]);
    if (pos.error) throw new Error(pos.error.message);
    if (com.error) throw new Error(com.error.message);
    return { positions: pos.data ?? [], commissions: com.data ?? [] };
  });
