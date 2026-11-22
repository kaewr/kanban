import { ArrowLeftIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import type { BoardOwner } from "@/lib/board/load";
import { boardHref } from "@/lib/routes";

/** BR-28: make it obvious that an admin is editing someone else's board. */
export function ForeignBoardBanner({ owner, year }: { owner: BoardOwner; year: number }) {
  return (
    <div
      role="status"
      data-testid="foreign-board-banner"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 text-sm text-foreground"
    >
      <EyeIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">
        กำลังแก้บอร์ดของ <span className="font-semibold">{owner.displayName}</span>{" "}
        <span className="font-mono text-xs">(@{owner.username})</span>
        {owner.isActive === false && " · บัญชีนี้ปิดใช้งานแล้ว"} — การเปลี่ยนแปลงจะบันทึกในชื่อของคุณ
      </p>
      <Link
        href={boardHref({ year })}
        className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        กลับไปบอร์ดของฉัน
      </Link>
    </div>
  );
}
