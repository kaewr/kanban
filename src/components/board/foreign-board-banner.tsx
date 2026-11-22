import Link from "next/link";
import type { BoardOwner } from "@/lib/board/load";
import { boardHref } from "@/lib/routes";

/** BR-28: make it obvious that an admin is editing someone else's board. */
export function ForeignBoardBanner({ owner, year }: { owner: BoardOwner; year: number }) {
  return (
    <div
      role="status"
      data-testid="foreign-board-banner"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
    >
      <p className="flex-1">
        กำลังแก้บอร์ดของ <span className="font-semibold">{owner.displayName}</span>{" "}
        <span className="font-mono text-xs">(@{owner.username})</span>
        {owner.isActive === false && " · บัญชีนี้ปิดใช้งานแล้ว"} — การเปลี่ยนแปลงจะบันทึกในชื่อของคุณ
      </p>
      <Link href={boardHref({ year })} className="font-medium underline underline-offset-4">
        กลับไปบอร์ดของฉัน
      </Link>
    </div>
  );
}
