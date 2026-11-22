"use client";

import { EraserIcon, MoreHorizontalIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { clearMyBoard } from "@/app/(app)/board/actions";
import { FormMessage } from "@/components/form-message";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearDraft, draftKey } from "@/lib/board/draft";
import { useBoardStore, useBoardStoreApi } from "@/stores/board-store-provider";

export const CLEAR_CONFIRM_WORD = "ล้างงาน";

/**
 * BR-47: clear all of your own tasks of the selected year (for trying the app out).
 * Hidden behind the board menu and a typed confirmation.
 */
export function ClearBoardMenu({ yearLabel }: { yearLabel: string }) {
  const store = useBoardStoreApi();
  const ownerId = useBoardStore((s) => s.ownerId);
  const year = useBoardStore((s) => s.year);
  const tasks = useBoardStore((s) => s.tasks);
  const snapshot = useBoardStore((s) => s.snapshot);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, startTransition] = useTransition();

  const saved = useMemo(() => Object.values(snapshot).filter((t) => !t.isDeleted).length, [snapshot]);
  const unsavedNew = useMemo(() => Object.values(tasks).filter((t) => t.isNew && !t.isDeleted).length, [tasks]);

  function onConfirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await clearMyBoard(year);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearDraft(draftKey(ownerId, year));
      store.getState().clearAll();
      setOpen(false);
      setDone(`ล้างงานแล้ว ${result.cleared} รายการ`);
    });
  }

  return (
    <>
      {done && (
        <p role="status" className="text-sm text-muted-foreground" data-testid="clear-result">
          {done}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="ตัวเลือกบอร์ด" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setTyped("");
              setError(undefined);
              setDone(undefined);
              setOpen(true);
            }}
          >
            <EraserIcon aria-hidden />
            ล้างงานทั้งหมดของปีนี้
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ล้างงานทั้งหมดของ{yearLabel}</DialogTitle>
            <DialogDescription>ใช้สำหรับเริ่มใหม่หลังทดลองใช้งาน</DialogDescription>
          </DialogHeader>

          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground"
          >
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <ul className="flex list-disc flex-col gap-1 pl-4">
              <li>
                งานที่บันทึกไว้ <span className="font-semibold tabular-nums">{saved}</span> รายการบนบอร์ดของคุณใน
                {yearLabel} จะถูกลบทั้งหมด รวมงานที่เสร็จแล้ว
              </li>
              {unsavedNew > 0 && <li>งานใหม่ที่ยังไม่บันทึก {unsavedNew} รายการจะหายไปด้วย</li>}
              <li>การเปลี่ยนแปลงที่ยังไม่บันทึกทั้งหมดจะหายไป</li>
              <li className="font-semibold">คุณกู้คืนเองไม่ได้ ถ้าลบผิดต้องติดต่อผู้ดูแลระบบ</li>
              <li>งานของปีอื่นและวันลาไม่ได้รับผลกระทบ</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="clear-confirm">
              พิมพ์ <span className="font-semibold text-destructive">{CLEAR_CONFIRM_WORD}</span> เพื่อยืนยัน
            </Label>
            <Input
              id="clear-confirm"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>

          <FormMessage error={error} />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>ยกเลิก</DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={typed.trim() !== CLEAR_CONFIRM_WORD || pending}
              onClick={onConfirm}
            >
              <EraserIcon aria-hidden />
              {pending ? "กำลังล้างงาน…" : "ล้างงานทั้งหมด"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
