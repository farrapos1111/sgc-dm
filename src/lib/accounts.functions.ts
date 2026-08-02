import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";

const PROVISIONABLE_ROLES = Object.keys(ROLE_LABELS) as RoleName[];

const roleNameSchema = z.enum(
  PROVISIONABLE_ROLES as [RoleName, ...RoleName[]],
);

function randomPassword(length = 16): string {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
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
  roleName: RoleName,
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
  roleName: string | null;
  roleLabel: string | null;
  mustChangePassword: boolean;
  chapterMemberActive: boolean | null;
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
      return {
        linked: false,
        userId: null,
        email: member.email,
        roleName: null,
        roleLabel: null,
        mustChangePassword: false,
        chapterMemberActive: null,
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

    return {
      linked: true,
      userId: member.user_id,
      email: authRes.data.user?.email ?? member.email,
      roleName: role?.name ?? null,
      roleLabel: role?.label ?? null,
      mustChangePassword: Boolean(profileRes.data?.must_change_password),
      chapterMemberActive: cmRes.data?.active ?? null,
    };
  });

export const provisionMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        memberId: z.string().uuid(),
        roleName: roleNameSchema.optional().default("membro"),
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

    if (existing) {
      // Conta já usada por outro membro?
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
    } else {
      temporaryPassword = randomPassword();
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: member.full_name,
            must_change_password: true,
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
          must_change_password: true,
        })
        .eq("id", userId);
      if (profileErr) throw new Error(profileErr.message);
    }

    await ensureChapterMembership(
      supabaseAdmin,
      userId,
      member.chapter_id,
      data.roleName,
    );

    const { error: linkErr } = await supabaseAdmin
      .from("members")
      .update({ user_id: userId })
      .eq("id", member.id);
    if (linkErr) throw new Error(linkErr.message);

    return {
      status,
      userId,
      email,
      roleName: data.roleName,
      temporaryPassword,
    };
  });

export const resetMemberTemporaryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ memberId: z.string().uuid() }).parse(raw))
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

    const temporaryPassword = randomPassword();
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
      member.user_id,
      {
        password: temporaryPassword,
        user_metadata: {
          full_name: member.full_name,
          must_change_password: true,
        },
      },
    );
    if (updErr) throw new Error(updErr.message);

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", member.user_id);
    if (profileErr) throw new Error(profileErr.message);

    return { temporaryPassword };
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
    let email: string | null = null;

    if (identifier.includes("@")) {
      email = identifier.toLowerCase();
    } else {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const normalizedId = identifier.replace(/\s+/g, "");
      const { data: member, error } = await supabaseAdmin
        .from("members")
        .select("user_id")
        .eq("demolay_id", normalizedId)
        .not("user_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("Identificador ou senha inválidos.");
      if (!member?.user_id) {
        throw new Error("Identificador ou senha inválidos.");
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

    return {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    };
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
