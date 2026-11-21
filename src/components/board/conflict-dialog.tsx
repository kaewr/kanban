"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SaveConflict } from "@/lib/board/save";

type Props = {
  conflicts: SaveConflict[] | null;
  reloading: boolean;
  onReload: () => void;
  onDismiss: () => void;
};

/** FR-09: some tasks were changed elsewhere; nothing was saved. */
export function ConflictDialog({ conflicts, reloading, onReload, onDismiss }: Props) {
  return (
    <Dialog open={conflicts !== null} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยังไม่ได้บันทึก: มีงานถูกแก้จากที่อื่น</DialogTitle>
          <DialogDescription>
            งานต่อไปนี้ถูกแก้ไขหรือลบจากที่อื่นหลังจากที่คุณเปิดบอร์ด ระบบจึงไม่บันทึกอะไรเลยเพื่อไม่ให้เขียนทับ
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc pl-5 text-sm" data-testid="conflict-list">
          {conflicts?.map((c) => (
            <li key={c.id}>{c.title || "(ไม่มีชื่อ)"}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          กด &ldquo;โหลดงานที่ชนใหม่&rdquo; เพื่อดึงข้อมูลล่าสุดของงานเหล่านี้ (การแก้ของคุณเฉพาะงานเหล่านี้จะหายไป)
          การเปลี่ยนแปลงอื่นยังอยู่ แล้วกดบันทึกอีกครั้ง
        </p>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
          <Button type="button" onClick={onReload} disabled={reloading}>
            {reloading ? "กำลังโหลด…" : "โหลดงานที่ชนใหม่"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
