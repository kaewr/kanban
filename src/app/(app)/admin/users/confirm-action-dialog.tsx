"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AdminApiResult } from "@/lib/admin/client";

type Props = {
  trigger: ReactElement;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Shown in the dialog after success; when omitted the dialog just closes. */
  successMessage?: string;
  action: () => Promise<AdminApiResult>;
};

export function ConfirmActionDialog({
  trigger,
  triggerLabel,
  title,
  description,
  confirmLabel,
  destructive,
  successMessage,
  action,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function onConfirm() {
    setPending(true);
    setError(undefined);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    if (successMessage) setDone(true);
    else setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setError(undefined);
          setDone(false);
        }
      }}
    >
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {!done && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <FormMessage error={error} success={done ? successMessage : undefined} />

        <DialogFooter>
          {done ? (
            <DialogClose render={<Button type="button" />}>ปิด</DialogClose>
          ) : (
            <>
              <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
              <Button
                type="button"
                variant={destructive ? "destructive" : "default"}
                disabled={pending}
                onClick={onConfirm}
              >
                {pending ? "กำลังดำเนินการ…" : confirmLabel}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
