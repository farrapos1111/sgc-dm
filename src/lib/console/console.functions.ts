/**
 * Server functions do Console da plataforma (console.templovirtual.app).
 * Todas exigem admin de plataforma com 2FA e usam o cliente service-role
 * só depois dessa checagem. Toda escrita vai para platform_audit_log.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORG_TYPES } from "@/lib/org-types";
import type { ConsoleContext } from "@/lib/console/console.server";

type Ctx = { supabase: unknown; userId: string; claims: Record<string, unknown> };

async function gate(context: unknown): Promise<ConsoleContext> {
  const { requireConsoleAdmin } = await import("@/lib/console/console.server");
  return requireConsoleAdmin(context as Ctx);
}

async function audit(
  ctx: ConsoleContext,
  action: string,
  target?: { type: string; id: string | null },
  details?: Record<string, unknown>,
) {
  const { consoleAudit } = await import("@/lib/console/console.server");
  await consoleAudit(ctx, action, target, details);
}

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const STAGES = ["novo", "em_contato", "aprovado", "recusado"] as const;
export type Stage = (typeof STAGES)[number];

export const CONSOLE_ROLES = [
  { name: "admin_total", label: "Administrador total" },
  { name: "mestre_conselheiro", label: "Dirigente máximo" },
  { name: "escrivao", label: "Secretaria" },
  { name: "tesoureiro", label: "Tesouraria" },
  { name: "membro", label: "Membro" },
] as const;
const roleNames = CONSOLE_ROLES.map((r) => r.name) as [string, ...string[]];

/* =================================================================== */
/* Sessão                                                               */
/* =================================================================== */

/** Não exige 2FA: diz ao cliente em que passo do acesso o usuário está. */
export const getConsoleSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isPlatformAdmin } = await import("@/lib/console/console.server");
    const c = context as Ctx;
    const admin = await isPlatformAdmin(c.userId);
    return {
      userId: c.userId,
      email: typeof c.claims.email === "string" ? c.claims.email : null,
      isPlatformAdmin: admin,
      aal: (c.claims.aal as string | undefined) ?? "aal1",
    };
  });

/* =================================================================== */
/* Visão geral                                                          */
/* =================================================================== */

export const consoleOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await gate(context);
    const a = ctx.admin;
    const [chapters, requests, profiles, audits, failedEmails] = await Promise.all([
      a.from("chapters").select("id, org_type, realm, active"),
      a.from("org_join_requests").select("id, stage"),
      a.from("profiles").select("id", { count: "exact", head: true }),
      a
        .from("platform_audit_log")
        .select(
          "id, action, target_type, target_id, details, created_at, actor:profiles(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(12),
      a
        .from("org_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("email_status", "failed"),
    ]);
    const ch = must(chapters) as { org_type: string; realm: string | null; active: boolean }[];
    const rq = must(requests) as { stage: string }[];
    const byRealm: Record<string, { total: number; active: number }> = {};
    for (const c of ch) {
      const k = c.realm ?? "outros";
      byRealm[k] ??= { total: 0, active: 0 };
      byRealm[k].total++;
      if (c.active) byRealm[k].active++;
    }
    const byStage: Record<string, number> = {};
    for (const r of rq) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    if (profiles.error) throw new Error(profiles.error.message);
    return {
      byRealm,
      byStage,
      totalChapters: ch.length,
      totalAccounts: profiles.count ?? 0,
      failedEmails: failedEmails.count ?? 0,
      recentAudit: must(audits) as AuditRow[],
    };
  });

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type AuditRow = {
  id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Json;
  created_at: string;
  actor: { full_name: string | null } | null;
};

export const consoleListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        targetType: z.string().max(40).optional(),
        targetId: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    let q = ctx.admin
      .from("platform_audit_log")
      .select("id, action, target_type, target_id, details, created_at, actor:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.targetType) q = q.eq("target_type", data.targetType);
    if (data.targetId) q = q.eq("target_id", data.targetId);
    return { items: must(await q) as AuditRow[] };
  });

/* =================================================================== */
/* Tabelas auxiliares                                                   */
/* =================================================================== */

