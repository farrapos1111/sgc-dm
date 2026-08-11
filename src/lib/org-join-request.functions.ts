import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sendTransactionalEmail } from "@/lib/email";
import { getTechCommissionEmails } from "@/lib/tech-commission";
import { isMissingAuthLoginThrottleTable } from "@/lib/auth-throttle-errors";
import { resolveTrustedClientIp } from "@/lib/trusted-client-ip";
import {
  ORG_TYPE_LABELS,
  ORG_TYPES,
  needsSponsor,
  type BillingModel,
  type OrgType,
  type OrgTypeFormSchema,
} from "@/lib/org-types";

export const ORG_JOIN_TYPES = ORG_TYPES;

export type OrgJoinType = OrgType;

export const ORG_JOIN_TYPE_LABELS: Record<OrgJoinType, string> = {
  ...ORG_TYPE_LABELS,
};

export const ACTIVE_MEMBERS_BANDS = [
  "5-10",
  "10-25",
  "25-30",
  "30+",
] as const;

export type ActiveMembersBand = (typeof ACTIVE_MEMBERS_BANDS)[number];

export type OrgJoinPotencia = {
  id: string;
  nome: string;
  sigla: string;
  abrangencia: string;
  org_types: OrgJoinType[];
};

export type OrgJoinTypeDef = {
  org_type: OrgJoinType;
  label: string;
  unit_label: string;
  billing_model: BillingModel;
  rollout_scope: string;
  form_schema: OrgTypeFormSchema;
};

export type OrgJoinCatalog = {
  potencias: OrgJoinPotencia[];
  org_types: OrgJoinTypeDef[];
};

const phoneRegex = /^[\d\s()+-]{8,20}$/;

export const orgJoinRequestSchema = z
  .object({
    orgType: z.enum(ORG_JOIN_TYPES),
    orgTypeOther: z.string().trim().max(120).optional().nullable(),
    potenciaId: z.string().uuid("Informe a potência"),
    nameNumber: z.string().trim().min(1, "Informe o nome/número").max(200),
    fullAddress: z
      .string()
      .trim()
      .min(1, "Informe o endereço completo")
      .max(500),
    foundedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    activeMembersBand: z.enum(ACTIVE_MEMBERS_BANDS),
    sponsoringLodge: z.string().trim().max(200).optional().nullable(),
    responsibleName: z
      .string()
      .trim()
      .min(1, "Informe o nome do responsável")
      .max(200),
    responsiblePhone: z
      .string()
      .trim()
      .min(1, "Informe o telefone")
      .regex(phoneRegex, "Telefone inválido"),
    responsibleEmail: z
      .string()
      .trim()
      .email("E-mail inválido")
      .max(200),
    responsibleRole: z
      .string()
      .trim()
      .min(1, "Informe o cargo do responsável")
      .max(120),
    sponsorKind: z.enum(["loja", "capitulo"]).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.orgType === "outro") {
      if (!v.orgTypeOther?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["orgTypeOther"],
          message: "Descreva o tipo de organização",
        });
      }
    }
    const kind = v.sponsorKind ?? null;
    if (needsSponsor(kind) && !v.sponsoringLodge?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["sponsoringLodge"],
        message:
          kind === "capitulo"
            ? "Informe o capítulo patrocinador"
            : "Informe a loja patrocinadora",
      });
    }
  });

export type OrgJoinRequestInput = z.infer<typeof orgJoinRequestSchema>;

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient(url, key);
}

