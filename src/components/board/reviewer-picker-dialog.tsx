"use client";

import { UserCheckIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useBoardStore } from "@/stores/board-store-provider";
import { ReviewerSelect } from "./reviewer-select";

/** BR-53: asked right after a card lands in "รอตรวจสอบ". Skipping is fine. */
export function ReviewerPickerDialog({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = useBoardStore((s) => (taskId ? s.tasks[taskId] : undefined));
  const setReviewer = useBoardStore((s) => s.setReviewer);
  const open = Boolean(task && task.status === "review");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && task && (
          <PickerForm
            key={task.id}
            title={task.title}
            initial={task.reviewerId ?? ""}
            onPick={(reviewerId) => {
              setReviewer(task.id, reviewerId || null);
              onClose();
            }}
            onSkip={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PickerForm({
  title,
  initial,
  onPick,
  onSkip,
}: {
  title: string;
  initial: string;
  onPick: (reviewerId: string) => void;
  onSkip: () => void;
}) {
  const [reviewerId, setReviewerId] = useState(initial);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onPick(reviewerId);
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserCheckIcon className="size-5 text-primary" aria-hidden />
          ส่งให้ใครตรวจ?
        </DialogTitle>
        <DialogDescription>
          {title} — ผู้ตรวจจะได้รับแจ้งเตือนเมื่อคุณกด &ldquo;บันทึก&rdquo; บนบอร์ด
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reviewer-picker">ผู้ตรวจ</Label>
        <ReviewerSelect id="reviewer-picker" value={reviewerId} onChange={setReviewerId} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSkip}>
          ข้าม
        </Button>
        <Button type="submit" disabled={!reviewerId}>
          เลือกผู้ตรวจ
        </Button>
      </DialogFooter>
    </form>
  );
}
