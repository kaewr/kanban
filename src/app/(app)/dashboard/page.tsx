import {
  AlarmClockIcon,
  CircleCheckBigIcon,
  HourglassIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  RotateCcwIcon,
  ScanEyeIcon,
  TargetIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import { STATUS_STYLE } from "@/components/board/status-style";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireProfile } from "@/lib/auth";
import { BOARD_COLUMNS } from "@/lib/board/constants";
import { loadBoardOwners } from "@/lib/board/load";
import { currentBoardYear, parseYearParam, yearLabel, yearOptions } from "@/lib/board/year";
import { monthSeries, parseSummary, type DashboardSummary } from "@/lib/dashboard/summary";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CategoryDoneChart, MonthlyDoneChart } from "./charts";
import { DashboardFilters } from "./dashboard-filters";

export const metadata = { title: "Dashboard | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

const days = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("th-TH", { maximumFractionDigits: 1 })} วัน`);
const percent = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
  testId: string;
}) {
  return (
    <Card size="sm" data-testid={testId}>
      <CardContent className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums" data-testid={`${testId}-value`}>
            {value}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartTable({ caption, rows }: { caption: string; rows: { label: string; value: number }[] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">ดูเป็นตาราง</summary>
      <table className="mt-2 w-full text-left text-xs tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-dashed last:border-0">
              <th className="py-1 font-normal text-muted-foreground">{r.label}</th>
              <td className="py-1 text-right">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function PeopleTable({ summary }: { summary: DashboardSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>สรุปรายคน</CardTitle>
        <CardDescription>จำนวนงานของปีนี้แยกตามสถานะ</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table data-testid="people-table">
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ-นามสกุล</TableHead>
              {BOARD_COLUMNS.map((c) => (
                <TableHead key={c.status} className="text-right">
                  {c.label.replace(" (ภายในปี)", "")}
                </TableHead>
              ))}
              <TableHead className="text-right">เกินกำหนด</TableHead>
              <TableHead className="text-right">Cycle time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.people.map((p) => (
              <TableRow key={p.id} data-person={p.displayName}>
                <TableCell>
                  <div className="font-medium">
                    {p.displayName}
                    {!p.isActive && <span className="ml-1 text-xs text-muted-foreground">(ปิดใช้งาน)</span>}
                  </div>
                  {p.unitName && <div className="text-xs text-muted-foreground">{p.unitName}</div>}
                </TableCell>
                {BOARD_COLUMNS.map((c) => (
                  <TableCell key={c.status} className="text-right tabular-nums">
                    {p.counts[c.status]}
                  </TableCell>
                ))}
                <TableCell
                  className={cn("text-right tabular-nums", p.overdue > 0 && "font-semibold text-rose-700 dark:text-rose-300")}
                >
                  {p.overdue}
                </TableCell>
                <TableCell className="text-right tabular-nums">{days(p.cycleDaysAvg)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const params = await searchParams;
  const supabase = await createClient();

  const { data: settings } = await supabase.from("app_settings").select("fiscal_start_month").maybeSingle();
  const fiscalStartMonth = settings?.fiscal_start_month ?? 10;
  const yearType = profile.yearType; // BR-31: the viewer's own choice
  const current = currentBoardYear({ yearType, fiscalStartMonth });
  const year = parseYearParam(params.year, current);

  // FR-16: users see their own numbers (RLS); admins may narrow by unit and person.
  const [owners, unitsRes] = isAdmin
    ? await Promise.all([loadBoardOwners(), supabase.from("units").select("id, name").order("sort_order")])
    : [null, null];
  const units = unitsRes?.data ?? null;
  const unitId = isAdmin && typeof params.unit === "string" && units?.some((u) => u.id === params.unit) ? params.unit : "";
  const userId = isAdmin && typeof params.user === "string" && owners?.some((o) => o.id === params.user) ? params.user : "";

  const { data, error } = await supabase.rpc("dashboard_summary", {
    p_year: year,
    p_unit_id: unitId || undefined,
    p_owner_id: isAdmin ? userId || undefined : profile.id,
  });
  if (error) throw new Error("โหลดข้อมูล Dashboard ไม่สำเร็จ");
  const summary = parseSummary(data);

  const months = monthSeries(year, yearType, fiscalStartMonth, summary.monthly);
  const lt = summary.longTerm;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboardIcon className="size-6 text-primary" aria-hidden />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "ภาพรวมงานของทุกคน" : "ภาพรวมงานของคุณ"} · {yearLabel(year, yearType)}
          </p>
        </div>
        <DashboardFilters
          year={year}
          years={yearOptions(current, []).map((y) => ({ value: y, label: yearLabel(y, yearType) }))}
          yearLabel="เลือกปี"
          unitId={unitId}
          userId={userId}
          units={units}
          people={owners?.map((o) => ({ id: o.id, name: o.displayName, unitId: o.unitId })) ?? null}
        />
      </div>

      {/* Headline numbers (spec: 4 tiles) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ListTodoIcon} label="งานค้างทั้งหมด" value={String(summary.totals.open)} hint="ยังไม่เสร็จ" testId="stat-open" />
        <StatTile
          icon={AlarmClockIcon}
          label="เกินกำหนด"
          value={String(summary.totals.overdue)}
          hint="เลยวันกำหนดและยังไม่เสร็จ"
          tone={summary.totals.overdue > 0 ? "danger" : "default"}
          testId="stat-overdue"
        />
        <StatTile
          icon={CircleCheckBigIcon}
          label="เสร็จเดือนนี้"
          value={String(summary.totals.doneThisMonth)}
          hint={`ทั้งปี ${summary.totals.done} งาน`}
          testId="stat-done-month"
        />
        <StatTile
          icon={TimerIcon}
          label="Cycle time เฉลี่ย"
          value={days(summary.totals.cycleDaysAvg)}
          hint="จากเริ่มทำถึงเสร็จ"
          testId="stat-cycle"
        />
      </div>

      {/* Count per status */}
      <div className="flex flex-wrap gap-2" data-testid="status-counts">
        {BOARD_COLUMNS.map((c) => {
          const style = STATUS_STYLE[c.status];
          const Icon = style.icon;
          return (
            <span key={c.status} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", style.pill)}>
              <Icon className="size-4" aria-hidden />
              {c.label}
              <span className="font-semibold tabular-nums" data-status={c.status}>
                {summary.byStatus[c.status]}
              </span>
            </span>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>งานที่เสร็จรายเดือน</CardTitle>
            <CardDescription>นับตามวันที่เสร็จจริง</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyDoneChart data={months} />
            <ChartTable caption="งานที่เสร็จรายเดือน" rows={months.map((m) => ({ label: m.label, value: m.done }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>งานที่เสร็จตามหมวดหมู่</CardTitle>
            <CardDescription>สัดส่วนงานแต่ละประเภท</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.categories.length > 0 ? (
              <>
                <CategoryDoneChart data={summary.categories} />
                <ChartTable
                  caption="งานที่เสร็จตามหมวดหมู่"
                  rows={summary.categories.map((c) => ({ label: c.name, value: c.done }))}
                />
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีงานที่เสร็จในปีนี้</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={HourglassIcon}
          label="เวลารอตรวจสอบเฉลี่ย"
          value={days(summary.review.avgWaitDays)}
          hint="ช่วงที่อยู่ในคอลัมน์รอตรวจสอบ"
          testId="stat-review-wait"
        />
        <StatTile
          icon={RotateCcwIcon}
          label="อัตราตีกลับ"
          value={percent(summary.review.reworkRate)}
          hint={`ตีกลับ ${summary.review.reworks} ครั้ง จาก ${summary.review.entered} งานที่เคยรอตรวจ`}
          testId="stat-rework"
        />
        <StatTile
          icon={TargetIcon}
          label="งานระยะยาวของปี"
          value={lt.total > 0 ? `${lt.done}/${lt.total} เสร็จ` : "—"}
          hint={lt.avgProgress === null ? "ยังไม่มีความคืบหน้า" : `ความคืบหน้าเฉลี่ยงานที่ยังไม่เสร็จ ${lt.avgProgress}%`}
          testId="stat-long-term"
        />
      </div>

      {isAdmin && !userId && <PeopleTable summary={summary} />}
      {!isAdmin && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScanEyeIcon className="size-3.5" aria-hidden />
          ข้อมูลนับเฉพาะงานของ{yearLabel(year, yearType)}บนบอร์ดของคุณ
        </p>
      )}
    </div>
  );
}
