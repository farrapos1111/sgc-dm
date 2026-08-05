import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { digitsOnly } from "@/lib/format";
import {
  MEMBER_DOCS_BUCKET,
  SIGNATURE_ROLES,
  SINDICANCIA_SIGNATURE_ROLES,
  ageBandFromBirthDate,
  docColumnForKind,
  extFromMime,
  investigationDocPath,
  sindicanciaSignaturePath,
  type AgeBand,
  type AtaTemplates,
  type IdDocKind,
  type SindicanciaSignatureRole,
} from "@/lib/member-documents";
import { ATA_TEMPLATE_ATE_14 } from "@/lib/sindicancia-ata-ate14";
import { ATA_TEMPLATE_15_17 } from "@/lib/sindicancia-ata-15-17";
import { ATA_TEMPLATE_18_MAIS } from "@/lib/sindicancia-ata-18-mais";

export const DEFAULT_ATA_TEMPLATES: AtaTemplates = {
  ate_14: ATA_TEMPLATE_ATE_14,
  "15_17": ATA_TEMPLATE_15_17,
  "18_mais": ATA_TEMPLATE_18_MAIS,
};

const chapterInput = z.object({ chapterId: z.string().uuid() });
const statusEnum = z.enum([
  "aberta",
  "em_andamento",
  "votacao_comissao",
  "aprovada",
  "reprovada",
  "arquivada",
]);

/** Cargos da gestão vigente com direito a voto na sindicância. */
export const SINDICANCIA_VOTE_POSITION_CODES = [
  "mestre_conselheiro",
  "primeiro_conselheiro",
  "segundo_conselheiro",
  "presidente_conselho_consultivo",
  "conselheiro_consultor",
] as const;

const addressSchema = z.object({
  zip: z.string().min(1),
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().optional().default(""),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().optional().default("Brasil"),
});

const guardianSchema = z.object({
  full_name: z.string().optional().default(""),
  relationship: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

const docsSchema = z.object({
  rg_front: z.string().min(1),
  rg_back: z.string().min(1),
});

const fileFieldsBase = z.object({
  candidate_name: z.string().min(1, "Informe o nome do candidato"),
  candidate_birth_date: z.string().min(1, "Informe a data de nascimento"),
  cpf: z.string().min(1, "Informe o CPF"),
  rg: z.string().min(1, "Informe o RG"),
  candidate_email: z.string().min(1, "Informe o e-mail"),
  candidate_phone: z.string().min(1, "Informe o telefone"),
  celular: z.string().min(1, "Informe o celular"),
  address: addressSchema,
  guardians: z.array(guardianSchema).min(1).max(2),
  sponsor_member_id: z.string().uuid().nullable().optional(),
  sponsor_text: z.string().nullable().optional(),
  sponsor_phone: z.string().nullable().optional(),
  has_demolay_relative: z.boolean().optional().default(false),
  demolay_relative_name: z.string().nullable().optional(),
  demolay_relative_chapter: z.string().nullable().optional(),
  has_mason_relative: z.boolean().optional().default(false),
  mason_relative_name: z.string().nullable().optional(),
  mason_relative_lodge: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  docs: docsSchema,
  opinion: z.string().nullable().optional(),
});

function refineFileFields(
  v: z.infer<typeof fileFieldsBase>,
  ctx: z.RefinementCtx,
) {
  if (!(v.guardians[0]?.full_name ?? "").trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Informe o responsável",
      path: ["guardians", 0, "full_name"],
    });
  }
  if (!(v.guardians[0]?.relationship ?? "").trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Informe o parentesco do responsável",
      path: ["guardians", 0, "relationship"],
    });
  }
  if (!v.sponsor_member_id && !(v.sponsor_text ?? "").trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Informe o padrinho / indicado por",
      path: ["sponsor_text"],
    });
  }
  if (v.has_demolay_relative) {
    if (!(v.demolay_relative_name ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Nome do parente DeMolay",
        path: ["demolay_relative_name"],
      });
    }
    if (!(v.demolay_relative_chapter ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Capítulo do parente DeMolay",
        path: ["demolay_relative_chapter"],
      });
    }
  }
  if (v.has_mason_relative) {
    if (!(v.mason_relative_name ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Nome do parente maçom",
        path: ["mason_relative_name"],
      });
    }
    if (!(v.mason_relative_lodge ?? "").trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Loja do parente maçom",
        path: ["mason_relative_lodge"],
      });
    }
  }
}

const fileFieldsSchema = fileFieldsBase.superRefine(refineFileFields);

function last2(value: string | null | undefined): string | null {
  const d = digitsOnly(value ?? "");
  return d.length >= 2 ? d.slice(-2) : null;
}

