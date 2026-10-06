import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CalendarType, CalendarTypeLabels } from "@/lib/calendar-types";
import type { PrazoKind } from "@/lib/org-mandatory-dates.functions";

function getPublicSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function throwPublicRpcError(error: { message: string }, context: string): never {
  console.error(`[public-conference] ${context}:`, error.message);
  throw new Error("Não foi possível concluir a solicitação.");
}

const tokenInput = z.string().trim().min(16).max(128);

export type PublicConferenceChapter = {
  name: string;
  number: string;
  city: string | null;
  primary_color: string | null;
  founded_at: string | null;
};

export type PublicCalendarCategory = {
  id: string;
  name: string;
  color: string;
};

export type PublicCalendarItem = {
  id: string;
  title: string;
  event_type: CalendarType;
  mandatory: boolean;
  public_open: boolean;
  start_at: string;
  end_at: string | null;
  location: string | null;
  address: string | null;
  dress_code: string | null;
  description: string | null;
  custom_category_id: string | null;
  org_mandatory_date_id: string | null;
};

export type PublicMandatoryDate = {
  id: string;
  title: string;
  prazo_kind: PrazoKind;
  due_date: string | null;
  due_year: number | null;
  due_month: number | null;
  due_day: number | null;
  start_month: number | null;
  start_day: number | null;
};

export type PublicCalendarPayload = {
  chapter: PublicConferenceChapter & {
    calendar_type_labels: CalendarTypeLabels;
  };
  categories: PublicCalendarCategory[];
  mandatory_dates: PublicMandatoryDate[];
  items: PublicCalendarItem[];
};

export type PublicNominataPosition = {
  id: number;
  code: string;
  label: string;
  scope: string;
  sort_order: number;
  role_group: "ritualisticos" | "conselho" | "comissoes" | null;
};

export type PublicNominataAssignment = {
  id: string;
  position_id: number;
  member_name: string;
};

export type PublicNominataCommissionRole = {
  id: string;
  role: string;
  member_name: string;
  commission_label: string;
};

export type PublicNominataPayload = {
  chapter: PublicConferenceChapter & { org_type: string };
  positions: PublicNominataPosition[];
  assignments: PublicNominataAssignment[];
  commission_roles: PublicNominataCommissionRole[];
};

export const getPublicCalendar = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: tokenInput,
        from: z.string().datetime(),
        to: z.string().datetime(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_calendar" as never,
      { _token: data.token, _from: data.from, _to: data.to } as never,
    );
    if (error) throwPublicRpcError(error, "getPublicCalendar");
    return payload as PublicCalendarPayload;
  });

export const getPublicNominata = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        token: tokenInput,
        year: z.number().int().min(1900).max(2200),
        semester: z.union([z.literal(1), z.literal(2)]),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicSupabase();
    const { data: payload, error } = await supabase.rpc(
      "get_public_nominata" as never,
      {
        _token: data.token,
        _year: data.year,
        _semester: data.semester,
      } as never,
    );
    if (error) throwPublicRpcError(error, "getPublicNominata");
    return payload as PublicNominataPayload;
  });