export const consoleLookups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await gate(context);
    const a = ctx.admin;
    const [states, regions, potencias, admins] = await Promise.all([
      a.from("states").select("id, name, uf").order("name"),
      a.from("regions").select("id, name, state_id").order("name"),
      a.from("potencias").select("id, nome, sigla").order("nome"),
      a
        .from("platform_admins")
        .select("user_id, label, profile:profiles(full_name)")
        .eq("active", true),
    ]);
    return {
      states: (must(states) ?? []) as { id: string; name: string; uf: string }[],
      regions: (must(regions) ?? []) as { id: string; name: string; state_id: string }[],
      potencias: (potencias.error ? [] : (potencias.data ?? [])) as {
        id: string;
        nome: string;
        sigla: string | null;
      }[],
      admins: (
        (must(admins) ?? []) as {
          user_id: string;
          label: string | null;
          profile: { full_name: string | null } | null;
        }[]
      ).map((r) => ({ userId: r.user_id, name: r.profile?.full_name || r.label || "Admin" })),
      roles: CONSOLE_ROLES,
    };
  });

/* =================================================================== */
/* Pedidos                                                              */
/* =================================================================== */

const REQUEST_SELECT =
  "id, org_type, org_type_other, name_number, full_address, founded_on, active_members_band, sponsoring_lodge, responsible_name, responsible_phone, responsible_email, responsible_role, potencia_id, email_status, email_error, status, stage, assigned_to, created_chapter_id, decided_at, created_at, potencia:potencias(nome, sigla), assignee:profiles!org_join_requests_assigned_to_fkey(full_name)";

export type ConsoleRequest = {
  id: string;
  org_type: string;
  org_type_other: string | null;
  name_number: string;
  full_address: string;
  founded_on: string;
  active_members_band: string;
  sponsoring_lodge: string | null;
  responsible_name: string;
  responsible_phone: string;
  responsible_email: string;
  responsible_role: string;
  potencia_id: string | null;
  email_status: string;
  stage: Stage;
  assigned_to: string | null;
  created_chapter_id: string | null;
  decided_at: string | null;
  created_at: string;
  potencia: { nome: string; sigla: string | null } | null;
  assignee: { full_name: string | null } | null;
};

export const consoleListRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await gate(context);
    const rows = must(
      await ctx.admin
        .from("org_join_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false })
        .limit(500),
    );
    return { items: (rows ?? []) as ConsoleRequest[] };
  });

export const consoleGetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const [req, notes] = await Promise.all([
      ctx.admin.from("org_join_requests").select(REQUEST_SELECT).eq("id", data.id).maybeSingle(),
      ctx.admin
        .from("org_join_request_notes")
        .select("id, kind, body, created_at, author:profiles(full_name)")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    return {
      request: must(req) as ConsoleRequest | null,
      notes: (must(notes) ?? []) as {
        id: string;
        kind: string;
        body: string;
        created_at: string;
        author: { full_name: string | null } | null;
      }[],
    };
  });

const STAGE_LABELS: Record<Stage, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const consoleUpdateRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["novo", "em_contato", "recusado"]).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        note: z.string().trim().max(4000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const patch: Record<string, unknown> = {};
    if (data.stage) {
      patch.stage = data.stage;
      patch.status = data.stage === "recusado" ? "archived" : "open";
      patch.decided_at = data.stage === "recusado" ? new Date().toISOString() : null;
      patch.decided_by = data.stage === "recusado" ? ctx.actorId : null;
    }
    if (data.assignedTo !== undefined) patch.assigned_to = data.assignedTo;
    if (Object.keys(patch).length) {
      must(await ctx.admin.from("org_join_requests").update(patch).eq("id", data.id));
    }
    const notes: Record<string, unknown>[] = [];
    if (data.stage) {
      notes.push({
        request_id: data.id,
        author_id: ctx.actorId,
        kind: "stage",
        body: `Etapa: ${STAGE_LABELS[data.stage]}`,
      });
    }
    if (data.note) {
      notes.push({ request_id: data.id, author_id: ctx.actorId, kind: "note", body: data.note });
    }
    if (notes.length) must(await ctx.admin.from("org_join_request_notes").insert(notes));
    await audit(
      ctx,
      "pedido.atualizar",
      { type: "org_join_request", id: data.id },
      {
        ...patch,
        note: data.note ? true : undefined,
      },
    );
    return { ok: true };
  });

