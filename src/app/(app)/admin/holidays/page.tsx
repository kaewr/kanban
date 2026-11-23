import { CalendarHeartIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { currentBoardYear, fiscalRangeLabel, parseYearParam, yearDateRange, yearOptions } from "@/lib/board/year";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { HolidayManager } from "./holiday-manager";

export const metadata = { title: "วันหยุดราชการ | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

/** BR-49: admins add and remove public holidays, one fiscal year at a time. */
export default async function AdminHolidaysPage({ searchParams }: PageProps<"/admin/holidays">) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: settings } = await supabase.from("app_settings").select("fiscal_start_month").maybeSingle();
  const fiscalStartMonth = settings?.fiscal_start_month ?? 10;
  const current = currentBoardYear({ yearType: "fiscal", fiscalStartMonth });
  const year = parseYearParam(params.year, current);
  const { from, to } = yearDateRange(year, "fiscal", fiscalStartMonth);

  const { data, error } = await supabase
    .from("holidays")
    .select("id, holiday_date, name")
    .gte("holiday_date", from)
    .lte("holiday_date", to)
    .order("holiday_date");
  if (error) throw new Error("โหลดวันหยุดไม่สำเร็จ");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={ROUTES.admin} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeftIcon className="size-4" aria-hidden />
          Admin
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarHeartIcon className="size-6 text-primary" aria-hidden />
          วันหยุดราชการ
        </h1>
        <p className="text-sm text-muted-foreground">
          แสดงเป็นป้ายบนบอร์ดและปฏิทินวันลาเท่านั้น ไม่มีผลกับงาน กำหนดเสร็จ หรือการนับวันลา
        </p>
      </div>
      <HolidayManager
        key={year}
        year={year}
        years={yearOptions(current, [])}
        rangeLabel={fiscalRangeLabel(year, fiscalStartMonth)}
        range={{ from, to }}
        holidays={data.map((h) => ({ id: h.id, date: h.holiday_date, name: h.name }))}
      />
    </div>
  );
}
