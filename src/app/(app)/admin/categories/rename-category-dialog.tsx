"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_NAME_MAX, type CategoryRow } from "@/lib/admin/categories";
import { renameCategory } from "./actions";

export function RenameCategoryDialog({ category, disabled }: { category: CategoryRow; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setError(undefined);
    startTransition(async () => {
      const result = await renameCategory(category.id, name);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  const inputId = `rename-${category.id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} aria-label={`แก้ชื่อ ${category.name}`} />}
      >
        แก้ชื่อ
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>แก้ชื่อหมวดหมู่</DialogTitle>
          </DialogHeader>
          <FormMessage error={error} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>ชื่อหมวดหมู่</Label>
            <Input id={inputId} name="name" defaultValue={category.name} maxLength={CATEGORY_NAME_MAX} required />
            <p className="text-xs text-muted-foreground">ชื่อใหม่จะแสดงกับงานเดิมที่อยู่ในหมวดนี้ด้วย</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
