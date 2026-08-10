import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { resolveAccess, type RoleName } from "@/lib/permissions";
import { normalizeDemolayId } from "@/lib/member-identity";
import { currentTerm } from "@/lib/terms";

const passwordSchema = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .max(100);

function randomPassword(length = 16): string {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function accessSummaryFrom(
  positions: { code: string; label: string }[],
  commissions: { code: string; label: string; role: string }[],
  permissions: string[],
): string[] {
  const lines: string[] = [];
  if (permissions.includes("admin") || permissions.includes("conselho")) {
    lines.push("Acesso total no capítulo (administração / conselho)");
  } else {
    if (permissions.includes("secretaria")) lines.push("Secretaria");
    if (permissions.includes("tesouraria")) lines.push("Tesouraria");
    if (permissions.includes("comissoes")) lines.push("Comissões (gestão)");
    if (permissions.includes("visualizar_total")) {
      lines.push("Visualização ampla no capítulo");
    } else if (permissions.includes("visualizar")) {
      lines.push("Acesso básico de membro (presenças, calendário, perfil…)");
    }
  }
  for (const p of positions) {
    lines.push(`Cargo ritualístico: ${p.label}`);
  }
  for (const c of commissions) {
    lines.push(`Comissão ${c.label} (${c.role})`);
  }
  if (lines.length === 0) {
    lines.push("Acesso básico de membro");
  }
  return [...new Set(lines)];
}

async function loadMemberTermAccess(
  supabase: {
    from: (t: string) => any;
  },
  memberId: string,
  chapterId: string,
  roleName: string | null = "membro",
) {
  const term = currentTerm();
  const [posRes, comRes] = await Promise.all([
    supabase
      .from("member_positions")
      .select("position:positions(code, label)")
      .eq("member_id", memberId)
      .eq("chapter_id", chapterId)
      .eq("term_year", term.year)
      .eq("term_semester", term.semester),
    supabase
      .from("commission_members")
      .select("role, commission:commissions(code, label)")
      .eq("member_id", memberId)
      .eq("chapter_id", chapterId)
      .eq("term_year", term.year)
      .eq("term_semester", term.semester),
  ]);

  const currentPositions = ((posRes.data ?? []) as {
    position?: { code?: string; label?: string } | { code?: string; label?: string }[] | null;
  }[])
    .map((r) => {
      const p = Array.isArray(r.position) ? r.position[0] : r.position;
      if (!p?.code) return null;
      return { code: p.code, label: p.label ?? p.code };
    })
    .filter((x): x is { code: string; label: string } => !!x);

  const currentCommissions = ((comRes.data ?? []) as {
    role: string;
    commission?: { code?: string; label?: string } | { code?: string; label?: string }[] | null;
  }[])
    .map((r) => {
      const c = Array.isArray(r.commission) ? r.commission[0] : r.commission;
      if (!c?.code) return null;
      return { code: c.code, label: c.label ?? c.code, role: r.role };
    })
    .filter((x): x is { code: string; label: string; role: string } => !!x);

  const effectivePermissions = resolveAccess({
    roleName: roleName ?? "membro",
    currentPositions: currentPositions.map((p) => p.code),
    commissionRoles: currentCommissions,
  });

  return {
    currentPositions,
    currentCommissions,
    effectivePermissions,
    accessSummary: accessSummaryFrom(
      currentPositions,
      currentCommissions,
      effectivePermissions,
    ),
  };
}

function getAnonAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertChapterAdmin(
  supabase: {
    rpc: (
      fn: never,
      args: never,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  chapterId: string,
) {
  const { data: ok, error } = await supabase.rpc(
    "has_permission" as never,
    { _chapter_id: chapterId, _perm: "admin" } as never,
  );
  if (error) throw new Error(error.message);
  if (!ok) throw new Error("Sem permissão para gerenciar contas neste capítulo");
}

async function findAuthUserByEmail(
  admin: Awaited<
    ReturnType<typeof import("@/integrations/supabase/client.server")>
  >["supabaseAdmin"],
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === normalized,
    );
    if (found) return { id: found.id, email: found.email ?? normalized };
    if (data.users.length < perPage) break;
  }
  return null;
}

async function ensureChapterMembership(
  admin: Awaited<
    ReturnType<typeof import("@/integrations/supabase/client.server")>
  >["supabaseAdmin"],
  userId: string,
  chapterId: string,
  roleName: RoleName = "membro",
) {
  const { data: role, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .maybeSingle();
  if (roleErr) throw new Error(roleErr.message);
  if (!role) throw new Error(`Cargo de sistema "${roleName}" não encontrado`);

  const { data: existing, error: exErr } = await admin
    .from("chapter_members")
    .select("id, active, role_id")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .eq("role_id", role.id)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  if (existing) {
    if (!existing.active) {
      const { error } = await admin
        .from("chapter_members")
        .update({ active: true })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }
    return;
  }

  // Se já tem outro cargo no capítulo, reativa/atualiza o primeiro vínculo encontrado
  const { data: anyLink, error: anyErr } = await admin
    .from("chapter_members")
    .select("id, active")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .limit(1)
    .maybeSingle();
  if (anyErr) throw new Error(anyErr.message);

  if (anyLink) {
    const { error } = await admin
      .from("chapter_members")
      .update({ active: true, role_id: role.id })
      .eq("id", anyLink.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error: insErr } = await admin.from("chapter_members").insert({
    user_id: userId,
    chapter_id: chapterId,
    role_id: role.id,
    active: true,
  });
  if (insErr) throw new Error(insErr.message);
}

export type MemberAccountStatus = {
  linked: boolean;
  userId: string | null;
  email: string | null;
  /** Sempre base "membro"; permissões reais vêm dos cargos ritualísticos. */
  roleName: string | null;
  roleLabel: string | null;
  mustChangePassword: boolean;
  chapterMemberActive: boolean | null;
  /** Cargos ritualísticos do semestre vigente neste capítulo. */
  currentPositions: { code: string; label: string }[];
  /** Comissões do semestre vigente neste capítulo. */
  currentCommissions: { code: string; label: string; role: string }[];
  /** Permissões efetivas resolvidas (role base + cargos). */
  effectivePermissions: string[];
  /** Resumo legível do acesso. */
  accessSummary: string[];
};

export const getMemberAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<MemberAccountStatus> => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select("id, chapter_id, email, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");

    await assertChapterAdmin(context.supabase, member.chapter_id);

    if (!member.user_id) {
      const access = await loadMemberTermAccess(
        context.supabase,
        member.id,
        member.chapter_id,
      );
      return {
        linked: false,
        userId: null,
        email: member.email,
        roleName: null,
        roleLabel: null,
        mustChangePassword: false,
        chapterMemberActive: null,
        ...access,
      };
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const [profileRes, cmRes, authRes] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", member.user_id)
        .maybeSingle(),
      context.supabase
        .from("chapter_members")
        .select("active, role_id, roles(name, label)")
        .eq("user_id", member.user_id)
        .eq("chapter_id", member.chapter_id)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(member.user_id),
    ]);

    const roleJoin = cmRes.data?.roles as
      | { name: string; label: string }
      | { name: string; label: string }[]
      | null
      | undefined;
    const role = Array.isArray(roleJoin) ? roleJoin[0] : roleJoin;
    const roleName = role?.name ?? "membro";

    const access = await loadMemberTermAccess(
      context.supabase,
      member.id,
      member.chapter_id,
      roleName,
    );

    return {
      linked: true,
      userId: member.user_id,
      email: authRes.data.user?.email ?? member.email,
      roleName,
      roleLabel: role?.label ?? "Membro",
      mustChangePassword: Boolean(profileRes.data?.must_change_password),
      chapterMemberActive: cmRes.data?.active ?? null,
      ...access,
    };
  });

