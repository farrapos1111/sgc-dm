import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  classifyAuditArea,
  classifyAuditSeverity,
  formatChapterAuditDetail,
  formatChapterAuditTitle,
  type AuditArea,
  type AuditSeverity,
} from "@/lib/audit-log";
import { fromAppTzDateTimeLocal } from "@/lib/timezone";

export type ChapterAuditRow = {
  id: string;
  action: string;
  area: AuditArea;
  severity: AuditSeverity;
  tableName: string;
  createdAt: string;
  userId: string | null;
  userName: string;
  title: string;
  detail: string | null;
};

async function assertCanViewChapterAudit(
  supabase: {
    from: (t: string) => any;
  },
  opts: { userId: string; chapterId: string; email?: string | null },
) {
  const { userHoldsOfficeInChapter } = await import(
    "@/lib/office-signatures.functions"
  );
  const ok = await userHoldsOfficeInChapter(supabase, {
    userId: opts.userId,
    chapterId: opts.chapterId,
    positionCode: "mestre_conselheiro",
    email: opts.email ?? null,
  });
  if (!ok) {
    throw new Error(
      "Apenas o Mestre Conselheiro ou o Administrador Total podem ver a auditoria",
    );
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function payloadUuid(
  value: unknown,
  key: "ticket_id" | "item_id" | "member_id",
): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "string" && v ? v : null;
}

function withComandaNames(
  value: unknown,
  itemNameById: Map<string, string>,
  buyerByTicket: Map<string, string>,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const rec = { ...(value as Record<string, unknown>) };
  const itemId = payloadUuid(rec, "item_id");
  const ticketId = payloadUuid(rec, "ticket_id");
  if (!asString(rec.item_name) && itemId) {
    const name = itemNameById.get(itemId);
    if (name) rec.item_name = name;
  }
  if (!asString(rec.buyer_name) && ticketId) {
    const buyer = buyerByTicket.get(ticketId);
    if (buyer) rec.buyer_name = buyer;
  }
  return rec;
}

export function ymdRangeIso(from?: string | null, until?: string | null) {
  const start = from
    ? fromAppTzDateTimeLocal(`${from}T00:00`).toISOString()
    : null;
  let endExclusive: string | null = null;
  if (until) {
    const [y, m, d] = until.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const nextYmd = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
    endExclusive = fromAppTzDateTimeLocal(`${nextYmd}T00:00`).toISOString();
  }
  return { start, endExclusive };
}

/** Audit log do capítulo (tesouraria, secretaria e eventos). */
export const listChapterAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        chapterId: z.string().uuid(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<ChapterAuditRow[]> => {
    const email =
      (context.claims as { email?: string } | null)?.email ?? null;
    await assertCanViewChapterAudit(context.supabase, {
      userId: context.userId,
      chapterId: data.chapterId,
      email,
    });

    const { start, endExclusive } = ymdRangeIso(data.from, data.until);
    let query = context.supabase
      .from("audit_logs")
      .select(
        "id, action, table_name, new_value, old_value, user_id, created_at, record_id",
      )
      .eq("chapter_id", data.chapterId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (start) query = query.gte("created_at", start);
    if (endExclusive) query = query.lt("created_at", endExclusive);
    const { data: logs, error } = await query;
    if (error) throw new Error(error.message);

    const rows = logs ?? [];
    const userIds = [
      ...new Set(
        rows
          .map((r) => r.user_id)
          .filter((id): id is string => typeof id === "string" && !!id),
      ),
    ];
    const memberIds = [
      ...new Set(
        rows
          .filter((r) => r.table_name === "members" && r.record_id)
          .map((r) => r.record_id as string),
      ),
    ];
    const chargeMemberIds = [
      ...new Set(
        rows
          .map((r) => {
            const nv = r.new_value as { member_id?: unknown } | null;
            const ov = r.old_value as { member_id?: unknown } | null;
            if (typeof nv?.member_id === "string") return nv.member_id;
            if (typeof ov?.member_id === "string") return ov.member_id;
            return null;
          })
          .filter((id): id is string => !!id),
      ),
    ];
    const allMemberIds = [...new Set([...memberIds, ...chargeMemberIds])];
    const ticketIds = [
      ...new Set(
        rows
          .map((r) => payloadUuid(r.new_value, "ticket_id"))
          .filter((id): id is string => !!id),
      ),
    ];
    const itemIds = [
      ...new Set(
        rows
          .map((r) => payloadUuid(r.new_value, "item_id"))
          .filter((id): id is string => !!id),
      ),
    ];

    const [profilesRes, membersRes, ticketsRes, itemsRes] = await Promise.all([
      userIds.length
        ? context.supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null }[],
            error: null,
          }),
      allMemberIds.length
        ? context.supabase
            .from("members")
            .select("id, full_name")
            .in("id", allMemberIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string }[],
            error: null,
          }),
      ticketIds.length
        ? context.supabase
            .from("tickets")
            .select("id, buyer_name")
            .in("id", ticketIds)
        : Promise.resolve({
            data: [] as { id: string; buyer_name: string }[],
            error: null,
          }),
      itemIds.length
        ? context.supabase
            .from("event_finance_items")
            .select("id, name")
            .in("id", itemIds)
        : Promise.resolve({
            data: [] as { id: string; name: string }[],
            error: null,
          }),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (ticketsRes.error) throw new Error(ticketsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    const userNameById = new Map(
      (profilesRes.data ?? []).map((p) => [
        p.id,
        asString(p.full_name) ?? "Usuário",
      ]),
    );
    const memberNameById = new Map(
      (membersRes.data ?? []).map((m) => [m.id, m.full_name]),
    );
    const buyerByTicket = new Map(
      (ticketsRes.data ?? [])
        .map((t) => [t.id, asString(t.buyer_name)] as const)
        .filter((e): e is readonly [string, string] => !!e[1]),
    );
    const itemNameById = new Map(
      (itemsRes.data ?? []).map((i) => [i.id, i.name]),
    );

    return rows.map((row) => {
      const nv = withComandaNames(row.new_value, itemNameById, buyerByTicket);
      const ov = row.old_value;
      const memberId =
        row.table_name === "members"
          ? row.record_id
          : payloadUuid(nv, "member_id");
      const subjectName = memberId ? memberNameById.get(memberId) ?? null : null;
      return {
        id: row.id,
        action: row.action,
        area: classifyAuditArea(row.action, nv, row.table_name),
        severity: classifyAuditSeverity(row.action, nv),
        tableName: row.table_name,
        createdAt: row.created_at,
        userId: row.user_id,
        userName:
          (row.user_id ? userNameById.get(row.user_id) : null) ?? "Usuário",
        title: formatChapterAuditTitle(row.action, nv, subjectName),
        detail: formatChapterAuditDetail(row.action, nv, ov),
      };
    });
  });
