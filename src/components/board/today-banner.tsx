import { CalendarHeartIcon, CalendarOffIcon } from "lucide-react";
import Link from "next/link";
import { formatThaiDate } from "@/lib/board/dates";
import { LEAVE_LABEL } from "@/lib/leave/rules";
import type { TodayNotice } from "@/lib/leave/today";
import { ROUTES } from "@/lib/routes";

/** BR-48: today's holiday and the owner's leave, shown as a label only. */
export function TodayBanner({ notice, ownerName }: { notice: TodayNotice; ownerName: string | null }) {
  const { holiday, leave } = notice;
  if (!holiday && !leave) return null;

  const range =
    leave && leave.startDate !== leave.endDate
      ? ` (${formatThaiDate(leave.startDate)} – ${formatThaiDate(leave.endDate)})`
      : "";

  return (
    <div
      role="status"
      data-testid="today-banner"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-brand-gold/30 bg-brand-gold-soft px-4 py-3 text-sm text-foreground"
    >
      {holiday && (
        <p className="flex items-center gap-2" data-testid="today-holiday">
          <CalendarHeartIcon className="size-4 shrink-0 text-brand-gold" aria-hidden />
          <span>
            วันนี้วันหยุด: <span className="font-semibold">{holiday}</span>
          </span>
        </p>
      )}
      {leave && (
        <p className="flex items-center gap-2" data-testid="today-leave">
          <CalendarOffIcon className="size-4 shrink-0 text-brand-gold" aria-hidden />
          <span>
            {ownerName ? (
              <>
                <span className="font-semibold">{ownerName}</span> {LEAVE_LABEL[leave.leaveType]}วันนี้
              </>
            ) : (
              <>
                วันนี้คุณ<span className="font-semibold">{LEAVE_LABEL[leave.leaveType]}</span>
              </>
            )}
            <span className="text-muted-foreground">{range}</span>
          </span>
        </p>
      )}
      <Link
        href={ROUTES.leaveCalendar}
        className="ml-auto font-medium text-brand-gold underline-offset-4 hover:underline"
      >
        ดูปฏิทินวันลา
      </Link>
    </div>
  );
}