const chapterFields = {
  name: z.string().trim().min(2).max(200),
  number: z.string().trim().min(1).max(40),
  org_type: z.enum(ORG_TYPES),
  city: z.string().trim().max(200).nullable().optional(),
  state_id: z.string().uuid(),
  region_id: z.string().uuid().nullable().optional(),
  potencia_id: z.string().uuid().nullable().optional(),
};

async function sendAccountEmail(
  chapterId: string,
  realm: string | null,
  input: { fullName: string; email: string; temporaryPassword: string },
): Promise<{ status: string; error: string | null }> {
  try {
    const [{ loadChapterEmailAssets }, { accountCreatedEmail }, mail, realmLib] = await Promise.all(
      [
        import("@/lib/email-brand.server"),
        import("@/lib/email-templates"),
        import("@/lib/email"),
        import("@/lib/realm"),
      ],
    );
    const assets = await loadChapterEmailAssets(chapterId);
    const loginBase = realmLib.isRealm(realm)
      ? realmLib.realmAbsoluteUrl(realm)
      : realmLib.hubAbsoluteUrl();
    const copy = accountCreatedEmail({
      fullName: input.fullName,
      loginUrl: `${loginBase.replace(/\/$/, "")}/auth`,
      brand: assets.brand,
      temporaryPassword: input.temporaryPassword,
    });
    const res = await mail.sendTransactionalEmail({
      to: [input.email],
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
      attachments: assets.attachments,
    });
    return mail.summarizeEmailResult(res);
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Aprova: cria a instituição, a conta do responsável (admin) e avisa por e-mail. */
export const consoleApproveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        chapter: z.object(chapterFields),
        admin: z.object({
          full_name: z.string().trim().min(2).max(200),
          email: z.string().trim().email(),
          role: z.enum(roleNames).default("admin_total"),
        }),
        sendEmail: z.boolean().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const { ensureAccountInChapter } = await import("@/lib/console/console.server");
    const req = must(
      await ctx.admin
        .from("org_join_requests")
        .select("id, stage, created_chapter_id")
        .eq("id", data.id)
        .maybeSingle(),
    ) as { id: string; stage: string; created_chapter_id: string | null } | null;
    if (!req) throw new Error("Pedido não encontrado");
    if (req.created_chapter_id) throw new Error("Este pedido já gerou uma instituição");

    const chapter = must(
      await ctx.admin
        .from("chapters")
        .insert({
          name: data.chapter.name,
          number: data.chapter.number,
          org_type: data.chapter.org_type,
          city: data.chapter.city ?? null,
          state_id: data.chapter.state_id,
          region_id: data.chapter.region_id ?? null,
          ...(data.chapter.potencia_id ? { potencia_id: data.chapter.potencia_id } : {}),
          active: true,
        })
        .select("id, realm")
        .single(),
    ) as { id: string; realm: string | null };

    const account = await ensureAccountInChapter(ctx, {
      email: data.admin.email,
      fullName: data.admin.full_name,
      chapterId: chapter.id,
      roleName: data.admin.role,
    });

    must(
      await ctx.admin
        .from("org_join_requests")
        .update({
          stage: "aprovado",
          status: "archived",
          created_chapter_id: chapter.id,
          decided_at: new Date().toISOString(),
          decided_by: ctx.actorId,
        })
        .eq("id", data.id),
    );

    let email = { status: "skipped", error: null as string | null };
    if (data.sendEmail && account.temporaryPassword) {
      email = await sendAccountEmail(chapter.id, chapter.realm, {
        fullName: data.admin.full_name,
        email: data.admin.email,
        temporaryPassword: account.temporaryPassword,
      });
    }

    must(
      await ctx.admin.from("org_join_request_notes").insert({
        request_id: data.id,
        author_id: ctx.actorId,
        kind: "system",
        body: `Aprovado: instituição "${data.chapter.name}" criada; ${
          account.created ? "conta nova" : "conta existente"
        } de ${data.admin.email} vinculada como ${data.admin.role}.`,
      }),
    );
    await audit(
      ctx,
      "pedido.aprovar",
      { type: "org_join_request", id: data.id },
      {
        chapter_id: chapter.id,
        admin_user_id: account.userId,
        account_created: account.created,
        email_status: email.status,
      },
    );

    return {
      chapterId: chapter.id,
      userId: account.userId,
      accountCreated: account.created,
      temporaryPassword: account.temporaryPassword,
      emailStatus: email.status,
      emailError: email.error,
    };
  });