function formatAddressLine(
  address:
    | {
        zip?: string;
        street?: string;
        number?: string;
        complement?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
      }
    | null
    | undefined,
): string | null {
  if (!address || typeof address !== "object") return null;
  const street = String(address.street ?? "").trim();
  const number = String(address.number ?? "").trim();
  const neighborhood = String(address.neighborhood ?? "").trim();
  const city = String(address.city ?? "").trim();
  const state = String(address.state ?? "").trim();
  const zip = String(address.zip ?? "").trim();
  const parts = [
    [street, number].filter(Boolean).join(", "),
    neighborhood,
    [city, state].filter(Boolean).join(" — "),
    zip,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const FILE_SELECT =
  "id, chapter_id, candidate_name, candidate_birth_date, candidate_phone, candidate_email, guardian_name, referred_by, notes, status, created_at, updated_at, cpf, rg, cpf_last2, rg_last2, cpf_encrypted, rg_encrypted, cpf_hash, celular, address, guardians, sponsor_member_id, sponsor_text, sponsor_meta, has_demolay_relative, demolay_relative_name, demolay_relative_chapter, has_mason_relative, mason_relative_name, mason_relative_lodge, opinion, signup_source, doc_rg_front_path, doc_rg_back_path, doc_cpf_front_path, doc_cpf_back_path, lgpd_consent_text_version, lgpd_consented_at";

export type InvestigationFileRow = {
  id: string;
  chapter_id: string;
  candidate_name: string;
  candidate_birth_date: string | null;
  candidate_phone: string | null;
  candidate_email: string | null;
  guardian_name: string | null;
  referred_by: string | null;
  notes: string | null;
  status: "aberta" | "em_andamento" | "votacao_comissao" | "aprovada" | "reprovada" | "arquivada";
  created_at: string;
  updated_at: string;
  /** Sempre mascarado nas listagens — use revealInvestigationPii. */
  cpf: null;
  rg: null;
  cpf_last2: string | null;
  rg_last2: string | null;
  has_cpf: boolean;
  has_rg: boolean;
  celular: string | null;
  address: {
    zip?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
  } | null;
  guardians: Array<{
    full_name?: string;
    relationship?: string;
    cpf?: string;
    phone?: string;
    email?: string;
  }> | null;
  sponsor_member_id: string | null;
  sponsor_text: string | null;
  sponsor_meta: { phone?: string } | null;
  has_demolay_relative: boolean;
  demolay_relative_name: string | null;
  demolay_relative_chapter: string | null;
  has_mason_relative: boolean;
  mason_relative_name: string | null;
  mason_relative_lodge: string | null;
  opinion: string | null;
  signup_source: string;
  docs: {
    rg_front: boolean;
    rg_back: boolean;
    cpf_front: boolean;
    cpf_back: boolean;
  };
};

function sanitizeFileRow(row: Record<string, unknown>): InvestigationFileRow {
  const meta =
    row.sponsor_meta && typeof row.sponsor_meta === "object"
      ? (row.sponsor_meta as { phone?: string })
      : null;
  return {
    ...(row as unknown as InvestigationFileRow),
    cpf: null,
    rg: null,
    has_cpf: Boolean(row.cpf || row.cpf_last2 || row.cpf_encrypted || row.cpf_hash),
    has_rg: Boolean(row.rg || row.rg_last2 || row.rg_encrypted),
    sponsor_meta: meta,
    docs: {
      rg_front: Boolean(row.doc_rg_front_path),
      rg_back: Boolean(row.doc_rg_back_path),
      cpf_front: Boolean(row.doc_cpf_front_path),
      cpf_back: Boolean(row.doc_cpf_back_path),
    },
  };
}

function buildFilePayload(
  rest: z.infer<typeof fileFieldsSchema>,
  extras: { chapter_id?: string; created_by?: string; signup_source?: string } = {},
) {
  const cpf = digitsOnly(rest.cpf) || null;
  const rg = rest.rg.trim() || null;
  const guardians = (rest.guardians ?? [])
    .filter((g) => (g.full_name ?? "").trim())
    .map((g) => ({
      full_name: g.full_name.trim(),
      relationship: g.relationship ?? "",
      cpf: g.cpf ? digitsOnly(g.cpf) : "",
      phone: g.phone ?? "",
      email: g.email ?? "",
    }));
  const primaryGuardian = guardians[0]?.full_name ?? null;
  const sponsorName = rest.sponsor_member_id
    ? null
    : rest.sponsor_text?.trim() || null;
  const referredBy =
    rest.sponsor_text?.trim() ||
    (rest.sponsor_member_id ? "membro" : null);

  return {
    ...extras,
    candidate_name: rest.candidate_name.trim(),
    candidate_birth_date: rest.candidate_birth_date || null,
    cpf,
    rg,
    cpf_last2: last2(cpf),
    rg_last2: rg && rg.length >= 2 ? rg.slice(-2) : null,
    candidate_email: rest.candidate_email?.trim() || null,
    candidate_phone: rest.candidate_phone?.trim() || null,
    celular: rest.celular?.trim() || null,
    address: rest.address ?? {},
    guardians,
    sponsor_member_id: rest.sponsor_member_id || null,
    sponsor_text: rest.sponsor_member_id ? null : sponsorName,
    sponsor_meta: rest.sponsor_member_id
      ? {}
      : { phone: rest.sponsor_phone?.trim() || "" },
    has_demolay_relative: Boolean(rest.has_demolay_relative),
    demolay_relative_name: rest.has_demolay_relative
      ? rest.demolay_relative_name?.trim() || null
      : null,
    demolay_relative_chapter: rest.has_demolay_relative
      ? rest.demolay_relative_chapter?.trim() || null
      : null,
    has_mason_relative: Boolean(rest.has_mason_relative),
    mason_relative_name: rest.has_mason_relative
      ? rest.mason_relative_name?.trim() || null
      : null,
    mason_relative_lodge: rest.has_mason_relative
      ? rest.mason_relative_lodge?.trim() || null
      : null,
    notes: rest.notes?.trim() || null,
    opinion: rest.opinion ?? null,
    guardian_name: primaryGuardian,
    referred_by: referredBy,
    doc_rg_front_path: rest.docs.rg_front,
    doc_rg_back_path: rest.docs.rg_back,
    doc_cpf_front_path: null,
    doc_cpf_back_path: null,
  };
}

export const listFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("investigation_files")
      .select(FILE_SELECT)
      .eq("chapter_id", data.chapterId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown as Record<string, unknown>[]).map(
      sanitizeFileRow,
    );
  });

export const getFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("investigation_files")
      .select(FILE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ficha não encontrada");
    return sanitizeFileRow(row as unknown as Record<string, unknown>);
  });

/** Dados para edição: paths de docs + CPF/RG só se puder revelar (com audit). */
export const getFileForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("investigation_files")
      .select(FILE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ficha não encontrada");

    const r = row as Record<string, unknown>;
    const chapterId = r.chapter_id as string;

    const { data: canManage, error: mErr } = await context.supabase.rpc(
      "can_manage_commission" as never,
      { _chapter_id: chapterId, _commission_code: "sindicancias" } as never,
    );
    if (mErr) throw new Error(mErr.message);
    if (!canManage) throw new Error("Sem permissão para editar a ficha");

    const { data: canReveal } = await context.supabase.rpc(
      "can_reveal_id_documents" as never,
      { _chapter_id: chapterId } as never,
    );

    let cpf = "";
    let rg = "";
    if (canReveal) {
      const { data: plainCpf } = await context.supabase.rpc(
        "reveal_investigation_pii" as never,
        { _file_id: data.id, _field: "cpf" } as never,
      );
      const { data: plainRg } = await context.supabase.rpc(
        "reveal_investigation_pii" as never,
        { _file_id: data.id, _field: "rg" } as never,
      );
      cpf = typeof plainCpf === "string" ? plainCpf : "";
      rg = typeof plainRg === "string" ? plainRg : "";
    }

    const meta =
      r.sponsor_meta && typeof r.sponsor_meta === "object"
        ? (r.sponsor_meta as { phone?: string })
        : null;

    const guardians = Array.isArray(r.guardians)
      ? (r.guardians as Array<Record<string, string>>)
      : [];
    const address =
      r.address && typeof r.address === "object"
        ? (r.address as Record<string, string>)
        : {};

    return {
      id: data.id,
      candidate_name: String(r.candidate_name ?? ""),
      candidate_birth_date: (r.candidate_birth_date as string) ?? "",
      cpf,
      rg,
      keep_cpf: !canReveal && Boolean(r.cpf || r.cpf_last2),
      keep_rg: !canReveal && Boolean(r.rg || r.rg_last2),
      candidate_email: (r.candidate_email as string) ?? "",
      candidate_phone: (r.candidate_phone as string) ?? "",
      celular: (r.celular as string) ?? "",
      address: {
        zip: address.zip ?? "",
        street: address.street ?? "",
        number: address.number ?? "",
        complement: address.complement ?? "",
        neighborhood: address.neighborhood ?? "",
        city: address.city ?? "",
        state: address.state ?? "",
        country: address.country ?? "Brasil",
      },
      guardians: [
        {
          full_name: guardians[0]?.full_name ?? "",
          relationship: guardians[0]?.relationship ?? "",
          cpf: guardians[0]?.cpf ?? "",
          phone: guardians[0]?.phone ?? "",
          email: guardians[0]?.email ?? "",
        },
        {
          full_name: guardians[1]?.full_name ?? "",
          relationship: guardians[1]?.relationship ?? "",
          cpf: guardians[1]?.cpf ?? "",
          phone: guardians[1]?.phone ?? "",
          email: guardians[1]?.email ?? "",
        },
      ],
      sponsor_member_id: (r.sponsor_member_id as string) ?? null,
      sponsor_text: (r.sponsor_text as string) ?? (r.referred_by as string) ?? "",
      sponsor_phone: meta?.phone ?? "",
      has_demolay_relative: Boolean(r.has_demolay_relative),
      demolay_relative_name: (r.demolay_relative_name as string) ?? "",
      demolay_relative_chapter: (r.demolay_relative_chapter as string) ?? "",
      has_mason_relative: Boolean(r.has_mason_relative),
      mason_relative_name: (r.mason_relative_name as string) ?? "",
      mason_relative_lodge: (r.mason_relative_lodge as string) ?? "",
      notes: (r.notes as string) ?? "",
      docs: {
        rg_front: (r.doc_rg_front_path as string) ?? null,
        rg_back: (r.doc_rg_back_path as string) ?? null,
      },
    };
  });

