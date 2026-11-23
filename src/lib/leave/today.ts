import "server-only";
import { bangkokDate } from "@/lib/board/dates";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPES, type LeaveType } from "./rules";

export type TodayNotice = {
  holiday: string | null;
  leave: { leaveType: LeaveType; startDate: string; endDate: string } | null;
};

/**
 * BR-48: today's holiday and the board owner's leave covering today, if any.
 * Reads go through RLS: owners see their own leave, admins everyone's.
 */
export async function loadTodayNotice(ownerId: string): Promise<TodayNotice> {
  const today = bangkokDate(new Date());
  const supabase = await createClient();
  const [holidayRes, leaveRes] = await Promise.all([
    supabase.from("holidays").select("name").eq("holiday_date", today).maybeSingle(),
    supabase
      .from("leaves")
      .select("leave_type, start_date, end_date")
      .eq("owner_id", ownerId)
      .eq("is_deleted", false)
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(1)
      .maybeSingle(),
  ]);
  // A label only: never block the board if it cannot be read.
  const leave = leaveRes.data;
  return {
    holiday: holidayRes.data?.name ?? null,
    leave: leave
      ? {
          leaveType: (LEAVE_TYPES as readonly string[]).includes(leave.leave_type) ? (leave.leave_type as LeaveType) : "other",
          startDate: leave.start_date,
          endDate: leave.end_date,
        }
      : null,
  };
}
