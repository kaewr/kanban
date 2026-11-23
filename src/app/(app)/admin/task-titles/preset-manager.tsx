"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { PRESET_NAME_MAX, type TitlePreset } from "@/lib/admin/task-titles";
import { createPreset, deletePreset, movePreset, renamePreset, type PresetActionResult } from "./actions";

/** BR-51: add, rename, reorder and remove task title presets. */
export function PresetManager({ presets }: { presets: TitlePreset[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<PresetActionResult>, onSuccess?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onSuccess?.();
      else setError(result.error);
    });
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () => createPreset(newName),
      () => setNewName(""),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="new-preset">เพิ่มหัวข้องาน</Label>
          <Input
            id="new-preset"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={PRESET_NAME_MAX}
            placeholder="เช่น จัดทำรายงาน"
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="gap-1.5">
          <PlusIcon aria-hidden />
          เพิ่ม
        </Button>
      </form>

      <FormMessage error={error} />

      {presets.length === 0 ? (
        <p className="rounded-xl px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          ยังไม่มีหัวข้องาน ผู้ใช้พิมพ์ชื่องานเองได้ตามปกติ
        </p>
      ) : (
        <ol
          className="flex flex-col divide-y overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"
          aria-busy={pending}
          data-testid="preset-list"
        >
          {presets.map((preset, index) => (
            <li key={preset.id} data-preset={preset.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <span className="min-w-0 flex-1 font-medium">{preset.name}</span>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`เลื่อน ${preset.name} ขึ้น`}
                  disabled={pending || index === 0}
                  onClick={() => run(() => movePreset(preset.id, -1))}
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`เลื่อน ${preset.name} ลง`}
                  disabled={pending || index === presets.length - 1}
                  onClick={() => run(() => movePreset(preset.id, 1))}
                >
                  <ArrowDownIcon aria-hidden />
                </Button>
                <RenamePresetDialog preset={preset} disabled={pending} />
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`ลบ ${preset.name}`}
                  disabled={pending}
                  onClick={() => run(() => deletePreset(preset.id))}
                >
                  <Trash2Icon aria-hidden />
                  ลบ
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RenamePresetDialog({ preset, disabled }: { preset: TitlePreset; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setError(undefined);
    startTransition(async () => {
      const result = await renamePreset(preset.id, name);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  const inputId = `rename-preset-${preset.id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} aria-label={`แก้ชื่อ ${preset.name}`} />}
      >
        แก้ชื่อ
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>แก้หัวข้องาน</DialogTitle>
          </DialogHeader>
          <FormMessage error={error} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>หัวข้องาน</Label>
            <Input id={inputId} name="name" defaultValue={preset.name} maxLength={PRESET_NAME_MAX} required />
            <p className="text-xs text-muted-foreground">งานที่บันทึกไปแล้วยังใช้ชื่อเดิม</p>
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