export const createFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ chapterId: z.string().uuid() })
      .and(fileFieldsSchema)
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { chapterId, ...rest } = data;
    const payload = buildFilePayload(rest, {
      chapter_id: chapterId,
      created_by: context.userId,
      signup_source: "interno",
    });
    const { data: row, error } = await context.supabase
      .from("investigation_files")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const updateFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    fileFieldsBase
      .partial()
      .extend({
        id: z.string().uuid(),
        candidate_name: z.string().min(1),
        keep_cpf: z.boolean().optional(),
        keep_rg: z.boolean().optional(),
        keep_docs: z
          .object({
            rg_front: z.boolean().optional(),
            rg_back: z.boolean().optional(),
          })
          .optional(),
        status: statusEnum.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { id, status, keep_cpf, keep_rg, keep_docs, ...rest } = data;

    const { data: existing, error: eErr } = await context.supabase
      .from("investigation_files")
      .select(
        "cpf, rg, cpf_last2, rg_last2, cpf_encrypted, rg_encrypted, cpf_hash, doc_rg_front_path, doc_rg_back_path, doc_cpf_front_path, doc_cpf_back_path",
      )
      .eq("id", id)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!existing) throw new Error("Ficha não encontrada");

    const ex = existing as {
      cpf: string | null;
      rg: string | null;
      cpf_last2: string | null;
      rg_last2: string | null;
      cpf_encrypted: string | null;
      rg_encrypted: string | null;
      cpf_hash: string | null;
      doc_rg_front_path: string | null;
      doc_rg_back_path: string | null;
      doc_cpf_front_path: string | null;
      doc_cpf_back_path: string | null;
    };

    const mergeDocPath = (
      incoming: string | undefined,
      keep: boolean | undefined,
      existing: string | null,
    ) => {
      if (incoming) return incoming;
      // keep true/undefined → reuse existing; keep false → allow clear/null from rest
      if (keep === false) return "";
      return existing ?? "";
    };

    const docs = {
      rg_front: mergeDocPath(
        rest.docs?.rg_front,
        keep_docs?.rg_front,
        ex.doc_rg_front_path,
      ),
      rg_back: mergeDocPath(
        rest.docs?.rg_back,
        keep_docs?.rg_back,
        ex.doc_rg_back_path,
      ),
    };

    if (!docs.rg_front || !docs.rg_back) {
      throw new Error("Envie as imagens de Identidade (frente e verso)");
    }

    const keepingCpf = Boolean(keep_cpf && !digitsOnly(rest.cpf ?? ""));
    const cpfDigits = digitsOnly(rest.cpf ?? "");
    const hasStoredCpf = Boolean(
      ex.cpf || ex.cpf_encrypted || ex.cpf_hash || ex.cpf_last2,
    );
    if (!keepingCpf && cpfDigits.length !== 11) {
      throw new Error("Informe o CPF");
    }
    if (keepingCpf && !hasStoredCpf) {
      throw new Error("Informe o CPF");
    }

    const keepingRg = Boolean(keep_rg && !(rest.rg ?? "").trim());
    const rgDigits = (rest.rg ?? "").trim();
    const hasStoredRg = Boolean(ex.rg || ex.rg_encrypted || ex.rg_last2);
    if (!keepingRg && !rgDigits) {
      throw new Error("Informe o RG");
    }
    if (keepingRg && !hasStoredRg) {
      throw new Error("Informe o RG");
    }

    if (
      !rest.candidate_birth_date ||
      !rest.candidate_email ||
      !rest.candidate_phone ||
      !rest.celular ||
      !rest.address ||
      !rest.guardians?.length
    ) {
      throw new Error("Preencha todos os campos obrigatórios");
    }

    const payload = buildFilePayload({
      candidate_name: rest.candidate_name,
      candidate_birth_date: rest.candidate_birth_date,
      cpf: keepingCpf ? "" : cpfDigits,
      rg: keepingRg ? "" : rgDigits,
      candidate_email: rest.candidate_email,
      candidate_phone: rest.candidate_phone,
      celular: rest.celular,
      address: rest.address,
      guardians: rest.guardians,
      sponsor_member_id: rest.sponsor_member_id,
      sponsor_text: rest.sponsor_text,
      sponsor_phone: rest.sponsor_phone,
      has_demolay_relative: rest.has_demolay_relative ?? false,
      demolay_relative_name: rest.demolay_relative_name,
      demolay_relative_chapter: rest.demolay_relative_chapter,
      has_mason_relative: rest.has_mason_relative ?? false,
      mason_relative_name: rest.mason_relative_name,
      mason_relative_lodge: rest.mason_relative_lodge,
      notes: rest.notes ?? "",
      opinion: rest.opinion,
      docs: {
        rg_front: docs.rg_front,
        rg_back: docs.rg_back,
      },
    });

    const patch: Record<string, unknown> = { ...payload };
    if (status) patch.status = status;
    delete patch.chapter_id;
    delete patch.created_by;
    delete patch.signup_source;
    // Mantém imagens de CPF legadas (não são mais coletadas no formulário)
    patch.doc_cpf_front_path = ex.doc_cpf_front_path;
    patch.doc_cpf_back_path = ex.doc_cpf_back_path;
    if (keepingCpf) {
      delete patch.cpf;
      delete patch.cpf_last2;
    }
    if (keepingRg) {
      delete patch.rg;
      delete patch.rg_last2;
    }

    const { error } = await context.supabase
      .from("investigation_files")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), status: statusEnum }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("investigation_files")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFileOpinion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid(), opinion: z.string().nullable() })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("investigation_files")
      .update({ opinion: data.opinion })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("investigation_files")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- Upload / PII / docs ---------------------- */

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function assertAllowedImageMime(contentType: string): string {
  const mime = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    throw new Error(
      "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.",
    );
  }
  return mime;
}

const PUBLIC_UPLOAD_RATE_LIMIT = 30;
const PUBLIC_UPLOAD_RATE_WINDOW_MINUTES = 15;

async function createAnonClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient(url, key);
}

async function clientIpFromRequest(): Promise<string> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  throw new Error("Não foi possível validar a origem da requisição");
}