export const provisionMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        /** Se omitida, gera senha temporária aleatória. */
        password: passwordSchema.optional(),
        /** Exigir troca no 1º acesso (padrão true se senha gerada; false se definida). */
        mustChangePassword: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select("id, chapter_id, email, full_name, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");

    await assertChapterAdmin(context.supabase, member.chapter_id);

    if (member.user_id) {
      throw new Error("Este membro já possui conta vinculada");
    }

    const email = (member.email ?? "").trim().toLowerCase();
    if (!email || !z.string().email().safeParse(email).success) {
      throw new Error("Preencha um e-mail válido na ficha antes de criar o acesso");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const existing = await findAuthUserByEmail(supabaseAdmin, email);
    let status: "created" | "linked" = "linked";
    let temporaryPassword: string | null = null;
    let userId: string;
    const generated = !data.password;
    const password = data.password ?? randomPassword();
    const mustChange =
      data.mustChangePassword !== undefined
        ? data.mustChangePassword
        : generated;

    if (existing) {
      const { data: other, error: otherErr } = await supabaseAdmin
        .from("members")
        .select("id, full_name")
        .eq("user_id", existing.id)
        .neq("id", member.id)
        .maybeSingle();
      if (otherErr) throw new Error(otherErr.message);
      if (other) {
        throw new Error(
          `Este e-mail já está vinculado ao membro "${other.full_name}"`,
        );
      }
      userId = existing.id;
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: member.full_name })
        .eq("id", userId);

      // Se informaram senha ao vincular conta existente, aplica
      if (data.password) {
        const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            password: data.password,
            user_metadata: {
              full_name: member.full_name,
              must_change_password: mustChange,
            },
          },
        );
        if (pwdErr) throw new Error(pwdErr.message);
        await supabaseAdmin
          .from("profiles")
          .update({ must_change_password: mustChange })
          .eq("id", userId);
        temporaryPassword = data.password;
      }
    } else {
      temporaryPassword = password;
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: member.full_name,
            must_change_password: mustChange,
          },
        });
      if (createErr || !created.user) {
        throw new Error(createErr?.message ?? "Falha ao criar conta");
      }
      userId = created.user.id;
      status = "created";

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: member.full_name,
          must_change_password: mustChange,
        })
        .eq("id", userId);
      if (profileErr) throw new Error(profileErr.message);
    }

    // Acesso base sempre "membro"; permissões vêm dos cargos ritualísticos
    await ensureChapterMembership(
      supabaseAdmin,
      userId,
      member.chapter_id,
      "membro",
    );

    const { error: linkErr } = await supabaseAdmin
      .from("members")
      .update({ user_id: userId })
      .eq("id", member.id);
    if (linkErr) throw new Error(linkErr.message);

    const access = await loadMemberTermAccess(
      context.supabase,
      member.id,
      member.chapter_id,
    );

    return {
      status,
      userId,
      email,
      roleName: "membro" as const,
      temporaryPassword,
      mustChangePassword: mustChange,
      accessSummary: access.accessSummary,
    };
  });

