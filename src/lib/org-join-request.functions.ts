import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sendTransactionalEmail } from "@/lib/email";
import { getTechCommissionEmails } from "@/lib/tech-commission";

export const ORG_JOIN_TYPES = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
  "abelhinhas",
  "arco_iris",
  "apj",
  "loja",
  "outro",
] as const;

export type OrgJoinType = (typeof ORG_JOIN_TYPES)[number];

export const ORG_JOIN_TYPE_LABELS: Record<OrgJoinType, string> = {
  capitulo: "Capítulo",
  priorado: "Priorado",
  castelo: "Castelo",
  bethel: "Bethel",
  abelhinhas: "Abelhinhas",
  arco_iris: "Arco Íris",
  apj: "APJ",
  loja: "Loja",
  outro: "Outro",
};

export const ACTIVE_MEMBERS_BANDS = [
  "5-10",
  "10-25",
  "25-30",
  "30+",
] as const;

export type ActiveMembersBand = (typeof ACTIVE_MEMBERS_BANDS)[number];

const phoneRegex = /^[\d\s()+-]{8,20}$/;

export const orgJoinRequestSchema = z
  .object({
    orgType: z.enum(ORG_JOIN_TYPES),
    orgTypeOther: z.string().trim().max(120).optional().nullable(),
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
    if (v.orgType !== "loja") {
      if (!v.sponsoringLodge?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["sponsoringLodge"],
          message: "Informe a loja patrocinadora",
        });
      }
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

function buildEmailBody(data: OrgJoinRequestInput): string {
  const typeLabel =
    data.orgType === "outro"
      ? `Outro (${data.orgTypeOther?.trim()})`
      : ORG_JOIN_TYPE_LABELS[data.orgType];

  const lines = [
    "Nova solicitação — Quero Adicionar à Minha Organização",
    "",
    `Tipo de organização: ${typeLabel}`,
    `Nome / Número: ${data.nameNumber}`,
    `Endereço completo: ${data.fullAddress}`,
    `Data de Fundação/Instalação: ${formatFoundedOn(data.foundedOn)}`,
    `Membros ativos: ${data.activeMembersBand}`,
  ];

  if (data.orgType !== "loja") {
    lines.push(`Loja patrocinadora: ${data.sponsoringLodge?.trim()}`);
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

async function edgeClientIp(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    for (const name of [
      "cf-connecting-ip",
      "true-client-ip",
      "x-vercel-forwarded-for",
      "fly-client-ip",
    ] as const) {
      const raw = request.headers.get(name)?.trim();
      if (!raw) continue;
      const ip = raw.split(",")[0]?.trim();
      if (ip) return ip.slice(0, 64);
    }
  } catch {
    /* sem request */
  }
  return null;
}

function hashOrgJoinKey(parts: string[]): string {
  return createHash("sha256")
    .update(parts.map((p) => p.trim().toLowerCase()).join("|"))
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
  const idKey = hashOrgJoinKey([email, phone]);
  const scopes: { scope: string; key: string }[] = [
    { scope: "org_join", key: idKey },
  ];
  if (ip) scopes.push({ scope: "org_join", key: `ip:${ip}` });

  const now = Date.now();
  for (const s of scopes) {
    const { data, error } = await supabaseAdmin
      .from("auth_login_throttle" as never)
      .select("locked_until")
      .eq("scope", s.scope)
      .eq("scope_key", s.key)
      .maybeSingle();
    if (error) {
      if (/auth_login_throttle|schema cache|does not exist/i.test(error.message)) {
        return;
      }
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
  const idKey = hashOrgJoinKey([email, phone]);
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
    if (error && !/auth_login_throttle|schema cache|does not exist/i.test(error.message)) {
      console.error("[org-join] throttle write failed", error.message);
    }
  }
}

export const submitOrgJoinRequest = createServerFn({ method: "POST" })
  .inputValidator((raw) => orgJoinRequestSchema.parse(raw))
  .handler(async ({ data }) => {
    const ip = await edgeClientIp();
    await assertOrgJoinNotThrottled(
      data.responsibleEmail,
      data.responsiblePhone,
      ip,
    );
    // Conta a tentativa antes do RPC (anti-spam de IP/e-mail).
    await recordOrgJoinAttempt(
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
        _sponsoring_lodge:
          data.orgType === "loja"
            ? null
            : data.sponsoringLodge?.trim() || null,
        _responsible_name: data.responsibleName,
        _responsible_phone: data.responsiblePhone,
        _responsible_email: data.responsibleEmail,
        _responsible_role: data.responsibleRole,
      } as never,
    );

    if (error) {
      console.error("[org-join] submit_org_join_request failed", error.message);
      const msg = error.message ?? "";
      if (/muitas solicitações/i.test(msg)) {
        throw new Error("Muitas solicitações. Tente novamente mais tarde.");
      }
      throw new Error("Não foi possível registrar a solicitação.");
    }

    const row = payload as { id?: string; ok?: boolean } | null;
    const id = row?.id;
    if (!id) throw new Error("Não foi possível registrar a solicitação.");

    const mail = await sendTransactionalEmail({
      to: getTechCommissionEmails(),
      subject: `[Templo Virtual] Solicitação de organização — ${data.nameNumber}`,
      text: buildEmailBody(data),
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
