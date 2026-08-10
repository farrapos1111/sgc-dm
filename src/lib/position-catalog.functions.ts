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

type AnyClient = {
  from: (table: string) => any;
};

const orgTypeSchema = z.enum(ORG_TYPES);
const roleGroupSchema = z.enum(ROLE_GROUPS);

export type CatalogPosition = {
  id: number;
  code: string;
  label: string;
  scope: string;
  sort_order: number;
  is_system: boolean;
};

export type PositionOrgTypeRow = {
  position_id: number;
  org_type: OrgType;
  role_group: RoleGroup | null;
  sort_order: number;
};

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
  if (!ok) throw new Error("Apenas Administrador Total pode gerenciar cargos globais.");
}

async function adminDb(): Promise<AnyClient> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  return supabaseAdmin as unknown as AnyClient;
}

function scopeForGroup(group: RoleGroup | null): string {
  if (group === "conselho") return "consultivo";
  if (group === "comissoes") return "comissao";
  return "capitulo";
}

function slugPositionCode(label: string): string {
  let base = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!base) return "cargo";
  if (!/^[a-z]/.test(base)) base = `c_${base}`.slice(0, 48);
  return base;
}

async function uniquePositionCode(
  db: AnyClient,
  label: string,
): Promise<string> {
  const base = slugPositionCode(label);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`.slice(0, 64);
    const { data } = await db
      .from("positions")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`.slice(0, 64);
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

export const listPositionCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as AnyClient;

    const { data: positions, error: posErr } = await db
      .from("positions")
      .select("id, code, label, scope, sort_order, is_system")
      .neq("scope", "regional")
      .order("sort_order", { ascending: true });
    if (posErr) throw new Error(posErr.message);

    const { data: scopes, error: scopeErr } = await db
      .from("position_org_types")
      .select("position_id, org_type, role_group, sort_order")
      .order("sort_order", { ascending: true });
    if (scopeErr) throw new Error(scopeErr.message);

    return {
      positions: (positions ?? []) as CatalogPosition[],
      positionOrgTypes: (scopes ?? []) as PositionOrgTypeRow[],
    };
  });

export const upsertCatalogPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.number().int().positive().optional(),
        label: z.string().trim().min(2).max(80),
        orgType: orgTypeSchema,
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
    const roleGroup = resolveRoleGroup(
      data.orgType,
      data.roleGroup ?? undefined,
    );
    const scope = scopeForGroup(roleGroup);

    if (data.id) {
      const { data: existing, error: readErr } = await db
        .from("positions")
        .select("id, is_system, code, scope")
        .eq("id", data.id)
        .single();
      if (readErr) throw new Error(readErr.message);
      if (existing.scope === "regional") {
        throw new Error("Cargos regionais não são gerenciados nesta tela.");
      }

      const { data: row, error } = await db
        .from("positions")
        .update({
          label: data.label,
          ...(existing.is_system ? {} : { scope }),
        })
        .eq("id", data.id)
        .select("id, code, label, scope, sort_order, is_system")
        .single();
      if (error) throw new Error(error.message);

      const { data: existingScope } = await db
        .from("position_org_types")
        .select("sort_order")
        .eq("position_id", data.id)
        .eq("org_type", data.orgType)
        .maybeSingle();

      const { error: upErr } = await db.from("position_org_types").upsert(
        {
          position_id: data.id,
          org_type: data.orgType,
          role_group: roleGroup,
          sort_order: existingScope?.sort_order ?? 0,
        },
        { onConflict: "position_id,org_type" },
      );
      if (upErr) throw new Error(upErr.message);
      return row as CatalogPosition;
    }

    let maxQ = db
      .from("position_org_types")
      .select("sort_order")
      .eq("org_type", data.orgType)
      .order("sort_order", { ascending: false })
      .limit(1);
    maxQ =
      roleGroup == null
        ? maxQ.is("role_group", null)
        : maxQ.eq("role_group", roleGroup);
    const { data: maxRow } = await maxQ.maybeSingle();
    const nextSort = (maxRow?.sort_order ?? 0) + 10;
    const code = await uniquePositionCode(db, data.label);

    const { data: row, error } = await db
      .from("positions")
      .insert({
        code,
        label: data.label,
        scope,
        sort_order: nextSort,
        is_system: false,
      })
      .select("id, code, label, scope, sort_order, is_system")
      .single();
    if (error) throw new Error(error.message);

    const { error: scopeErr } = await db.from("position_org_types").insert({
      position_id: row.id,
      org_type: data.orgType,
      role_group: roleGroup,
      sort_order: nextSort,
    });
    if (scopeErr) throw new Error(scopeErr.message);

    return row as CatalogPosition;
  });

export const removeCatalogPositionFromOrgType = createServerFn({
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

    const { error } = await db
      .from("position_org_types")
      .delete()
      .eq("position_id", data.positionId)
      .eq("org_type", data.orgType);
    if (error) throw new Error(error.message);

    const { data: remaining, error: remErr } = await db
      .from("position_org_types")
      .select("org_type")
      .eq("position_id", data.positionId)
      .limit(1);
    if (remErr) throw new Error(remErr.message);

    if ((remaining ?? []).length === 0) {
      const { data: pos } = await db
        .from("positions")
        .select("is_system, scope")
        .eq("id", data.positionId)
        .maybeSingle();
      if (pos?.scope === "regional") {
        return { deletedPosition: false };
      }
      if (!pos?.is_system) {
        const { error: delErr } = await db
          .from("positions")
          .delete()
          .eq("id", data.positionId);
        if (delErr) throw new Error(delErr.message);
        return { deletedPosition: true };
      }
    }
    return { deletedPosition: false };
  });

export const reorderCatalogPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        orgType: orgTypeSchema,
        roleGroup: roleGroupSchema.nullable(),
        orderedPositionIds: z.array(z.number().int().positive()).min(1),
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

    for (let i = 0; i < data.orderedPositionIds.length; i++) {
      const positionId = data.orderedPositionIds[i]!;
      let q = db
        .from("position_org_types")
        .update({ sort_order: (i + 1) * 10 })
        .eq("position_id", positionId)
        .eq("org_type", data.orgType);
      q =
        roleGroup == null
          ? q.is("role_group", null)
          : q.eq("role_group", roleGroup);
      const { error } = await q;
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
