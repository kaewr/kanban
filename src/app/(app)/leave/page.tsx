import { CalendarDaysIcon, CalendarOffIcon } from "lucide-react";
import Link from "next/link";
import { LeaveTypeBadge } from "@/components/leave/leave-type-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { bangkokDate } from "@/lib/board/dates";
import { loadBoardOwners } from "@/lib/board/load";
import { currentBoardYear, parseYearParam, yearDateRange, yearLabel, yearOptions } from "@/lib/board/year";
import { monthSeries } from "@/lib/dashboard/summary";
import { LEAVE_TYPES } from "@/lib/leave/rules";
import { parseLeaveSummary } from "@/lib/leave/summary";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { LeaveFilters } from "./leave-filters";
import { LeaveForm } from "./leave-form";
import { LeaveList, type LeaveRow } from "./leave-list";

export const metadata = { title: "วันลา | Kanban Board บันทึกงาน" };
// Reads the session per request, so it cannot be an instant navigation.
export const instant = false;

export default async function LeavePage({ searchParams }: PageProps<"/leave">) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const params = await searchParams;
  const supabase = await createClient();

  const { data: settings } = await supabase.from("app_settings").select("fiscal_start_month").maybeSingle();
  const fiscalStartMonth = settings?.fiscal_start_month ?? 10;
  const current = currentBoardYear({ yearType: profile.yearType, fiscalStartMonth });
  const year = parseYearParam(params.year, current);
  const { from, to } = yearDateRange(year, profile.yearType, fiscalStartMonth);
  const today = bangkokDate(new Date());

  // BR-44: admins can record leave for anyone; others only for themselves.
  const owners = isAdmin ? await loadBoardOwners() : null;
  const chosen = isAdmin && typeof params.user === "string" ? owners?.find((o) => o.id === params.user) : undefined;
  const owner = chosen ?? { id: profile.id, displayName: profile.displayName };

  const [leavesRes, summaryRes] = await Promise.all([
    supabase
      .from("leaves")
      .select("id, leave_type, start_date, end_date, note, created_by")
      .eq("owner_id", owner.id)
      .eq("is_deleted", false)
      .lte("start_date", to)
      .gte("end_date", from)
      .order("start_date", { ascending: false }),
    supabase.rpc("leave_summary", { p_from: from, p_to: to, p_owner_id: owner.id }),
  ]);
  if (leavesRes.error || summaryRes.error) throw new Error("โหลดข้อมูลวันลาไม่สำเร็จ");

  const nameOf = new Map(owners?.map((o) => [o.id, o.displayName]) ?? []);
  const rows: LeaveRow[] = leavesRes.data.map((l) => ({
    id: l.id,
    leaveType: (LEAVE_TYPES as readonly string[]).includes(l.leave_type) ? (l.leave_type as LeaveRow["leaveType"]) : "other",
    startDate: l.start_date,
    endDate: l.end_date,
    note: l.note,
    createdByOther: l.created_by === owner.id ? null : (nameOf.get(l.created_by) ?? "ผู้ดูแลระบบ"),
  }));

  const summary = parseLeaveSummary(summaryRes.data).find((p) => p.id === owner.id);
  const months = monthSeries(year, profile.yearType, fiscalStartMonth, []).map((m) => ({
    ...m,
    days: summary?.months[m.key] ?? 0,
  }));
  const isSelf = owner.id === profile.id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarOffIcon className="size-6 text-primary" aria-hidden />
            วันลา
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSelf ? "แจ้งวันลาของคุณ" : `วันลาของ ${owner.displayName}`} · {yearLabel(year, profile.yearType)} · นับเฉพาะวันจันทร์–ศุกร์
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={ROUTES.leaveCalendar}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary ring-1 ring-primary/25 hover:bg-primary/8"
          >
            <CalendarDaysIcon className="size-4" aria-hidden />
            ปฏิทินวันลา
          </Link>
          <LeaveFilters
            year={year}
            years={yearOptions(current, []).map((y) => ({ value: y, label: yearLabel(y, profile.yearType) }))}
            ownerId={owner.id}
            viewerId={profile.id}
            owners={owners?.map((o) => ({ id: o.id, name: o.displayName })) ?? null}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>แจ้งวันลา</CardTitle>
            <CardDescription>
              ลาวันเดียวหรือเป็นช่วงวันที่ แจ้งย้อนหลังหรือล่วงหน้าได้ ไม่ต้องรออนุมัติ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeaveForm key={owner.id} ownerId={owner.id} today={today} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>สรุปวันลา</CardTitle>
            <CardDescription>
              รวมทั้งปี <span className="font-semibold text-foreground tabular-nums" data-testid="leave-total">{summary?.total ?? 0}</span> วัน
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5" data-testid="leave-by-type">
              {LEAVE_TYPES.filter((t) => summary?.types[t]).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-sm">
                  <LeaveTypeBadge type={t} />
                  <span className="tabular-nums">{summary?.types[t]}</span>
                </span>
              ))}
            </div>
            <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" data-testid="leave-months">
              {months.map((m) => (
                <li
                  key={m.key}
                  data-month={m.key}
                  className={cn(
                    "flex flex-col items-center rounded-lg px-1 py-1.5 text-xs ring-1 ring-inset",
                    m.days > 0 ? "bg-primary/10 ring-primary/25" : "ring-foreground/10",
                  )}
                >
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className={cn("text-base tabular-nums", m.days > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>
                    {m.days}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการวันลา</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveList rows={rows} ownerId={owner.id} today={today} />
        </CardContent>
      </Card>
    </div>
  );
}