export const setMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        password: passwordSchema,
        mustChangePassword: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select("id, chapter_id, user_id, full_name")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");
    if (!member.user_id) throw new Error("Membro sem conta vinculada");

    await assertChapterAdmin(context.supabase, member.chapter_id);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      member.user_id,
      {
        password: data.password,
        user_metadata: {
          full_name: member.full_name,
          must_change_password: data.mustChangePassword,
        },
      },
    );
    if (updErr) throw new Error(updErr.message);

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: data.mustChangePassword })
      .eq("id", member.user_id);
    if (profileErr) throw new Error(profileErr.message);

    // Garante vínculo ativo no capítulo com role base membro
    await ensureChapterMembership(
      supabaseAdmin,
      member.user_id,
      member.chapter_id,
      "membro",
    );

    return {
      ok: true,
      password: data.password,
      mustChangePassword: data.mustChangePassword,
    };
  });

export const resetMemberTemporaryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        password: passwordSchema.optional(),
        mustChangePassword: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select("id, chapter_id, user_id, full_name")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");
    if (!member.user_id) throw new Error("Membro sem conta vinculada");

    await assertChapterAdmin(context.supabase, member.chapter_id);

    const generated = !data.password;
    const temporaryPassword = data.password ?? randomPassword();
    const mustChange =
      data.mustChangePassword !== undefined
        ? data.mustChangePassword
        : generated;

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      member.user_id,
      {
        password: temporaryPassword,
        user_metadata: {
          full_name: member.full_name,
          must_change_password: mustChange,
        },
      },
    );
    if (updErr) throw new Error(updErr.message);

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: mustChange })
      .eq("id", member.user_id);
    if (profileErr) throw new Error(profileErr.message);

    return { temporaryPassword, mustChangePassword: mustChange };
  });
export const revokeMemberChapterAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase
      .from("members")
      .select("id, chapter_id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Membro não encontrado");
    if (!member.user_id) throw new Error("Membro sem conta vinculada");

    await assertChapterAdmin(context.supabase, member.chapter_id);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: updErr } = await supabaseAdmin
      .from("chapter_members")
      .update({ active: false })
      .eq("user_id", member.user_id)
      .eq("chapter_id", member.chapter_id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    // Best-effort metadata sync (requires service role)
    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        context.userId,
      );
      const meta = { ...(userData.user?.user_metadata ?? {}) };
      meta.must_change_password = false;
      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: meta,
      });
    } catch {
      // ignore — flag em profiles é a fonte da verdade no app
    }

    return { ok: true };
  });

