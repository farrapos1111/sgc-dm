/**
 * Escopo reservado: tabelas platform_access_* e estas server functions
 * ficam no projeto para reutilização futura da matriz configurável.
 * O enforcement atual é hardcoded (Capítulo DeMolay) via permissions.ts /
 * resolveHardcodedScreenAccess — não use estas fns no runtime de acesso.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORG_TYPES,
  ROLE_GROUPS,
  orgTypeHasRoleGroups,
  type OrgType,
  type RoleGroup,
} from "@/lib/org-types";
import type {
  PlatformAccessGrant,
  PlatformAccessRole,
  PlatformAccessRoleOrgType,
  PlatformAccessScreen,
} from "@/lib/screen-access";

type AnyClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

const orgTypeSchema = z.enum(ORG_TYPES);
const roleGroupSchema = z.enum(ROLE_GROUPS);

async function assertAdminTotal(
  supabase: AnyClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("chapter_members")
    .select("id, role:roles(name), active")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((row: any) => row.role?.name === "admin_total");
  if (!ok) throw new Error("Apenas Administrador Total pode gerenciar permissões.");
}

async function adminDb(): Promise<AnyClient> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  return supabaseAdmin as unknown as AnyClient;
}

function resolveRoleGroup(
  orgType: OrgType,
  roleGroup: RoleGroup | null | undefined,
): RoleGroup | null {
  if (!orgTypeHasRoleGroups(orgType)) return null;
  if (!roleGroup) {
    throw new Error("Subcategoria obrigatória para este tipo de instituição.");
  }
  return roleGroup;
}

export const listPlatformAccessMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        orgType: orgTypeSchema.optional(),
      })
      .optional()
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;

    const { data: roles, error: rolesErr } = await db
      .from("platform_access_roles")
      .select("id, key, label, is_system, match_kind, match_code, sort_order")
      .order("sort_order", { ascending: true });
    if (rolesErr) throw new Error(rolesErr.message);

    const { data: screens, error: screensErr } = await db
      .from("platform_access_screens")
      .select("id, label, sort_order")
      .order("sort_order", { ascending: true });
    if (screensErr) throw new Error(screensErr.message);

    let grantsQ = db
      .from("platform_access_grants")
      .select(
        "role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete",
      );
    if (data?.orgType) {
      grantsQ = grantsQ.eq("org_type", data.orgType);
    }
    const { data: grants, error: grantsErr } = await grantsQ;
    if (grantsErr) throw new Error(grantsErr.message);

    const { data: roleOrgTypes, error: scopeErr } = await db
      .from("platform_access_role_org_types")
      .select("role_id, org_type, role_group, sort_order")
      .order("sort_order", { ascending: true });
    if (scopeErr) throw new Error(scopeErr.message);

    return {
      roles: (roles ?? []) as PlatformAccessRole[],
      screens: (screens ?? []) as PlatformAccessScreen[],
      grants: (grants ?? []) as PlatformAccessGrant[],
      roleOrgTypes: (roleOrgTypes ?? []) as PlatformAccessRoleOrgType[],
    };
  });

export const upsertPlatformAccessRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        key: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
        label: z.string().trim().min(2).max(80),
        match_kind: z.enum([
          "position",
          "role_fallback",
          "commission_president",
          "commission_member",
        ]),
        match_code: z.string().trim().max(80).nullable().optional(),
        /** Contexto da aba ao criar. */
        org_type: orgTypeSchema.optional(),
        role_group: roleGroupSchema.nullable().optional(),
        /** Substitui todos os escopos (edição avançada). */
        org_types: z.array(orgTypeSchema).min(1).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();

    if (data.id) {
      const { data: existing, error: readErr } = await db
        .from("platform_access_roles")
        .select("id, is_system, key")
        .eq("id", data.id)
        .single();
      if (readErr) throw new Error(readErr.message);
      if (existing.is_system && existing.key !== data.key) {
        throw new Error("Não é possível alterar a chave de um cargo de sistema.");
      }
      const { data: row, error } = await db
        .from("platform_access_roles")
        .update({
          label: data.label,
          ...(existing.is_system
            ? {}
            : {
                key: data.key,
                match_kind: data.match_kind,
                match_code: data.match_code ?? null,
              }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select("id, key, label, is_system, match_kind, match_code, sort_order")
        .single();
      if (error) throw new Error(error.message);

      if (data.org_types) {
        const { data: prevScopes } = await db
          .from("platform_access_role_org_types")
          .select("org_type, role_group, sort_order")
          .eq("role_id", data.id);
        const prevMap = new Map<
          string,
          { org_type: string; role_group: string | null; sort_order: number }
        >();
        for (const s of prevScopes ?? []) {
          prevMap.set(s.org_type as string, {
            org_type: s.org_type as string,
            role_group: (s.role_group as string | null) ?? null,
            sort_order: Number(s.sort_order ?? 0),
          });
        }
        await db
          .from("platform_access_role_org_types")
          .delete()
          .eq("role_id", data.id);
        const inserts = data.org_types.map((ot) => {
          const prev = prevMap.get(ot);
          const group = orgTypeHasRoleGroups(ot)
            ? ((prev?.role_group as RoleGroup | null) ??
              data.role_group ??
              "ritualisticos")
            : null;
          return {
            role_id: data.id!,
            org_type: ot,
            role_group: group,
            sort_order: prev?.sort_order ?? 0,
          };
        });
        const { error: scopeErr } = await db
          .from("platform_access_role_org_types")
          .insert(inserts);
        if (scopeErr) throw new Error(scopeErr.message);
      }
      return row as PlatformAccessRole;
    }

    if (!data.org_type) {
      throw new Error("Informe o tipo de instituição ao criar o cargo.");
    }
    const roleGroup = resolveRoleGroup(data.org_type, data.role_group);

    let maxSortQ = db
      .from("platform_access_role_org_types")
      .select("sort_order")
      .eq("org_type", data.org_type)
      .order("sort_order", { ascending: false })
      .limit(1);
    maxSortQ =
      roleGroup == null
        ? maxSortQ.is("role_group", null)
        : maxSortQ.eq("role_group", roleGroup);
    const { data: maxRow } = await maxSortQ.maybeSingle();

    const { data: row, error } = await db
      .from("platform_access_roles")
      .insert({
        key: data.key,
        label: data.label,
        is_system: false,
        match_kind: data.match_kind,
        match_code: data.match_code ?? null,
        sort_order: (maxRow?.sort_order ?? 90) + 10,
      })
      .select("id, key, label, is_system, match_kind, match_code, sort_order")
      .single();
    if (error) throw new Error(error.message);

    const { error: scopeErr } = await db
      .from("platform_access_role_org_types")
      .insert({
        role_id: row.id,
        org_type: data.org_type,
        role_group: roleGroup,
        sort_order: (maxRow?.sort_order ?? 0) + 10,
      });
    if (scopeErr) throw new Error(scopeErr.message);

    return row as PlatformAccessRole;
  });

/**
 * Vincula um cargo do catálogo (positions) à matriz de permissões
 * no tipo de instituição informado.
 */
export const linkPlatformAccessRoleToPosition = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        positionId: z.number().int().positive(),
        orgType: orgTypeSchema,
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();

    const { data: position, error: posErr } = await db
      .from("positions")
      .select("id, code, label, scope")
      .eq("id", data.positionId)
      .single();
    if (posErr) throw new Error(posErr.message);
    if (position.scope === "regional") {
      throw new Error("Cargos regionais não entram na matriz de permissões.");
    }

    const { data: pot } = await db
      .from("position_org_types")
      .select("role_group, sort_order")
      .eq("position_id", data.positionId)
      .eq("org_type", data.orgType)
      .maybeSingle();

    if (!pot) {
      throw new Error(
        "Este cargo não está cadastrado neste tipo de instituição. Inclua-o em Configurações Globais → Cargos.",
      );
    }

    const roleGroup = orgTypeHasRoleGroups(data.orgType)
      ? ((pot.role_group as RoleGroup | null) ?? "ritualisticos")
      : null;

    let { data: role } = await db
      .from("platform_access_roles")
      .select("id, key, label, is_system, match_kind, match_code, sort_order")
      .eq("match_kind", "position")
      .eq("match_code", position.code)
      .lt("sort_order", 1000)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!role) {
      const keyBase = String(position.code)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 64);
      let key = keyBase || `cargo_${position.id}`;
      for (let i = 0; i < 20; i++) {
        const candidate = i === 0 ? key : `${keyBase}_${i + 1}`.slice(0, 64);
        const { data: clash } = await db
          .from("platform_access_roles")
          .select("id")
          .eq("key", candidate)
          .maybeSingle();
        if (!clash) {
          key = candidate;
          break;
        }
      }

      const { data: created, error: createErr } = await db
        .from("platform_access_roles")
        .insert({
          key,
          label: position.label,
          is_system: false,
          match_kind: "position",
          match_code: position.code,
          sort_order: pot.sort_order ?? 100,
        })
        .select("id, key, label, is_system, match_kind, match_code, sort_order")
        .single();
      if (createErr) throw new Error(createErr.message);
      role = created;
    } else if (role.label !== position.label) {
      const { data: updated } = await db
        .from("platform_access_roles")
        .update({
          label: position.label,
          updated_at: new Date().toISOString(),
        })
        .eq("id", role.id)
        .select("id, key, label, is_system, match_kind, match_code, sort_order")
        .single();
      if (updated) role = updated;
    }

    const { error: linkErr } = await db
      .from("platform_access_role_org_types")
      .upsert(
        {
          role_id: role.id,
          org_type: data.orgType,
          role_group: roleGroup,
          sort_order: pot.sort_order ?? 0,
        },
        { onConflict: "role_id,org_type" },
      );
    if (linkErr) throw new Error(linkErr.message);

    return role as PlatformAccessRole;
  });