export const uploadInvestigationDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        kind: z.enum(["rg_front", "rg_back"]),
        fileName: z.string().min(1),
        contentType: z.string().min(1),
        base64: z.string().min(1),
        tempId: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const contentType = assertAllowedImageMime(data.contentType);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 3 * 1024 * 1024) throw new Error("Imagem maior que 3 MB");
    const ext = extFromMime(contentType);
    const tempId = data.tempId ?? crypto.randomUUID();
    const path = investigationDocPath(
      data.chapterId,
      tempId,
      data.kind as IdDocKind,
      ext,
    );
    const { error } = await context.supabase.storage
      .from(MEMBER_DOCS_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return { path, tempId };
  });

/** Público: upload de documento com token válido (service role). */
export const uploadInvestigationDocPublic = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().min(8),
        kind: z.enum(["rg_front", "rg_back"]),
        contentType: z.string().min(1),
        base64: z.string().min(1),
        tempId: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const contentType = assertAllowedImageMime(data.contentType);
    const anon = await createAnonClient();
    const { data: rows, error: rErr } = await anon.rpc(
      "resolve_investigation_signup_chapter",
      { _token: data.token },
    );
    if (rErr) throw new Error(rErr.message);
    const chapter = (Array.isArray(rows) ? rows[0] : rows) as
      | { id: string }
      | undefined;
    if (!chapter?.id) throw new Error("Link inválido ou expirado");

    const tempId = data.tempId ?? crypto.randomUUID();
    const clientIp = await clientIpFromRequest();
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: rateErr } = await supabaseAdmin.rpc(
      "record_investigation_public_attempt",
      {
        _token: data.token,
        _kind: "upload",
        _client_ip: clientIp,
        _cpf: null,
        _chapter_limit: PUBLIC_UPLOAD_RATE_LIMIT,
        _sender_limit: 10,
        _window_minutes: PUBLIC_UPLOAD_RATE_WINDOW_MINUTES,
      },
    );
    if (rateErr) throw new Error(rateErr.message);

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 3 * 1024 * 1024) throw new Error("Imagem maior que 3 MB");
    const ext = extFromMime(contentType);
    const path = investigationDocPath(
      chapter.id,
      tempId,
      data.kind as IdDocKind,
      ext,
    );
    const { error } = await supabaseAdmin.storage
      .from(MEMBER_DOCS_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return { path, tempId, chapterId: chapter.id };
  });

export const canRevealIdDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc(
      "can_reveal_id_documents" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { allowed: Boolean(ok) };
  });

export const revealInvestigationPii = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        fileId: z.string().uuid(),
        field: z.enum(["cpf", "rg"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: plain, error } = await context.supabase.rpc(
      "reveal_investigation_pii" as never,
      { _file_id: data.fileId, _field: data.field } as never,
    );
    if (error) throw new Error(error.message);
    return { value: (plain as string) ?? "" };
  });

export const getIdDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        entity: z.enum(["investigation", "member"]),
        id: z.string().uuid(),
        docKind: z.enum(["rg_front", "rg_back", "cpf_front", "cpf_back"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: path, error } = await context.supabase.rpc(
      "get_id_document_path" as never,
      {
        _entity: data.entity,
        _id: data.id,
        _doc_kind: data.docKind,
      } as never,
    );
    if (error) throw new Error(error.message);
    if (!path) return { url: null as string | null };
    const { data: signed, error: sErr } = await context.supabase.storage
      .from(MEMBER_DOCS_BUCKET)
      .createSignedUrl(path as string, 60 * 10);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

export const migrateInvestigationDocsToMember = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        fileId: z.string().uuid(),
        memberId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "migrate_investigation_docs_to_member" as never,
      {
        _file_id: data.fileId,
        _member_id: data.memberId,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- Sindicâncias (calendar + details) ---------------------- */

const DETAILS_SELECT = `
  calendar_event_id, chapter_id, file_id, nominee_name,
  senior_member_id, senior_text, investigator_member_id, investigator_text,
  clerk_member_id, clerk_text, opinion, status,
  event:calendar_events!sindicancia_details_calendar_event_id_fkey(
    id, title, start_at, end_at, location, address, description, event_type
  ),
  file:investigation_files(
    id, candidate_name, candidate_birth_date, guardians,
    candidate_email, candidate_phone, celular,
    has_mason_relative, mason_relative_name, mason_relative_lodge,
    has_demolay_relative, demolay_relative_name, demolay_relative_chapter,
    sponsor_text, referred_by, cpf_last2, rg_last2
  ),
  senior:members!sindicancia_details_senior_member_id_fkey(id, full_name),
  investigator:members!sindicancia_details_investigator_member_id_fkey(id, full_name),
  clerk:members!sindicancia_details_clerk_member_id_fkey(id, full_name)
`.replace(/\s+/g, " ");

export type SindicanciaListItem = {
  calendar_event_id: string;
  chapter_id: string;
  file_id: string | null;
  nominee_name: string;
  senior_member_id: string | null;
  senior_text: string | null;
  investigator_member_id: string | null;
  investigator_text: string | null;
  clerk_member_id: string | null;
  clerk_text: string | null;
  opinion: string | null;
  status: string;
  event: {
    id: string;
    title: string;
    start_at: string;
    end_at: string | null;
    location: string | null;
    address: string | null;
    description: string | null;
    event_type: string;
  } | null;
  file: {
    id: string;
    candidate_name: string;
    candidate_birth_date: string | null;
    guardians: InvestigationFileRow["guardians"];
    candidate_email: string | null;
    candidate_phone: string | null;
    celular: string | null;
    has_mason_relative: boolean;
    mason_relative_name: string | null;
    mason_relative_lodge: string | null;
    has_demolay_relative: boolean;
    demolay_relative_name: string | null;
    demolay_relative_chapter: string | null;
    sponsor_text: string | null;
    referred_by: string | null;
    cpf_last2: string | null;
    rg_last2: string | null;
  } | null;
  senior: { id: string; full_name: string } | null;
  investigator: { id: string; full_name: string } | null;
  clerk: { id: string; full_name: string } | null;
};

export const listSindicancias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }): Promise<SindicanciaListItem[]> => {
    const { data: rows, error } = await context.supabase
      .from("sindicancia_details" as never)
      .select(DETAILS_SELECT)
      .eq("chapter_id", data.chapterId);
    if (error) throw new Error(error.message);
    return (rows as unknown as SindicanciaListItem[]) ?? [];
  });

export const getSindicancia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ calendarEventId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<SindicanciaListItem> => {
    const { data: row, error } = await context.supabase
      .from("sindicancia_details" as never)
      .select(DETAILS_SELECT)
      .eq("calendar_event_id", data.calendarEventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Sindicância não encontrada");
    return row as unknown as SindicanciaListItem;
  });

const sindicanciaInput = z.object({
  chapterId: z.string().uuid(),
  title: z.string().min(1),
  start_at: z.string().datetime(),
  end_at: z.string().datetime().nullable().optional(),
  location: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  file_id: z.string().uuid().nullable().optional(),
  nominee_name: z.string().min(1),
  senior_member_id: z.string().uuid().nullable().optional(),
  senior_text: z.string().nullable().optional(),
  investigator_member_id: z.string().uuid().nullable().optional(),
  investigator_text: z.string().nullable().optional(),
  clerk_member_id: z.string().uuid().nullable().optional(),
  clerk_text: z.string().nullable().optional(),
  opinion: z.string().nullable().optional(),
  status: statusEnum.optional(),
});

