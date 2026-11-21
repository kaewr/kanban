"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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
import { changedTasks } from "@/lib/board/changes";
import { useBoardStore } from "@/stores/board-store-provider";

type ConfirmLeave = (proceed: () => void) => void;

const GuardContext = createContext<ConfirmLeave>((proceed) => proceed());

/** Ask before leaving with unsaved changes (e.g. switching the year). */
export function useConfirmLeave(): ConfirmLeave {
  return useContext(GuardContext);
}

/**
 * FR-10: warn when leaving the board with unsaved changes.
 * - closing / reloading the tab: the browser's own beforeunload prompt
 * - in-app links and year changes: our dialog (App Router has no navigation-block API,
 *   so link clicks are intercepted in the capture phase before Next's Link sees them)
 */
export function UnsavedGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dirty = useBoardStore((s) => changedTasks(s.tasks, s.snapshot).length > 0);
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // older browsers need a value to show the prompt
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // new tab/window
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      setPending(() => () => router.push(`${url.pathname}${url.search}${url.hash}`));
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, router]);

  const confirmLeave = useCallback<ConfirmLeave>(
    (proceed) => {
      if (dirty) setPending(() => proceed);
      else proceed();
    },
    [dirty],
  );

  return (
    <GuardContext.Provider value={confirmLeave}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยังไม่ได้บันทึก</DialogTitle>
            <DialogDescription>
              มีรายการที่ยังไม่บันทึก ถ้าออกตอนนี้การเปลี่ยนแปลงจะถูกเก็บเป็นร่างในเครื่องนี้ และกู้คืนได้เมื่อกลับมาที่บอร์ด
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>อยู่ต่อ</DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const proceed = pending;
                setPending(null);
                proceed?.();
              }}
            >
              ออกโดยไม่บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}