/* =================================================================== */
/* Instituições                                                         */
/* =================================================================== */

export type ConsoleChapterRow = {
  id: string;
  name: string;
  number: string;
  org_type: string;
  realm: string | null;
  city: string | null;
  active: boolean;
  created_at: string;
  state: { name: string; uf: string } | null;
  region: { name: string } | null;
};

export const consoleListChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await gate(context);
    const rows = must(
      await ctx.admin
        .from("chapters")
        .select(
          "id, name, number, org_type, realm, city, active, created_at, state:states(name, uf), region:regions(name)",
        )
        .order("name"),
    );
    return { items: (rows ?? []) as ConsoleChapterRow[] };
  });

export const consoleGetChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const a = ctx.admin;
    const [chapter, users, odm, fdj, loja] = await Promise.all([
      a
        .from("chapters")
        .select(
          "id, name, number, org_type, realm, city, active, state_id, region_id, created_at, state:states(name, uf), region:regions(name)",
        )
        .eq("id", data.id)
        .maybeSingle(),
      a
        .from("chapter_members")
        .select(
          "id, user_id, active, created_at, role:roles(name, label), profile:profiles(full_name)",
        )
        .eq("chapter_id", data.id)
        .order("created_at"),
      a
        .from("member_chapter_affiliations")
        .select("member:members(id, full_name, status, kind, email, user_id)")
        .eq("chapter_id", data.id)
        .eq("active", true),
      a
        .from("fdj_members")
        .select("id, full_name, status, fdj_id, email, user_id")
        .eq("chapter_id", data.id)
        .order("full_name"),
      a
        .from("loja_members")
        .select("id, full_name, status, masonic_id, grau, email, user_id")
        .eq("chapter_id", data.id)
        .order("full_name"),
    ]);
    const c = must(chapter);
    if (!c) return { chapter: null };
    const userRows = (must(users) ?? []) as {
      id: string;
      user_id: string;
      active: boolean;
      created_at: string;
      role: { name: string; label: string } | null;
      profile: { full_name: string | null } | null;
    }[];
    const emails = await emailsFor(
      ctx,
      userRows.map((u) => u.user_id),
    );
    type Ficha = {
      id: string;
      full_name: string;
      status: string;
      extra: string | null;
      email: string | null;
      user_id: string | null;
    };
    const odmRows = ((odm.data ?? []) as { member: Record<string, unknown> | null }[])
      .map((r) => r.member)
      .filter(Boolean) as Record<string, unknown>[];
    const members: Ficha[] = [
      ...odmRows.map((m) => ({
        id: String(m.id),
        full_name: String(m.full_name),
        status: String(m.status),
        extra: (m.kind as string) ?? null,
        email: (m.email as string) ?? null,
        user_id: (m.user_id as string) ?? null,
      })),
      ...((fdj.data ?? []) as Record<string, unknown>[]).map((m) => ({
        id: String(m.id),
        full_name: String(m.full_name),
        status: String(m.status),
        extra: m.fdj_id ? `ID FDJ ${m.fdj_id}` : null,
        email: (m.email as string) ?? null,
        user_id: (m.user_id as string) ?? null,
      })),
      ...((loja.data ?? []) as Record<string, unknown>[]).map((m) => ({
        id: String(m.id),
        full_name: String(m.full_name),
        status: String(m.status),
        extra: [m.grau, m.masonic_id].filter(Boolean).join(" · ") || null,
        email: (m.email as string) ?? null,
        user_id: (m.user_id as string) ?? null,
      })),
    ].sort((x, y) => x.full_name.localeCompare(y.full_name, "pt-BR"));
    return {
      chapter: c as ConsoleChapterRow & { state_id: string; region_id: string | null },
      users: userRows.map((u) => ({ ...u, email: emails[u.user_id] ?? null })),
      members,
    };
  });

async function emailsFor(ctx: ConsoleContext, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const { data } = await ctx.admin.auth.admin.getUserById(id);
      if (data?.user?.email) out[id] = data.user.email;
    }),
  );
  return out;
}