export const createSindicancia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => sindicanciaInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: event, error: eErr } = await context.supabase
      .from("calendar_events")
      .insert({
        chapter_id: data.chapterId,
        title: data.title,
        event_type: "sindicancia" as never,
        mandatory: false,
        public_open: false,
        start_at: data.start_at,
        end_at: data.end_at ?? null,
        location: data.location ?? null,
        address: data.address ?? null,
        description: data.description ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (eErr) throw new Error(eErr.message);

    const { error: dErr } = await context.supabase
      .from("sindicancia_details" as never)
      .insert({
        calendar_event_id: event.id,
        chapter_id: data.chapterId,
        file_id: data.file_id || null,
        nominee_name: data.nominee_name,
        senior_member_id: data.senior_member_id || null,
        senior_text: data.senior_member_id
          ? null
          : data.senior_text?.trim() || null,
        investigator_member_id: data.investigator_member_id || null,
        investigator_text: data.investigator_member_id
          ? null
          : data.investigator_text?.trim() || null,
        clerk_member_id: data.clerk_member_id || null,
        clerk_text: data.clerk_member_id
          ? null
          : data.clerk_text?.trim() || null,
        opinion: data.opinion ?? null,
        status: data.status ?? "aberta",
      } as never);
    if (dErr) {
      await context.supabase.from("calendar_events").delete().eq("id", event.id);
      throw new Error(dErr.message);
    }
    return { ok: true, id: event.id as string };
  });

export const createSindicanciaFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        fileId: z.string().uuid(),
        start_at: z.string().datetime(),
        end_at: z.string().datetime().nullable().optional(),
        location: z.string().nullable().optional(),
        senior_member_id: z.string().uuid().nullable().optional(),
        senior_text: z.string().nullable().optional(),
        investigator_member_id: z.string().uuid().nullable().optional(),
        investigator_text: z.string().nullable().optional(),
        clerk_member_id: z.string().uuid().nullable().optional(),
        clerk_text: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase
      .from("investigation_files")
      .select("id, candidate_name, address, opinion")
      .eq("id", data.fileId)
      .eq("chapter_id", data.chapterId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Ficha não encontrada");

    const f = file as {
      id: string;
      candidate_name: string;
      address: InvestigationFileRow["address"];
      opinion: string | null;
    };

    const addrLine = data.location ?? formatAddressLine(f.address);

    const { data: event, error: eErr } = await context.supabase
      .from("calendar_events")
      .insert({
        chapter_id: data.chapterId,
        title: `Sindicância — ${f.candidate_name}`,
        event_type: "sindicancia" as never,
        mandatory: false,
        public_open: false,
        start_at: data.start_at,
        end_at: data.end_at ?? null,
        location: addrLine,
        address: addrLine,
        description: f.opinion,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (eErr) throw new Error(eErr.message);

    const { error: dErr } = await context.supabase
      .from("sindicancia_details" as never)
      .insert({
        calendar_event_id: event.id,
        chapter_id: data.chapterId,
        file_id: f.id,
        nominee_name: f.candidate_name,
        senior_member_id: data.senior_member_id || null,
        senior_text: data.senior_member_id
          ? null
          : data.senior_text?.trim() || null,
        investigator_member_id: data.investigator_member_id || null,
        investigator_text: data.investigator_member_id
          ? null
          : data.investigator_text?.trim() || null,
        clerk_member_id: data.clerk_member_id || null,
        clerk_text: data.clerk_member_id
          ? null
          : data.clerk_text?.trim() || null,
        opinion: f.opinion,
        status: "aberta",
      } as never);
    if (dErr) {
      await context.supabase.from("calendar_events").delete().eq("id", event.id);
      throw new Error(dErr.message);
    }
    return { ok: true, id: event.id as string };
  });

export const updateSindicancia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        calendar_event_id: z.string().uuid(),
        title: z.string().min(1).optional(),
        start_at: z.string().datetime().optional(),
        end_at: z.string().datetime().nullable().optional(),
        location: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        file_id: z.string().uuid().nullable().optional(),
        nominee_name: z.string().min(1).optional(),
        senior_member_id: z.string().uuid().nullable().optional(),
        senior_text: z.string().nullable().optional(),
        investigator_member_id: z.string().uuid().nullable().optional(),
        investigator_text: z.string().nullable().optional(),
        clerk_member_id: z.string().uuid().nullable().optional(),
        clerk_text: z.string().nullable().optional(),
        opinion: z.string().nullable().optional(),
        status: statusEnum.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { calendar_event_id, ...rest } = data;
    const eventPatch: Record<string, unknown> = {};
    if (rest.title !== undefined) eventPatch.title = rest.title;
    if (rest.start_at !== undefined) eventPatch.start_at = rest.start_at;
    if (rest.end_at !== undefined) eventPatch.end_at = rest.end_at;
    if (rest.location !== undefined) eventPatch.location = rest.location;
    if (rest.address !== undefined) eventPatch.address = rest.address;
    if (rest.description !== undefined) eventPatch.description = rest.description;

    if (Object.keys(eventPatch).length) {
      const { error } = await context.supabase
        .from("calendar_events")
        .update(eventPatch as never)
        .eq("id", calendar_event_id);
      if (error) throw new Error(error.message);
    }

    const detailPatch: Record<string, unknown> = {};
    for (const key of [
      "file_id",
      "nominee_name",
      "senior_member_id",
      "senior_text",
      "investigator_member_id",
      "investigator_text",
      "clerk_member_id",
      "clerk_text",
      "opinion",
      "status",
    ] as const) {
      if (rest[key] !== undefined) detailPatch[key] = rest[key];
    }
    if (Object.keys(detailPatch).length) {
      const { error } = await context.supabase
        .from("sindicancia_details" as never)
        .update(detailPatch as never)
        .eq("calendar_event_id", calendar_event_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteSindicancia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ calendar_event_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_events")
      .delete()
      .eq("id", data.calendar_event_id)
      .eq("event_type", "sindicancia" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- Ata formulário ---------------------- */

export type SindicanciaMinuteRow = {
  calendar_event_id: string;
  chapter_id: string;
  age_band: AgeBand;
  answers: Record<string, string | boolean | null>;
  signatures: Record<string, string | null>;
  completed_at: string | null;
  updated_at: string;
};

export const getSindicanciaMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ calendarEventId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sindicancia_minutes" as never)
      .select(
        "calendar_event_id, chapter_id, age_band, answers, signatures, completed_at, updated_at",
      )
      .eq("calendar_event_id", data.calendarEventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as SindicanciaMinuteRow | null) ?? null;
  });

export const saveSindicanciaMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        calendarEventId: z.string().uuid(),
        chapterId: z.string().uuid(),
        age_band: z.enum(["ate_14", "15_17", "18_mais"]),
        answers: z.record(z.union([z.string(), z.boolean(), z.null()])),
        signatures: z.record(
          z.enum(SINDICANCIA_SIGNATURE_ROLES),
          z.string().nullable(),
        ),
        completed: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    // Persist signature data URLs as storage PNGs when long
    const signatures: Record<string, string | null> = {
      ...data.signatures,
    };
    for (const [role, value] of Object.entries(signatures)) {
      if (!value || !value.startsWith("data:image")) continue;
      if (!SIGNATURE_ROLES.some((r) => r.id === role)) continue;
      const base64 = value.split(",")[1];
      if (!base64) continue;
      const bytes = Buffer.from(base64, "base64");
      const path = sindicanciaSignaturePath(
        data.chapterId,
        data.calendarEventId,
        role as SindicanciaSignatureRole,
      );
      const { error: upErr } = await context.supabase.storage
        .from(MEMBER_DOCS_BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);
      signatures[role] = path;
    }

    const payload: Record<string, unknown> = {
      calendar_event_id: data.calendarEventId,
      chapter_id: data.chapterId,
      age_band: data.age_band,
      answers: data.answers,
      signatures,
    };
    if (data.completed) {
      payload.completed_at = new Date().toISOString();
    } else {
      // Rascunho: não apaga conclusão prévia; só define null na primeira gravação.
      const { data: existing } = await context.supabase
        .from("sindicancia_minutes" as never)
        .select("completed_at")
        .eq("calendar_event_id", data.calendarEventId)
        .maybeSingle();
      if (!(existing as { completed_at?: string | null } | null)?.completed_at) {
        payload.completed_at = null;
      }
    }

    const { error } = await context.supabase
      .from("sindicancia_minutes" as never)
      .upsert(payload as never, { onConflict: "calendar_event_id" });
    if (error) throw new Error(error.message);

    if (data.completed) {
      const { error: stErr } = await context.supabase
        .from("sindicancia_details" as never)
        .update({ status: "votacao_comissao" } as never)
        .eq("calendar_event_id", data.calendarEventId);
      if (stErr) throw new Error(stErr.message);
    }

    return { ok: true };
  });