function formatFoundedOn(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function buildEmailBody(
  data: OrgJoinRequestInput,
  potenciaLabel: string | null,
  billing: string | null,
): string {
  const typeLabel =
    data.orgType === "outro"
      ? `Outro (${data.orgTypeOther?.trim()})`
      : ORG_JOIN_TYPE_LABELS[data.orgType];

  const lines = [
    "Nova solicitação — Quero Adicionar à Minha Organização",
    "",
    `Tipo de organização: ${typeLabel}`,
    potenciaLabel ? `Potência: ${potenciaLabel}` : null,
    billing ? `Modelo de cobrança: ${billing}` : null,
    `Nome / Número: ${data.nameNumber}`,
    `Endereço completo: ${data.fullAddress}`,
    `Data de Fundação/Instalação: ${formatFoundedOn(data.foundedOn)}`,
    `Membros ativos: ${data.activeMembersBand}`,
  ].filter(Boolean) as string[];

  if (needsSponsor(data.sponsorKind ?? null) && data.sponsoringLodge?.trim()) {
    const sponsorLabel =
      data.sponsorKind === "capitulo"
        ? "Capítulo patrocinador"
        : "Loja patrocinadora";
    lines.push(`${sponsorLabel}: ${data.sponsoringLodge.trim()}`);
  }

  lines.push(
    "",
    "Responsável",
    `Nome: ${data.responsibleName}`,
    `Cargo: ${data.responsibleRole}`,
    `Telefone: ${data.responsiblePhone}`,
    `E-mail: ${data.responsibleEmail}`,
  );

  return lines.join("\n");
}

const ORG_JOIN_WINDOW_MS = 15 * 60 * 1000;
const ORG_JOIN_IP_MAX = 8;
const ORG_JOIN_ID_MAX = 3;
const ORG_JOIN_LOCK_MS = 15 * 60 * 1000;

function digitsOnlyPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function hashOrgJoinKey(email: string, phone: string): string {
  return createHash("sha256")
    .update(
      [email.trim().toLowerCase(), digitsOnlyPhone(phone)].join("|"),
    )
    .digest("hex");
}

async function assertOrgJoinNotThrottled(
  email: string,
  phone: string,
  ip: string | null,
) {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const idKey = hashOrgJoinKey(email, phone);
  const scopes: { scope: string; key: string }[] = [
    { scope: "org_join", key: idKey },
  ];
  if (ip) scopes.push({ scope: "org_join", key: `ip:${ip}` });

  const now = Date.now();
  const reads = await Promise.all(
    scopes.map((s) =>
      supabaseAdmin
        .from("auth_login_throttle" as never)
        .select("locked_until")
        .eq("scope", s.scope)
        .eq("scope_key", s.key)
        .maybeSingle()
        .then((res) => ({ ...res, scope: s.scope })),
    ),
  );

  for (const { data, error } of reads) {
    if (error) {
      if (isMissingAuthLoginThrottleTable(error.message)) return;
      console.error("[org-join] throttle read failed", error.message);
      continue;
    }
    const locked = (data as { locked_until?: string | null } | null)
      ?.locked_until;
    if (locked && new Date(locked).getTime() > now) {
      throw new Error("Muitas solicitações. Tente novamente mais tarde.");
    }
  }
}

async function recordOrgJoinAttempt(
  email: string,
  phone: string,
  ip: string | null,
) {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const idKey = hashOrgJoinKey(email, phone);
  const jobs: { key: string; max: number }[] = [
    { key: idKey, max: ORG_JOIN_ID_MAX },
  ];
  if (ip) jobs.push({ key: `ip:${ip}`, max: ORG_JOIN_IP_MAX });

  for (const j of jobs) {
    const { error } = await supabaseAdmin.rpc(
      "record_login_throttle_failure" as never,
      {
        _scope: "org_join",
        _scope_key: j.key,
        _max_fails: j.max,
        _window_ms: ORG_JOIN_WINDOW_MS,
        _lock_ms: ORG_JOIN_LOCK_MS,
      } as never,
    );
    if (error && !isMissingAuthLoginThrottleTable(error.message)) {
      console.error("[org-join] throttle write failed", error.message);
    }
  }
}

function parseCatalog(raw: unknown): OrgJoinCatalog {
  const obj = (raw ?? {}) as {
    potencias?: unknown[];
    org_types?: unknown[];
  };
  const potencias: OrgJoinPotencia[] = (obj.potencias ?? []).map((p) => {
    const row = p as Record<string, unknown>;
    return {
      id: String(row.id),
      nome: String(row.nome ?? ""),
      sigla: String(row.sigla ?? ""),
      abrangencia: String(row.abrangencia ?? ""),
      org_types: ((row.org_types as string[]) ?? []).filter((t) =>
        (ORG_JOIN_TYPES as readonly string[]).includes(t),
      ) as OrgJoinType[],
    };
  });
  const org_types: OrgJoinTypeDef[] = (obj.org_types ?? [])
    .map((t) => {
      const row = t as Record<string, unknown>;
      const orgType = String(row.org_type);
      if (!(ORG_JOIN_TYPES as readonly string[]).includes(orgType)) return null;
      return {
        org_type: orgType as OrgJoinType,
        label: String(row.label ?? orgType),
        unit_label: String(row.unit_label ?? ""),
        billing_model: (row.billing_model === "pago" ? "pago" : "gratuito") as BillingModel,
        rollout_scope: String(row.rollout_scope ?? "RS"),
        form_schema: (row.form_schema ?? {}) as OrgTypeFormSchema,
      };
    })
    .filter(Boolean) as OrgJoinTypeDef[];
  return { potencias, org_types };
}

export const getOrgJoinCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<OrgJoinCatalog> => {
    const supabase = getPublicSupabase();
    const { data, error } = await supabase.rpc(
      "list_org_join_catalog" as never,
    );
    if (error) {
      console.error("[org-join] list_org_join_catalog failed", error.message);
      // Fallback estático se a migration ainda não estiver aplicada
      return {
        potencias: [],
        org_types: ORG_JOIN_TYPES.map((t) => ({
          org_type: t,
          label: ORG_JOIN_TYPE_LABELS[t],
          unit_label: ORG_JOIN_TYPE_LABELS[t],
          billing_model: (t === "loja" ? "pago" : "gratuito") as BillingModel,
          rollout_scope: "RS",
          form_schema: {
            sponsor_kind:
              t === "loja" || t === "alumni"
                ? null
                : t === "castelo" || t === "priorado"
                  ? "capitulo"
                  : "loja",
          },
        })),
      };
    }
    return parseCatalog(data);
  },
);

