"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { changedTasks } from "@/lib/board/changes";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/board/draft";
import { useBoardStoreApi } from "@/stores/board-store-provider";

const DRAFT_WRITE_DELAY_MS = 500;

function formatDraftTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * FR-10: keeps unsaved changes in localStorage and offers them back when the board
 * is opened again. Client-only (loaded with ssr: false) so the stored draft is read
 * exactly once, at mount. Writing starts only after the user decided about an old
 * draft, so an unanswered draft is never overwritten.
 */
export function BoardDraft({ ownerId, year }: { ownerId: string; year: number }) {
  const store = useBoardStoreApi();
  const key = draftKey(ownerId, year);
  const [initialDraft] = useState(() => loadDraft(key));
  const [decided, setDecided] = useState(initialDraft === null);

  useEffect(() => {
    if (!decided) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = () => {
      const { tasks, snapshot } = store.getState();
      const changed = changedTasks(tasks, snapshot);
      if (changed.length > 0) saveDraft(key, changed);
      else clearDraft(key);
    };
    const flush = () => {
      clearTimeout(timer);
      write();
    };
    const unsubscribe = store.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(write, DRAFT_WRITE_DELAY_MS);
    });
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush(); // leaving the board in-app keeps the latest changes as a draft
    };
  }, [decided, key, store]);

  return (
    <Dialog open={initialDraft !== null && !decided}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>พบร่างที่ยังไม่บันทึก</DialogTitle>
          <DialogDescription>
            มีการเปลี่ยนแปลง {initialDraft?.tasks.length ?? 0} รายการที่ยังไม่ได้บันทึก
            {initialDraft ? ` (เมื่อ ${formatDraftTime(initialDraft.savedAt)})` : ""} ต้องการกู้คืนหรือไม่
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearDraft(key);
              setDecided(true);
            }}
          >
            ทิ้งร่าง
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (initialDraft) store.getState().restoreDraft(initialDraft.tasks);
              setDecided(true);
            }}
          >
            กู้คืน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