/* ---------------------- Votação da comissão ---------------------- */

async function resolveLinkedMemberIds(
  supabase: {
    from: (t: string) => any;
  },
  userId: string,
  chapterId: string,
  email: string | null,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: byUser } = await supabase
    .from("members")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("user_id", userId);
  for (const m of byUser ?? []) ids.add((m as { id: string }).id);

  if (email) {
    const { data: byEmail } = await supabase
      .from("members")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("email", email);
    for (const m of byEmail ?? []) ids.add((m as { id: string }).id);
  }

  return [...ids];
}

async function userCanVoteSindicancia(
  supabase: { from: (t: string) => any },
  opts: {
    userId: string;
    email: string | null;
    chapterId: string;
    year: number;
    semester: 1 | 2;
  },
): Promise<{ canVote: boolean; memberIds: string[]; reason?: string }> {
  const memberIds = await resolveLinkedMemberIds(
    supabase,
    opts.userId,
    opts.chapterId,
    opts.email,
  );
  if (memberIds.length === 0) {
    return { canVote: false, memberIds, reason: "Membro não vinculado" };
  }

  const { data: positions } = await supabase
    .from("member_positions")
    .select("member_id, position:positions(code)")
    .eq("chapter_id", opts.chapterId)
    .eq("term_year", opts.year)
    .eq("term_semester", opts.semester)
    .in("member_id", memberIds);

  const hasPosition = (positions ?? []).some((p: {
    position: { code: string } | null;
  }) =>
    SINDICANCIA_VOTE_POSITION_CODES.includes(
      (p.position?.code ?? "") as (typeof SINDICANCIA_VOTE_POSITION_CODES)[number],
    ),
  );

  const { data: commissions } = await supabase
    .from("commission_members")
    .select("id, commission:commissions(code)")
    .eq("chapter_id", opts.chapterId)
    .eq("term_year", opts.year)
    .eq("term_semester", opts.semester)
    .in("member_id", memberIds);

  const onCommission = (commissions ?? []).some(
    (c: { commission: { code: string } | null }) =>
      c.commission?.code === "sindicancias",
  );

  if (hasPosition || onCommission) {
    return { canVote: true, memberIds };
  }
  return {
    canVote: false,
    memberIds,
    reason: "Sem direito a voto nesta sindicância",
  };
}

export type SindicanciaVoteRow = {
  member_id: string;
  vote: "aprovada" | "reprovada";
  member_name: string | null;
  updated_at: string;
};

export const getSindicanciaVoting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        calendarEventId: z.string().uuid(),
        chapterId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { currentTerm } = await import("@/lib/terms");
    const term = currentTerm();
    const email =
      (context.claims as { email?: string } | null)?.email ?? null;
    const eligibility = await userCanVoteSindicancia(context.supabase, {
      userId: context.userId,
      email,
      chapterId: data.chapterId,
      year: term.year,
      semester: term.semester,
    });

    const { data: rows, error } = await context.supabase
      .from("sindicancia_votes" as never)
      .select(
        "member_id, vote, updated_at, member:members(full_name)",
      )
      .eq("calendar_event_id", data.calendarEventId);
    if (error) throw new Error(error.message);

    const votes: SindicanciaVoteRow[] = (
      (rows ?? []) as Array<{
        member_id: string;
        vote: "aprovada" | "reprovada";
        updated_at: string;
        member: { full_name: string } | null;
      }>
    ).map((r) => ({
      member_id: r.member_id,
      vote: r.vote,
      updated_at: r.updated_at,
      member_name: r.member?.full_name ?? null,
    }));

    const myMemberId = eligibility.memberIds[0] ?? null;
    const myVote =
      votes.find((v) => eligibility.memberIds.includes(v.member_id))?.vote ??
      null;

    const tally = {
      aprovada: votes.filter((v) => v.vote === "aprovada").length,
      reprovada: votes.filter((v) => v.vote === "reprovada").length,
    };

    return {
      canVote: eligibility.canVote,
      reason: eligibility.reason ?? null,
      myMemberId,
      myVote,
      votes,
      tally,
    };
  });