export const consoleSaveChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        ...chapterFields,
        active: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const payload: Record<string, unknown> = {
      name: data.name,
      number: data.number,
      org_type: data.org_type,
      city: data.city ?? null,
      state_id: data.state_id,
      region_id: data.region_id ?? null,
    };
    if (data.active !== undefined) payload.active = data.active;
    if (data.id) {
      const before = must(
        await ctx.admin
          .from("chapters")
          .select("name, number, org_type, city, state_id, region_id, active")
          .eq("id", data.id)
          .maybeSingle(),
      );
      must(await ctx.admin.from("chapters").update(payload).eq("id", data.id));
      await audit(
        ctx,
        "instituicao.editar",
        { type: "chapter", id: data.id },
        { before, after: payload },
      );
      return { id: data.id };
    }
    const row = must(
      await ctx.admin
        .from("chapters")
        .insert({ ...payload, active: data.active ?? true })
        .select("id")
        .single(),
    ) as { id: string };
    await audit(ctx, "instituicao.criar", { type: "chapter", id: row.id }, payload);
    return { id: row.id };
  });

export const consoleSetChapterActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(raw))
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    must(await ctx.admin.from("chapters").update({ active: data.active }).eq("id", data.id));
    await audit(ctx, data.active ? "instituicao.reativar" : "instituicao.suspender", {
      type: "chapter",
      id: data.id,
    });
    return { ok: true };
  });

export const consoleAddChapterUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        email: z.string().trim().email(),
        fullName: z.string().trim().min(2).max(200),
        role: z.enum(roleNames),
        sendEmail: z.boolean().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const { ensureAccountInChapter } = await import("@/lib/console/console.server");
    const account = await ensureAccountInChapter(ctx, {
      email: data.email,
      fullName: data.fullName,
      chapterId: data.chapterId,
      roleName: data.role,
    });
    let email = { status: "skipped", error: null as string | null };
    if (data.sendEmail && account.temporaryPassword) {
      const ch = must(
        await ctx.admin.from("chapters").select("realm").eq("id", data.chapterId).maybeSingle(),
      ) as { realm: string | null } | null;
      email = await sendAccountEmail(data.chapterId, ch?.realm ?? null, {
        fullName: data.fullName,
        email: data.email,
        temporaryPassword: account.temporaryPassword,
      });
    }
    await audit(
      ctx,
      "instituicao.vincular_usuario",
      { type: "chapter", id: data.chapterId },
      {
        user_id: account.userId,
        role: data.role,
        account_created: account.created,
        email_status: email.status,
      },
    );
    return { ...account, emailStatus: email.status, emailError: email.error };
  });

export const consoleUpdateChapterUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        linkId: z.string().uuid(),
        role: z.enum(roleNames).optional(),
        active: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const link = must(
      await ctx.admin
        .from("chapter_members")
        .select("id, user_id, chapter_id")
        .eq("id", data.linkId)
        .maybeSingle(),
    ) as { id: string; user_id: string; chapter_id: string } | null;
    if (!link) throw new Error("Vínculo não encontrado");
    const patch: Record<string, unknown> = {};
    if (data.role) {
      const role = must(
        await ctx.admin.from("roles").select("id").eq("name", data.role).maybeSingle(),
      ) as { id: number } | null;
      if (!role) throw new Error("Papel inválido");
      patch.role_id = role.id;
    }
    if (data.active !== undefined) patch.active = data.active;
    must(await ctx.admin.from("chapter_members").update(patch).eq("id", data.linkId));
    await audit(
      ctx,
      "instituicao.alterar_usuario",
      { type: "chapter", id: link.chapter_id },
      {
        user_id: link.user_id,
        ...data,
      },
    );
    return { ok: true };
  });

/* =================================================================== */
/* Pessoas                                                              */
/* =================================================================== */