/** Inclui ou remove um cargo de um tipo de instituição (+ subcategoria). */
export const setPlatformAccessRoleOrgType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        roleId: z.string().uuid(),
        orgType: orgTypeSchema,
        enabled: z.boolean(),
        roleGroup: roleGroupSchema.nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();

    const roleGroup = data.enabled
      ? resolveRoleGroup(data.orgType, data.roleGroup ?? undefined)
      : null;

    const { error } = await db.rpc("set_platform_access_role_org_type", {
      _role_id: data.roleId,
      _org_type: data.orgType,
      _enabled: data.enabled,
      _role_group: roleGroup,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reordena cargos dentro de (org_type, role_group). */
export const reorderPlatformAccessRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        orgType: orgTypeSchema,
        roleGroup: roleGroupSchema.nullable(),
        orderedRoleIds: z.array(z.string().uuid()).min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();
    const roleGroup = resolveRoleGroup(
      data.orgType,
      data.roleGroup ?? undefined,
    );

    const { error } = await db.rpc("reorder_platform_access_roles", {
      _org_type: data.orgType,
      _role_group: roleGroup,
      _ordered_role_ids: data.orderedRoleIds,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlatformAccessRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();

    const { data: role, error: readErr } = await db
      .from("platform_access_roles")
      .select("id, is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!role) throw new Error("Cargo não encontrado");
    if (role.is_system) {
      throw new Error("Cargos de sistema não podem ser excluídos.");
    }

    const { error } = await db
      .from("platform_access_roles")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove cargo só do tipo atual; se for o último vínculo, exclui o cargo. */
export const removePlatformAccessRoleFromOrgType = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        roleId: z.string().uuid(),
        orgType: orgTypeSchema,
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();

    const { data, error } = await db.rpc("set_platform_access_role_org_type", {
      _role_id: data.roleId,
      _org_type: data.orgType,
      _enabled: false,
      _role_group: null,
    });
    if (error) throw new Error(error.message);
    const result = data as { deletedRole?: boolean } | null;
    return { deletedRole: Boolean(result?.deletedRole) };
  });

const grantRowSchema = z.object({
  screen_id: z.string().min(1),
  can_view: z.boolean(),
  can_edit: z.boolean(),
  can_create: z.boolean(),
  can_delete: z.boolean(),
});

export const savePlatformAccessGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        roleId: z.string().uuid(),
        orgType: orgTypeSchema,
        grants: z.array(grantRowSchema).min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdminTotal(
      context.supabase as unknown as AnyClient,
      context.userId,
    );
    const db = await adminDb();

    const rows = data.grants.map((g) => ({
      role_id: data.roleId,
      org_type: data.orgType,
      screen_id: g.screen_id,
      can_view: g.can_view,
      can_edit: g.can_edit,
      can_create: g.can_create,
      can_delete: g.can_delete,
    }));

    const { error } = await db
      .from("platform_access_grants")
      .upsert(rows, { onConflict: "role_id,org_type,screen_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