export const getMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { mustChangePassword: Boolean(data?.must_change_password) };
  });

/** Login por ID DeMolay (ou e-mail) sem expor o e-mail ao cliente antes da autenticação. */
const IRREGULAR_LOGIN_MESSAGE =
  "Membros irregulares não podem acessar a plataforma. Regularize sua situação junto à secretaria ou tesouraria do capítulo.";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ID_MAX_FAILS = 5;
const LOGIN_IP_MAX_FAILS = 20;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

type ThrottleRow = {
  scope: string;
  scope_key: string;
  fail_count: number;
  window_started_at: string;
  locked_until: string | null;
};

/**
 * IP só de headers de borda (não confiar em x-forwarded-for do cliente).
 * Sem IP determinável → null (pula escopo ip no throttle).
 */
async function clientIpForLogin(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const edgeHeaders = [
      "cf-connecting-ip",
      "true-client-ip",
      "x-vercel-forwarded-for",
      "fly-client-ip",
    ] as const;
    for (const name of edgeHeaders) {
      const raw = request.headers.get(name)?.trim();
      if (!raw) continue;
      const ip = raw.split(",")[0]?.trim();
      if (ip) return ip.slice(0, 64);
    }
  } catch {
    /* SSR / ambiente sem request */
  }
  return null;
}

function hashIdentifierKey(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

function lockMessage(lockedUntil: Date): string {
  const ms = Math.max(0, lockedUntil.getTime() - Date.now());
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  return `Muitas tentativas de login. Tente novamente em ${mins} minuto${mins === 1 ? "" : "s"}.`;
}

function isMissingThrottleTable(message: string): boolean {
  return /auth_login_throttle|schema cache|does not exist/i.test(message);
}

async function fetchThrottleRow(
  admin: SupabaseClient<Database>,
  scope: "identifier" | "ip",
  key: string,
): Promise<Omit<ThrottleRow, "scope" | "scope_key"> | null> {
  const { data, error } = await admin
    .from("auth_login_throttle" as never)
    .select("fail_count, window_started_at, locked_until")
    .eq("scope", scope)
    .eq("scope_key", key)
    .maybeSingle();
  if (error) {
    if (isMissingThrottleTable(error.message)) return null;
    throw new Error("Não foi possível validar o login. Tente novamente.");
  }
  return data as Omit<ThrottleRow, "scope" | "scope_key"> | null;
}

async function assertLoginNotLocked(
  admin: SupabaseClient<Database>,
  identifierKey: string,
  ip: string | null,
) {
  const now = Date.now();
  const fetches = [fetchThrottleRow(admin, "identifier", identifierKey)];
  if (ip) fetches.push(fetchThrottleRow(admin, "ip", ip));
  const rows = await Promise.all(fetches);
  for (const row of rows) {
    if (!row?.locked_until) continue;
    const until = new Date(row.locked_until).getTime();
    if (until > now) throw new Error(lockMessage(new Date(until)));
  }
}

async function recordLoginFailure(
  admin: SupabaseClient<Database>,
  identifierKey: string,
  ip: string | null,
) {
  const scopes: { scope: "identifier" | "ip"; key: string; max: number }[] = [
    { scope: "identifier", key: identifierKey, max: LOGIN_ID_MAX_FAILS },
  ];
  if (ip) scopes.push({ scope: "ip", key: ip, max: LOGIN_IP_MAX_FAILS });

  let lockUntilThrown: Date | null = null;

  for (const s of scopes) {
    const { data, error } = await admin.rpc(
      "record_login_throttle_failure" as never,
      {
        _scope: s.scope,
        _scope_key: s.key,
        _max_fails: s.max,
        _window_ms: LOGIN_WINDOW_MS,
        _lock_ms: LOGIN_LOCK_MS,
      } as never,
    );
    if (error) {
      if (isMissingThrottleTable(error.message)) continue;
      console.error("[auth] record_login_throttle_failure failed", {
        scope: s.scope,
        message: error.message,
      });
      continue;
    }
    const lockedUntil = (data as { locked_until?: string | null } | null)
      ?.locked_until;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      lockUntilThrown = new Date(lockedUntil);
    }
  }

  if (lockUntilThrown) throw new Error(lockMessage(lockUntilThrown));
}