export const consoleSearchPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ q: z.string().trim().min(2).max(200) }).parse(raw))
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const q = data.q.replace(/[%,()]/g, " ");
    const results = new Map<
      string,
      { userId: string; fullName: string | null; email: string | null }
    >();

    if (q.includes("@")) {
      const { findAuthUserByEmail } = await import("@/lib/console/console.server");
      const u = await findAuthUserByEmail(ctx, q);
      if (u) results.set(u.id, { userId: u.id, fullName: null, email: u.email });
    }
    const profiles = must(
      await ctx.admin
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${q}%`)
        .limit(40),
    ) as { id: string; full_name: string | null }[];
    for (const p of profiles)
      results.set(p.id, { userId: p.id, fullName: p.full_name, email: null });

    // Fichas sem conta também aparecem (para achar quem ainda não tem login).
    const [odm, fdj, loja] = await Promise.all([
      ctx.admin
        .from("members")
        .select("id, full_name, user_id, chapter_id, demolay_id")
        .or(`full_name.ilike.%${q}%,demolay_id.ilike.%${q}%`)
        .limit(40),
      ctx.admin
        .from("fdj_members")
        .select("id, full_name, user_id, chapter_id, fdj_id")
        .or(`full_name.ilike.%${q}%,fdj_id.ilike.%${q}%`)
        .limit(40),
      ctx.admin
        .from("loja_members")
        .select("id, full_name, user_id, chapter_id, masonic_id")
        .or(`full_name.ilike.%${q}%,masonic_id.ilike.%${q}%`)
        .limit(40),
    ]);
    type F = { id: string; full_name: string; user_id: string | null; chapter_id: string };
    const fichas = [
      ...((odm.data ?? []) as F[]).map((r) => ({ ...r, esfera: "odm" })),
      ...((fdj.data ?? []) as F[]).map((r) => ({ ...r, esfera: "fdj" })),
      ...((loja.data ?? []) as F[]).map((r) => ({ ...r, esfera: "loja" })),
    ];
    for (const f of fichas) {
      if (f.user_id && !results.has(f.user_id)) {
        results.set(f.user_id, { userId: f.user_id, fullName: f.full_name, email: null });
      }
    }
    const accounts = [...results.values()];
    const emails = await emailsFor(
      ctx,
      accounts.filter((a) => !a.email).map((a) => a.userId),
    );
    return {
      accounts: accounts.map((a) => ({ ...a, email: a.email ?? emails[a.userId] ?? null })),
      fichasSemConta: fichas
        .filter((f) => !f.user_id)
        .map((f) => ({
          id: f.id,
          fullName: f.full_name,
          esfera: f.esfera,
          chapterId: f.chapter_id,
        })),
    };
  });

export const consoleGetPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ userId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const a = ctx.admin;
    const { data: authUser, error: authErr } = await a.auth.admin.getUserById(data.userId);
    if (authErr) throw new Error(authErr.message);
    const [profile, links, odm, fdj, loja, leaderships, isAdmin] = await Promise.all([
      a
        .from("profiles")
        .select("id, full_name, phone, must_change_password, created_at")
        .eq("id", data.userId)
        .maybeSingle(),
      a
        .from("chapter_members")
        .select(
          "id, chapter_id, active, role:roles(name, label), chapter:chapters(name, number, org_type, realm, active)",
        )
        .eq("user_id", data.userId),
      a
        .from("members")
        .select("id, full_name, status, kind, chapter_id, demolay_id")
        .eq("user_id", data.userId),
      a
        .from("fdj_members")
        .select("id, full_name, status, chapter_id, fdj_id")
        .eq("user_id", data.userId),
      a
        .from("loja_members")
        .select("id, full_name, status, chapter_id, masonic_id, grau")
        .eq("user_id", data.userId),
      a
        .from("org_leaderships")
        .select("id, org_role, active, state_id, region_id")
        .eq("user_id", data.userId),
      a
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", data.userId)
        .eq("active", true)
        .maybeSingle(),
    ]);

    // Raio-x: papel base + cargos do semestre vigente por instituição.
    const { currentTerm } = await import("@/lib/terms");
    const { resolveAccess } = await import("@/lib/permissions");
    const term = currentTerm();
    const odmRows = (odm.data ?? []) as { id: string; chapter_id: string }[];
    const positions = odmRows.length
      ? ((
          await a
            .from("member_positions")
            .select("chapter_id, member_id, position:positions(code, label)")
            .in(
              "member_id",
              odmRows.map((m) => m.id),
            )
            .eq("term_year", term.year)
            .eq("term_semester", term.semester)
        ).data ?? [])
      : [];
    const linkRows = (must(links) ?? []) as {
      id: string;
      chapter_id: string;
      active: boolean;
      role: { name: string; label: string } | null;
      chapter: {
        name: string;
        number: string;
        org_type: string;
        realm: string | null;
        active: boolean;
      } | null;
    }[];
    const access = linkRows.map((l) => {
      const pos = (
        positions as { chapter_id: string; position: { code: string; label: string } | null }[]
      )
        .filter((p) => p.chapter_id === l.chapter_id && p.position)
        .map((p) => p.position!);
      return {
        linkId: l.id,
        chapterId: l.chapter_id,
        chapter: l.chapter,
        role: l.role,
        active: l.active,
        positions: pos,
        permissions: l.active
          ? resolveAccess({
              roleName: (l.role?.name ?? null) as never,
              currentPositions: pos.map((p) => p.code),
            } as never)
          : [],
      };
    });

    const u = authUser?.user;
    return {
      userId: data.userId,
      email: u?.email ?? null,
      lastSignInAt: u?.last_sign_in_at ?? null,
      createdAt: u?.created_at ?? null,
      banned: Boolean(
        u &&
        (u as { banned_until?: string | null }).banned_until &&
        new Date((u as { banned_until: string }).banned_until) > new Date(),
      ),
      mfaFactors: (
        (u as { factors?: { factor_type: string; status: string }[] } | undefined)?.factors ?? []
      ).length,
      profile: must(profile) as {
        full_name: string | null;
        phone: string | null;
        must_change_password: boolean;
      } | null,
      access,
      fichas: {
        odm: (odm.data ?? []) as Record<string, Json>[],
        fdj: (fdj.data ?? []) as Record<string, Json>[],
        loja: (loja.data ?? []) as Record<string, Json>[],
      },
      leaderships: (leaderships.data ?? []) as Record<string, Json>[],
      isPlatformAdmin: Boolean(isAdmin.data),
    };
  });

export const consoleAccountAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["reset_password", "force_change", "unblock_login", "disable", "enable"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ctx = await gate(context);
    const a = ctx.admin;
    if (
      data.userId === ctx.actorId &&
      (data.action === "disable" || data.action === "reset_password")
    ) {
      throw new Error("Use outra conta de admin para mexer no seu próprio acesso.");
    }
    let temporaryPassword: string | null = null;
    switch (data.action) {
      case "reset_password": {
        const { randomPassword } = await import("@/lib/console/console.server");
        temporaryPassword = randomPassword();
        const { error } = await a.auth.admin.updateUserById(data.userId, {
          password: temporaryPassword,
          user_metadata: { must_change_password: true },
        });
        if (error) throw new Error(error.message);
        must(await a.from("profiles").update({ must_change_password: true }).eq("id", data.userId));
        break;
      }
      case "force_change":
        must(await a.from("profiles").update({ must_change_password: true }).eq("id", data.userId));
        break;
      case "unblock_login": {
        const { createHash } = await import("node:crypto");
        const { data: u } = await a.auth.admin.getUserById(data.userId);
        const ids = new Set<string>();
        if (u?.user?.email) ids.add(u.user.email);
        const [odm, fdj, loja] = await Promise.all([
          a.from("members").select("demolay_id, masonic_id").eq("user_id", data.userId),
          a.from("fdj_members").select("fdj_id").eq("user_id", data.userId),
          a.from("loja_members").select("masonic_id").eq("user_id", data.userId),
        ]);
        for (const r of [...(odm.data ?? []), ...(fdj.data ?? []), ...(loja.data ?? [])] as Record<
          string,
          string | null
        >[]) {
          for (const v of Object.values(r)) if (v) ids.add(v);
        }
        const keys = [...ids].map((i) =>
          createHash("sha256").update(i.trim().toLowerCase()).digest("hex"),
        );
        if (keys.length) {
          must(
            await a
              .from("auth_login_throttle")
              .delete()
              .eq("scope", "identifier")
              .in("scope_key", keys),
          );
        }
        break;
      }
      case "disable":
      case "enable": {
        const { error } = await a.auth.admin.updateUserById(data.userId, {
          ban_duration: data.action === "disable" ? "876000h" : "none",
        });
        if (error) throw new Error(error.message);
        break;
      }
    }
    await audit(ctx, `conta.${data.action}`, { type: "user", id: data.userId });
    return { ok: true, temporaryPassword };
  });