export const castSindicanciaVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        calendarEventId: z.string().uuid(),
        chapterId: z.string().uuid(),
        vote: z.enum(["aprovada", "reprovada"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { currentTerm } = await import("@/lib/terms");
    const term = currentTerm();
    const email =
      (context.claims as { email?: string } | null)?.email ?? null;

    const { data: detail, error: dErr } = await context.supabase
      .from("sindicancia_details" as never)
      .select("status, chapter_id")
      .eq("calendar_event_id", data.calendarEventId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    const d = detail as { status: string; chapter_id: string } | null;
    if (!d) throw new Error("Sindicância não encontrada");
    if (d.chapter_id !== data.chapterId) {
      throw new Error("Capítulo inválido para esta sindicância");
    }
    if (d.status !== "votacao_comissao") {
      throw new Error("Votação disponível apenas no status Votação Comissão");
    }

    const eligibility = await userCanVoteSindicancia(context.supabase, {
      userId: context.userId,
      email,
      chapterId: d.chapter_id,
      year: term.year,
      semester: term.semester,
    });
    if (!eligibility.canVote || !eligibility.memberIds[0]) {
      throw new Error(eligibility.reason || "Sem direito a voto");
    }

    const memberId = eligibility.memberIds[0];
    const { error } = await context.supabase
      .from("sindicancia_votes" as never)
      .upsert(
        {
          calendar_event_id: data.calendarEventId,
          chapter_id: d.chapter_id,
          member_id: memberId,
          vote: data.vote,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "calendar_event_id,member_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finalizeSindicanciaVoting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        calendarEventId: z.string().uuid(),
        chapterId: z.string().uuid(),
        result: z.enum(["aprovada", "reprovada"]).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: canManage, error: mErr } = await context.supabase.rpc(
      "can_manage_commission" as never,
      { _chapter_id: data.chapterId, _commission_code: "sindicancias" } as never,
    );
    if (mErr) throw new Error(mErr.message);
    if (!canManage) {
      throw new Error(
        "Apenas o presidente/gestor da comissão pode encerrar a votação",
      );
    }

    const { data: detail, error: dErr } = await context.supabase
      .from("sindicancia_details" as never)
      .select("chapter_id")
      .eq("calendar_event_id", data.calendarEventId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    const d = detail as { chapter_id: string } | null;
    if (!d) throw new Error("Sindicância não encontrada");
    if (d.chapter_id !== data.chapterId) {
      throw new Error("Capítulo inválido para esta sindicância");
    }

    const { data: votes, error } = await context.supabase
      .from("sindicancia_votes" as never)
      .select("vote")
      .eq("calendar_event_id", data.calendarEventId);
    if (error) throw new Error(error.message);
    const list = (votes ?? []) as Array<{ vote: string }>;
    const aprovada = list.filter((v) => v.vote === "aprovada").length;
    const reprovada = list.filter((v) => v.vote === "reprovada").length;

    if (aprovada === 0 && reprovada === 0) {
      throw new Error("Ainda não há votos registrados");
    }

    let result: "aprovada" | "reprovada";
    if (aprovada === reprovada) {
      if (!data.result) {
        throw new Error(
          "Empate na votação — escolha Aprovada ou Reprovada para encerrar",
        );
      }
      result = data.result;
    } else {
      result = aprovada > reprovada ? "aprovada" : "reprovada";
    }

    const { error: uErr } = await context.supabase
      .from("sindicancia_details" as never)
      .update({ status: result } as never)
      .eq("calendar_event_id", data.calendarEventId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, status: result };
  });

/** Elegibilidade a voto / acesso à área de sindicâncias (gestão vigente). */
export const getMySindicanciaAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { currentTerm } = await import("@/lib/terms");
    const term = currentTerm();
    const email =
      (context.claims as { email?: string } | null)?.email ?? null;
    const eligibility = await userCanVoteSindicancia(context.supabase, {
      userId: context.userId,
      email,
      chapterId: data.chapterId,
      year: term.year,
      semester: term.semester,
    });
    return {
      canAccess: eligibility.canVote,
      canVote: eligibility.canVote,
      reason: eligibility.reason ?? null,
    };
  });

/** Sindicâncias em aberto relevantes para o dashboard do membro. */
export const listOpenSindicanciasForMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { currentTerm } = await import("@/lib/terms");
    const term = currentTerm();
    const email =
      (context.claims as { email?: string } | null)?.email ?? null;
    const eligibility = await userCanVoteSindicancia(context.supabase, {
      userId: context.userId,
      email,
      chapterId: data.chapterId,
      year: term.year,
      semester: term.semester,
    });
    if (!eligibility.canVote) return [];

    const { data: rows, error } = await context.supabase
      .from("sindicancia_details" as never)
      .select(
        `
        calendar_event_id, nominee_name, status,
        event:calendar_events!sindicancia_details_calendar_event_id_fkey(start_at, title)
      `.replace(/\s+/g, " "),
      )
      .eq("chapter_id", data.chapterId)
      .in("status", ["aberta", "em_andamento", "votacao_comissao"]);
    if (error) throw new Error(error.message);

    const { data: myVotes } = await context.supabase
      .from("sindicancia_votes" as never)
      .select("calendar_event_id")
      .eq("chapter_id", data.chapterId)
      .in("member_id", eligibility.memberIds);

    const voted = new Set(
      ((myVotes ?? []) as Array<{ calendar_event_id: string }>).map(
        (v) => v.calendar_event_id,
      ),
    );

    return (
      (rows ?? []) as Array<{
        calendar_event_id: string;
        nominee_name: string;
        status: string;
        event: { start_at: string; title: string } | null;
      }>
    ).map((r) => ({
      calendar_event_id: r.calendar_event_id,
      nominee_name: r.nominee_name,
      status: r.status,
      start_at: r.event?.start_at ?? null,
      title: r.event?.title ?? null,
      needsMyVote:
        r.status === "votacao_comissao" && !voted.has(r.calendar_event_id),
    }));
  });

export const getSindicanciaAtaTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: chapter, error } = await context.supabase
      .from("chapters")
      .select("settings")
      .eq("id", data.chapterId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const settings = (chapter?.settings as Record<string, unknown> | null) ?? {};
    const rawTpl = settings.sindicancia_ata_templates;
    const merged: AtaTemplates = {
      ...DEFAULT_ATA_TEMPLATES,
      ...((rawTpl && typeof rawTpl === "object"
        ? rawTpl
        : {}) as Partial<AtaTemplates>),
    };
    // Capítulos sem modelo salvo usam o questionário padrão da faixa.
    for (const band of ["ate_14", "15_17", "18_mais"] as const) {
      if (!merged[band]?.blocks?.length) {
        merged[band] = DEFAULT_ATA_TEMPLATES[band];
      }
    }
    return merged;
  });

/* ---------------------- Templates + link público ---------------------- */

async function patchChapterSettings(
  supabase: {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => PromiseLike<{
            data: { settings?: unknown } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{
      data: unknown;
      error: { message: string } | null;
    }>;
  },
  chapterId: string,
  patch: Record<string, unknown | null>,
) {
  const { data, error } = await supabase.rpc("patch_chapter_settings", {
    _chapter_id: chapterId,
    _patch: patch,
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  const { data: current, error: fErr } = await supabase
    .from("chapters")
    .select("settings")
    .eq("id", chapterId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  return ((current?.settings as Record<string, unknown> | null) ??
    {}) as Record<string, unknown>;
}

export const getSindicanciaTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: chapter, error } = await context.supabase
      .from("chapters")
      .select("settings")
      .eq("id", data.chapterId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const settings = (chapter?.settings as Record<string, unknown> | null) ?? {};
    return {
      chave:
        typeof settings.sindicancia_chave_template === "string"
          ? settings.sindicancia_chave_template
          : null,
      parecer:
        typeof settings.sindicancia_parecer_template === "string"
          ? settings.sindicancia_parecer_template
          : null,
    };
  });

export const updateSindicanciaTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput
      .extend({
        chave: z.string().nullable().optional(),
        parecer: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown | null> = {};
    if (data.chave !== undefined) patch.sindicancia_chave_template = data.chave;
    if (data.parecer !== undefined)
      patch.sindicancia_parecer_template = data.parecer;
    await patchChapterSettings(
      context.supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              maybeSingle: () => PromiseLike<{
                data: { settings?: unknown } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{
          data: unknown;
          error: { message: string } | null;
        }>;
      },
      data.chapterId,
      patch,
    );
    return { ok: true };
  });

export const ensureInvestigationSignupToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    chapterInput.extend({ rotate: z.boolean().optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "ensure_investigation_signup_token" as never,
      {
        _chapter_id: data.chapterId,
        _rotate: data.rotate ?? false,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { token: token as string };
  });

export const getInvestigationSignupToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc(
      "get_investigation_signup_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { token: (token as string | null) ?? null };
  });

export const revokeInvestigationSignupToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => chapterInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "revoke_investigation_signup_token" as never,
      { _chapter_id: data.chapterId } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveInvestigationSignup = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ token: z.string().min(8) }).parse(raw))
  .handler(async ({ data }) => {
    const anon = await createAnonClient();
    const { data: rows, error } = await anon.rpc(
      "resolve_investigation_signup_chapter" as never,
      { _token: data.token } as never,
    );
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Link inválido ou expirado");
    return row as {
      id: string;
      name: string;
      number: string;
      city: string | null;
      primary_color: string;
      logo_url: string | null;
    };
  });

