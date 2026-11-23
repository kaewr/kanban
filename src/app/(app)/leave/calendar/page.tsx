import { CalendarDaysIcon, CalendarHeartIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { LEAVE_STYLE } from "@/components/leave/leave-type-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { bangkokDate, formatThaiWeekdayDate } from "@/lib/board/dates";
import { loadBoardOwners } from "@/lib/board/load";
import { monthGrid, monthLabel, parseMonthParam, shiftMonth, spreadByDay } from "@/lib/leave/calendar";
import { LEAVE_LABEL, LEAVE_TYPES, type LeaveType } from "@/lib/leave/rules";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { UnitFilter } from "./unit-filter";

export const metadata = { title: "ปฏิทินวันลา | Kanban Board บันทึกงาน" };
// Reads the session per request, so it cannot be an instant navigation.
export const instant = false;

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

type Entry = { id: string; ownerId: string; who: string; leaveType: LeaveType; startDate: string; endDate: string };

/**
 * BR-48: month calendar of leave and holidays. Admins see everyone (optionally one unit);
 * everyone else sees only their own leave (RLS enforces this as well).
 */
export default async function LeaveCalendarPage({ searchParams }: PageProps<"/leave/calendar">) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const params = await searchParams;
  const today = bangkokDate(new Date());
  const month = parseMonthParam(params.month, today.slice(0, 7));
  const weeks = monthGrid(month);
  const from = weeks[0]![0]!.date;
  const to = weeks[weeks.length - 1]![6]!.date;

  const supabase = await createClient();
  const owners = isAdmin ? await loadBoardOwners() : [];
  const units = isAdmin ? ((await supabase.from("units").select("id, name").order("name")).data ?? []) : [];
  const unit = isAdmin && typeof params.unit === "string" && units.some((u) => u.id === params.unit) ? params.unit : null;

  let leavesQuery = supabase
    .from("leaves")
    .select("id, owner_id, leave_type, start_date, end_date")
    .eq("is_deleted", false)
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date");
  if (!isAdmin) leavesQuery = leavesQuery.eq("owner_id", profile.id);
  const [leavesRes, holidaysRes] = await Promise.all([
    leavesQuery,
    supabase.from("holidays").select("holiday_date, name").gte("holiday_date", from).lte("holiday_date", to),
  ]);
  if (leavesRes.error || holidaysRes.error) throw new Error("โหลดปฏิทินวันลาไม่สำเร็จ");

  const ownerById = new Map(owners.map((o) => [o.id, o]));
  const entries: Entry[] = leavesRes.data
    .filter((l) => !unit || ownerById.get(l.owner_id)?.unitId === unit)
    .map((l) => ({
      id: l.id,
      ownerId: l.owner_id,
      who: ownerById.get(l.owner_id)?.displayName ?? profile.displayName,
      leaveType: (LEAVE_TYPES as readonly string[]).includes(l.leave_type) ? (l.leave_type as LeaveType) : "other",
      startDate: l.start_date,
      endDate: l.end_date,
    }))
    .sort((a, b) => a.who.localeCompare(b.who, "th"));
  // Leave counts Monday–Friday only (BR-41), so weekend days of a range are not shown as leave.
  const weekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  const byDay = new Map([...spreadByDay(entries, from, to)].filter(([date]) => !weekend(date)));
  const holidays = new Map(holidaysRes.data.map((h) => [h.holiday_date, h.name]));

  const hrefFor = (next: string) => {
    const query = new URLSearchParams({ month: next });
    if (unit) query.set("unit", unit);
    return `${ROUTES.leaveCalendar}?${query}`;
  };
  const leaveHref = (e: Entry) => (isAdmin && e.ownerId !== profile.id ? `${ROUTES.leave}?user=${e.ownerId}` : ROUTES.leave);
  const label = (e: Entry) => (isAdmin ? `${e.who} · ${LEAVE_LABEL[e.leaveType]}` : LEAVE_LABEL[e.leaveType]);
  const daysInMonth = weeks.flat().filter((d) => d.inMonth);
  const agenda = daysInMonth.filter((d) => holidays.has(d.date) || byDay.has(d.date));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={ROUTES.leave} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ChevronLeftIcon className="size-4" aria-hidden />
            วันลา
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDaysIcon className="size-6 text-primary" aria-hidden />
            ปฏิทินวันลา
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "วันลาของทุกคนและวันหยุดราชการ" : "วันลาของคุณและวันหยุดราชการ"}
          </p>
        </div>
        {isAdmin && <UnitFilter month={month} unit={unit} units={units} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefFor(shiftMonth(month, -1))}
          aria-label="เดือนก่อนหน้า"
          className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-foreground/10 hover:bg-muted"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
        </Link>
        <h2 className="min-w-40 text-center text-lg font-semibold" data-testid="calendar-month">
          {monthLabel(month)}
        </h2>
        <Link
          href={hrefFor(shiftMonth(month, 1))}
          aria-label="เดือนถัดไป"
          className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-foreground/10 hover:bg-muted"
        >
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
        {month !== today.slice(0, 7) && (
          <Link href={hrefFor(today.slice(0, 7))} className="ml-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
            เดือนนี้
          </Link>
        )}
      </div>

      {/* Desktop and tablet: month grid. */}
      <Card className="gap-0 overflow-hidden py-0 max-md:hidden">
        <CardContent className="p-0">
          <div role="table" aria-label={`ปฏิทิน ${monthLabel(month)}`} className="grid grid-cols-7" data-testid="calendar-grid">
            <div role="row" className="contents">
              {WEEKDAYS.map((d, i) => (
                <div
                  role="columnheader"
                  key={d}
                  className={cn(
                    "border-b px-2 py-2 text-center text-xs font-medium text-muted-foreground",
                    (i === 0 || i === 6) && "bg-muted/40",
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week) => (
              <div role="row" className="contents" key={week[0]!.date}>
                {week.map((day) => {
                  const holiday = holidays.get(day.date);
                  const items = byDay.get(day.date) ?? [];
                  return (
                    <div
                      role="cell"
                      key={day.date}
                      data-date={day.date}
                      className={cn(
                        "flex min-h-28 min-w-0 flex-col gap-1 border-r border-b p-1.5 text-xs [&:nth-child(7n)]:border-r-0",
                        (day.weekend || holiday) && "bg-muted/40",
                        !day.inMonth && "opacity-45",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center self-end rounded-full tabular-nums",
                          day.date === today ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                        )}
                        aria-label={formatThaiWeekdayDate(day.date)}
                      >
                        {day.day}
                      </span>
                      {holiday && (
                        <span
                          className="flex items-start gap-1 rounded-md bg-brand-gold-soft px-1.5 py-0.5 font-medium text-brand-gold"
                          data-testid="calendar-holiday"
                          title={holiday}
                        >
                          <CalendarHeartIcon className="mt-px size-3 shrink-0" aria-hidden />
                          <span className="line-clamp-2">{holiday}</span>
                        </span>
                      )}
                      {items.map((e) => (
                        <Link
                          key={e.id}
                          href={leaveHref(e)}
                          title={`${label(e)} (${formatThaiWeekdayDate(e.startDate)} – ${formatThaiWeekdayDate(e.endDate)})`}
                          data-testid="calendar-leave"
                          className={cn(
                            "rounded-md px-1.5 py-0.5 leading-snug font-medium wrap-break-word ring-1 ring-inset hover:brightness-95",
                            LEAVE_STYLE[e.leaveType],
                          )}
                        >
                          {label(e)}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phones: only the days that have something. */}
      <Card className="md:hidden">
        <CardContent>
          {agenda.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีวันลาหรือวันหยุดในเดือนนี้</p>
          ) : (
            <ol className="flex flex-col divide-y" data-testid="calendar-agenda">
              {agenda.map((day) => (
                <li key={day.date} data-date={day.date} className="flex flex-col gap-1.5 py-2.5">
                  <span className={cn("text-sm font-medium", day.date === today && "text-primary")}>
                    {formatThaiWeekdayDate(day.date)}
                    {day.date === today && " · วันนี้"}
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {holidays.get(day.date) && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-brand-gold-soft px-1.5 py-0.5 font-medium text-brand-gold">
                        <CalendarHeartIcon className="size-3" aria-hidden />
                        {holidays.get(day.date)}
                      </span>
                    )}
                    {(byDay.get(day.date) ?? []).map((e) => (
                      <Link
                        key={e.id}
                        href={leaveHref(e)}
                        className={cn("rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset", LEAVE_STYLE[e.leaveType])}
                      >
                        {label(e)}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