export const submitOrgJoinRequest = createServerFn({ method: "POST" })
  .inputValidator((raw) => orgJoinRequestSchema.parse(raw))
  .handler(async ({ data }) => {
    const ip = await resolveTrustedClientIp();
    await assertOrgJoinNotThrottled(
      data.responsibleEmail,
      data.responsiblePhone,
      ip,
    );

    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "submit_org_join_request" as never,
      {
        _org_type: data.orgType,
        _org_type_other:
          data.orgType === "outro" ? data.orgTypeOther?.trim() || null : null,
        _name_number: data.nameNumber,
        _full_address: data.fullAddress,
        _founded_on: data.foundedOn,
        _active_members_band: data.activeMembersBand,
        _sponsoring_lodge: needsSponsor(data.sponsorKind ?? null)
          ? data.sponsoringLodge?.trim() || null
          : null,
        _responsible_name: data.responsibleName,
        _responsible_phone:
          digitsOnlyPhone(data.responsiblePhone) || data.responsiblePhone,
        _responsible_email: data.responsibleEmail,
        _responsible_role: data.responsibleRole,
        _potencia_id: data.potenciaId,
      } as never,
    );

    if (error) {
      console.error("[org-join] submit_org_join_request failed", error.message);
      const msg = error.message ?? "";
      const code = (error as { code?: string }).code ?? "";
      if (/muitas solicitações/i.test(msg)) {
        await recordOrgJoinAttempt(
          data.responsibleEmail,
          data.responsiblePhone,
          null,
        );
        throw new Error("Muitas solicitações. Tente novamente mais tarde.");
      }
      if (code !== "22023") {
        await recordOrgJoinAttempt(
          data.responsibleEmail,
          data.responsiblePhone,
          null,
        );
      }
      if (code === "22023" && msg.trim()) {
        throw new Error(msg);
      }
      throw new Error("Não foi possível registrar a solicitação.");
    }

    await recordOrgJoinAttempt(
      data.responsibleEmail,
      data.responsiblePhone,
      null,
    );

    const row = payload as { id?: string; ok?: boolean } | null;
    const id = row?.id;
    if (!id) throw new Error("Não foi possível registrar a solicitação.");

    let potenciaLabel: string | null = null;
    let billing: string | null = null;
    try {
      const catalog = await getOrgJoinCatalog();
      const pot = catalog.potencias.find((p) => p.id === data.potenciaId);
      if (pot) potenciaLabel = `${pot.nome} (${pot.sigla})`;
      const def = catalog.org_types.find((t) => t.org_type === data.orgType);
      if (def) {
        billing = def.billing_model === "pago" ? "Pago" : "Gratuito";
      }
    } catch {
      // best-effort
    }

    const mail = await sendTransactionalEmail({
      to: getTechCommissionEmails(),
      subject: `[Templo Virtual] Solicitação de organização — ${data.nameNumber}`,
      text: buildEmailBody(data, potenciaLabel, billing),
    });

    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailError: string | null = null;
    if (mail.ok) {
      emailStatus = "sent";
    } else if (mail.skipped) {
      emailStatus = "skipped";
      emailError = mail.reason;
    } else {
      emailStatus = "failed";
      emailError = mail.error;
    }

    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      await supabaseAdmin
        .from("org_join_requests" as never)
        .update({
          email_status: emailStatus,
          email_error: emailError,
        } as never)
        .eq("id", id);
    } catch {
      // Persistência do status de e-mail é best-effort; o registro já existe.
    }

    return { ok: true as const, id, emailStatus };
  });