export const listInvestigationSignupMembers = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().min(8),
        search: z.string().trim().max(80),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    if (data.search.trim().length < 2) return [];
    const anon = await createAnonClient();
    const { data: rows, error } = await anon.rpc(
      "list_investigation_signup_members",
      { _token: data.token, _search: data.search },
    );
    if (error) throw new Error(error.message);
    return (rows as Array<{ id: string; full_name: string }>) ?? [];
  });

export const submitInvestigationSignup = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: z.string().min(8),
        tempId: z.string().uuid(),
        lgpd_consent_text_version: z.string().min(1),
      })
      .and(fileFieldsSchema)
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const anon = await createAnonClient();

    const guardians = data.guardians
      .filter((g: z.infer<typeof guardianSchema>) => g.full_name.trim())
      .map((g: z.infer<typeof guardianSchema>) => ({
        full_name: g.full_name.trim(),
        relationship: g.relationship ?? "",
        cpf: g.cpf ? digitsOnly(g.cpf) : "",
        phone: g.phone ?? "",
        email: g.email ?? "",
      }));

    const { data: id, error } = await anon.rpc("submit_investigation_signup", {
      _token: data.token,
      _candidate_name: data.candidate_name,
      _candidate_birth_date: data.candidate_birth_date,
      _cpf: data.cpf,
      _rg: data.rg,
      _candidate_email: data.candidate_email,
      _candidate_phone: data.candidate_phone,
      _celular: data.celular,
      _address: data.address,
      _guardians: guardians,
      _sponsor_member_id: data.sponsor_member_id || null,
      _sponsor_text: data.sponsor_text || null,
      _has_demolay_relative: data.has_demolay_relative ?? false,
      _demolay_relative_name: data.demolay_relative_name || null,
      _demolay_relative_chapter: data.demolay_relative_chapter || null,
      _has_mason_relative: data.has_mason_relative ?? false,
      _mason_relative_name: data.mason_relative_name || null,
      _mason_relative_lodge: data.mason_relative_lodge || null,
      _notes: data.notes || null,
      _doc_rg_front_path: data.docs.rg_front,
      _doc_rg_back_path: data.docs.rg_back,
      _doc_cpf_front_path: null,
      _doc_cpf_back_path: null,
      _sponsor_meta: data.sponsor_member_id
        ? {}
        : { phone: data.sponsor_phone?.trim() || "" },
      _temp_id: data.tempId,
      _lgpd_consent_text_version: data.lgpd_consent_text_version,
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: id as string };
  });

export { formatAddressLine, ageBandFromBirthDate, docColumnForKind };

export const DEFAULT_SINDICANCIA_CHAVE = `[capítulo]
CHAVE DE SINDICÂNCIA

Indicado: [indicado]
Padrinho: [padrinho]
Data: [data] às [hora]
Local: [local]
Sindicante: [sindicante]
Tio/Senior: [senior]
Escrivão de Parecer: [escrivao]
`;

export const DEFAULT_SINDICANCIA_PARECER = `Parecer da Sindicância referente ao indicado [indicado], realizada em [data].

Após as diligências cabíveis, a comissão manifesta o seguinte parecer:

`;

export const SINDICANCIA_TEMPLATE_VARS = [
  "capítulo",
  "indicado",
  "padrinho",
  "data",
  "hora",
  "local",
  "sindicante",
  "senior",
  "escrivao",
] as const;

/** Contexto para montar a chave de sindicância a partir do evento. */
export const getSindicanciaChaveContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ calendarEventId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: detail, error } = await context.supabase
      .from("sindicancia_details" as never)
      .select(
        `
        nominee_name, senior_text, investigator_text, clerk_text, chapter_id, file_id,
        senior:members!sindicancia_details_senior_member_id_fkey(full_name),
        investigator:members!sindicancia_details_investigator_member_id_fkey(full_name),
        clerk:members!sindicancia_details_clerk_member_id_fkey(full_name),
        file:investigation_files(
          sponsor_text, referred_by, sponsor_member_id,
          sponsor:members!investigation_files_sponsor_member_id_fkey(full_name)
        ),
        event:calendar_events!sindicancia_details_calendar_event_id_fkey(
          id, title, start_at, location, address, description
        )
      `.replace(/\s+/g, " "),
      )
      .eq("calendar_event_id", data.calendarEventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!detail) throw new Error("Sindicância não encontrada");

    const d = detail as {
      nominee_name: string;
      senior_text: string | null;
      investigator_text: string | null;
      clerk_text: string | null;
      chapter_id: string;
      file_id: string | null;
      senior: { full_name: string } | null;
      investigator: { full_name: string } | null;
      clerk: { full_name: string } | null;
      file: {
        sponsor_text: string | null;
        referred_by: string | null;
        sponsor_member_id: string | null;
        sponsor: { full_name: string } | null;
      } | null;
      event: {
        id: string;
        title: string;
        start_at: string;
        location: string | null;
        address: string | null;
        description: string | null;
      } | null;
    };

    const { data: chapter, error: cErr } = await context.supabase
      .from("chapters")
      .select("name, settings")
      .eq("id", d.chapter_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    const settings = (chapter?.settings as Record<string, unknown> | null) ?? {};
    const template =
      typeof settings.sindicancia_chave_template === "string"
        ? settings.sindicancia_chave_template
        : null;

    const padrinho =
      d.file?.sponsor?.full_name ||
      d.file?.sponsor_text ||
      d.file?.referred_by ||
      "";

    return {
      template,
      chapterName: chapter?.name ?? "",
      nominee: d.nominee_name || d.event?.title || "",
      start_at: d.event?.start_at ?? new Date().toISOString(),
      location: d.event?.location || d.event?.address || "",
      sindicante: d.investigator?.full_name || d.investigator_text || "",
      senior: d.senior?.full_name || d.senior_text || "",
      escrivao: d.clerk?.full_name || d.clerk_text || "",
      padrinho,
    };
  });
