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
import { useBoardStore } from "@/stores/board-store-provider";

/** BR-12: soft delete (state only until saved). */
export function DeleteTaskDialog({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = useBoardStore((s) => (taskId ? s.tasks[taskId] : undefined));
  const deleteTask = useBoardStore((s) => s.deleteTask);

  return (
    <Dialog open={Boolean(task)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ลบงาน</DialogTitle>
          <DialogDescription>ลบ &ldquo;{task?.title}&rdquo; ออกจากบอร์ด?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (taskId) deleteTask(taskId);
              onClose();
            }}
          >
            ลบงาน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