/** Só limpa o identificador — nunca o contador de IP (evita reset por credencial válida). */
async function clearLoginFailures(
  admin: SupabaseClient<Database>,
  identifierKey: string,
) {
  await admin
    .from("auth_login_throttle" as never)
    .delete()
    .eq("scope", "identifier")
    .eq("scope_key", identifierKey);
}

export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        identifier: z.string().trim().min(1).max(120),
        password: z.string().min(1).max(200),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const identifier = data.identifier.trim();
    const identifierKey = hashIdentifierKey(identifier);
    const ip = await clientIpForLogin();
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    await assertLoginNotLocked(supabaseAdmin, identifierKey, ip);

    let email: string | null = null;

    try {
      if (identifier.includes("@")) {
        email = identifier.toLowerCase();
      } else {
        const normalizedId = normalizeDemolayId(identifier);
        if (!normalizedId) {
          throw new Error("Identificador ou senha inválidos.");
        }
        const { data: rows, error } = await supabaseAdmin.rpc(
          "find_member_auth_by_demolay_id" as never,
          { _demolay_id: normalizedId } as never,
        );
        if (error) throw new Error("Identificador ou senha inválidos.");
        const member = Array.isArray(rows) ? rows[0] : rows;
        if (!member?.user_id) {
          throw new Error("Identificador ou senha inválidos.");
        }
        if (member.status === "irregular") {
          throw new Error(IRREGULAR_LOGIN_MESSAGE);
        }
        const { data: authUser, error: authErr } =
          await supabaseAdmin.auth.admin.getUserById(member.user_id);
        if (authErr || !authUser.user?.email) {
          throw new Error("Identificador ou senha inválidos.");
        }
        email = authUser.user.email;
      }

      const anon = getAnonAuthClient();
      const { data: sessionData, error: signErr } =
        await anon.auth.signInWithPassword({
          email: email!,
          password: data.password,
        });
      if (signErr || !sessionData.session) {
        throw new Error("Identificador ou senha inválidos.");
      }

      const userId = sessionData.session.user.id;
      const gate = await evaluateMemberLoginGate(userId);
      if (!gate.allowed) {
        await anon.auth.signOut();
        throw new Error(gate.message);
      }

      await clearLoginFailures(supabaseAdmin, identifierKey);

      return {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Identificador ou senha inválidos.";
      // Não contabiliza bloqueio já ativo / irregular (não é brute-force de senha)
      if (
        message.startsWith("Muitas tentativas") ||
        message === IRREGULAR_LOGIN_MESSAGE
      ) {
        throw err;
      }
      try {
        await recordLoginFailure(supabaseAdmin, identifierKey, ip);
      } catch (lockErr) {
        if (
          lockErr instanceof Error &&
          lockErr.message.startsWith("Muitas tentativas")
        ) {
          throw lockErr;
        }
      }
      throw err instanceof Error
        ? err
        : new Error("Identificador ou senha inválidos.");
    }
  });

async function evaluateMemberLoginGate(
  userId: string,
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  const { data: members, error } = await supabaseAdmin
    .from("members")
    .select("id, status")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  // Sem cadastro de membro vinculado: acesso liberado (ex.: papéis org)
  if (!members || members.length === 0) return { allowed: true };

  const hasRegular = members.some((m) => m.status === "regular");
  if (!hasRegular) {
    return { allowed: false, message: IRREGULAR_LOGIN_MESSAGE };
  }
  return { allowed: true };
}

/** Usado no beforeLoad autenticado para expulsar sessão de irregular. */
export const getMemberLoginGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return evaluateMemberLoginGate(context.userId);
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ email: z.string().trim().email() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const anon = getAnonAuthClient();
    const origin =
      process.env.VITE_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:8080";
    const redirectTo = `${origin.replace(/\/$/, "")}/auth/nova-senha`;
    const { error } = await anon.auth.resetPasswordForEmail(
      data.email.trim().toLowerCase(),
      { redirectTo },
    );
    // Sempre sucesso genérico (não revelar se o e-mail existe)
    if (error) {
      console.error("[auth] resetPasswordForEmail:", error.message);
    }
    return { ok: true };
  });
