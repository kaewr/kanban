"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_LABEL, STATUSES_REQUIRING_START, STATUS_LABEL, TITLE_MAX } from "@/lib/board/constants";
import { bangkokDate, dateTimeInputToTimestamp, formatThaiDateTime, toDateTimeInput } from "@/lib/board/dates";
import { movesOf } from "@/lib/board/history";
import { DURATION_MAX, validateTaskInput, type TaskInputErrors } from "@/lib/board/rules";
import type { BoardCategory, BoardTask, TaskInput, TaskMove } from "@/lib/board/types";
import { useBoardStore } from "@/stores/board-store-provider";
import { ReviewerSelect } from "./reviewer-select";
import type { TaskPriority, TaskStatus } from "@/types/domain";

export type TaskDialogMode = { kind: "create"; status: TaskStatus } | { kind: "edit"; taskId: string };

type Props = {
  mode: TaskDialogMode | null;
  onClose: () => void;
  categories: BoardCategory[];
  years: number[];
  /** BR-51: names to pick from; the title stays editable. */
  titlePresets: string[];
};

export function TaskDialog({ mode, onClose, categories, years, titlePresets }: Props) {
  const tasks = useBoardStore((s) => s.tasks);
  const task = mode?.kind === "edit" ? tasks[mode.taskId] : undefined;
  const open = mode !== null && (mode.kind === "create" || task !== undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {open && mode && (
          // Re-mount the form per opened task so defaults reset.
          <TaskForm
            key={mode.kind === "edit" ? mode.taskId : `new-${mode.status}`}
            status={mode.kind === "edit" ? (task as BoardTask).status : mode.status}
            task={task}
            categories={categories}
            years={years}
            titlePresets={titlePresets}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormProps = {
  status: TaskStatus;
  task: BoardTask | undefined;
  categories: BoardCategory[];
  years: number[];
  titlePresets: string[];
  onDone: () => void;
};

function TaskForm({ status, task, categories, years, titlePresets, onDone }: FormProps) {
  const boardYear = useBoardStore((s) => s.year);
  const createTask = useBoardStore((s) => s.createTask);
  const updateTask = useBoardStore((s) => s.updateTask);
  const [errors, setErrors] = useState<TaskInputErrors>({});
  const [year, setYear] = useState<number>(task?.year ?? boardYear);
  // Instant the dialog opened: "today" defaults keep the real time (BR-01).
  const [openedAt] = useState(() => new Date().toISOString());
  const titleRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState("");

  const isNew = !task;
  const today = bangkokDate(openedAt);
  const now = toDateTimeInput(openedAt);
  const savedHistory = useBoardStore((s) => (task ? s.history[task.id] : undefined));
  const needsStart = STATUSES_REQUIRING_START.includes(status);
  const showStart = needsStart || Boolean(task?.startedAt);
  const showCompleted = status === "done" || Boolean(task?.completedAt);
  const showProgress = status === "long_term";

  // Inactive categories stay selectable only for the task that already uses one.
  const categoryOptions = categories.filter((c) => c.isActive || c.id === task?.categoryId);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    const started = text("startedAt");
    const completed = text("completedAt");
    const progress = text("progress");
    const duration = text("durationMinutes").trim();

    const input: TaskInput = {
      title: text("title"),
      description: text("description"),
      categoryId: text("categoryId"),
      priority: Number(text("priority")) as TaskPriority,
      year: Number(text("year")),
      dueDate: text("dueDate") || null,
      progress: showProgress && progress !== "" ? Number(progress) : (task?.progress ?? null),
      startedAt: started ? dateTimeInputToTimestamp(started, task?.startedAt ?? openedAt) : null,
      completedAt: completed ? dateTimeInputToTimestamp(completed, task?.completedAt ?? openedAt) : null,
      reviewerId: status === "review" ? text("reviewerId") || null : null,
      durationMinutes: status === "done" && duration !== "" ? Number(duration) : null,
    };

    const found = validateTaskInput(input, status, isNew);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (task) updateTask(task.id, input);
    else createTask(status, input);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{isNew ? "เพิ่มงาน" : "แก้ไขงาน"}</DialogTitle>
        <DialogDescription>คอลัมน์: {STATUS_LABEL[status]}</DialogDescription>
      </DialogHeader>

      {titlePresets.length > 0 && (
        <Field id="task-preset" label="หัวข้องาน">
          <NativeSelect
            id="task-preset"
            value={preset}
            onChange={(e) => {
              const name = e.target.value;
              setPreset(name);
              // Copies the preset into the title, which stays editable.
              if (name && titleRef.current) {
                titleRef.current.value = name;
                titleRef.current.focus();
              }
            }}
          >
            <option value="">เลือกหัวข้องาน หรือพิมพ์ชื่องานเองด้านล่าง</option>
            {titlePresets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      <Field id="task-title" label="ชื่องาน" error={errors.title}>
        <Input
          ref={titleRef}
          id="task-title"
          name="title"
          defaultValue={task?.title}
          maxLength={TITLE_MAX}
          autoFocus
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "task-title-error" : undefined}
        />
      </Field>

      <Field id="task-description" label="รายละเอียด">
        <Textarea id="task-description" name="description" defaultValue={task?.description ?? ""} rows={3} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-category" label="หมวดหมู่" error={errors.categoryId}>
          <NativeSelect
            id="task-category"
            name="categoryId"
            defaultValue={task?.categoryId ?? ""}
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby={errors.categoryId ? "task-category-error" : undefined}
          >
            <option value="" disabled>
              เลือกหมวดหมู่
            </option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? "" : " (ปิดใช้งาน)"}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field id="task-priority" label="ความสำคัญ" error={errors.priority}>
          <NativeSelect id="task-priority" name="priority" defaultValue={String(task?.priority ?? 2)}>
            {([1, 2, 3] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field id="task-year" label="ปี" error={errors.year}>
          <NativeSelect id="task-year" name="year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field id="task-due" label="วันกำหนดเสร็จ">
          <Input
            id="task-due"
            name="dueDate"
            type="date"
            // New tasks default to today, except long-term work (BR-52).
            defaultValue={task ? (task.dueDate ?? "") : status === "long_term" ? "" : today}
          />
        </Field>

        {status === "review" && (
          <Field id="task-reviewer" label="ผู้ตรวจ">
            <ReviewerSelect id="task-reviewer" name="reviewerId" defaultValue={task?.reviewerId ?? ""} />
          </Field>
        )}

        {showProgress && (
          <Field id="task-progress" label="ความคืบหน้า (%)" error={errors.progress}>
            <Input
              id="task-progress"
              name="progress"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={task?.progress ?? ""}
              aria-invalid={Boolean(errors.progress)}
              aria-describedby={errors.progress ? "task-progress-error" : undefined}
            />
          </Field>
        )}

        {showStart && (
          <Field id="task-started" label={needsStart && isNew ? "วันเวลาเริ่มจริง" : "วันเวลาเริ่ม"} error={errors.startedAt}>
            <Input
              id="task-started"
              name="startedAt"
              type="datetime-local"
              defaultValue={task?.startedAt ? toDateTimeInput(task.startedAt) : needsStart ? now : ""}
              aria-invalid={Boolean(errors.startedAt)}
              aria-describedby={errors.startedAt ? "task-started-error" : undefined}
            />
          </Field>
        )}

        {showCompleted && (
          <Field id="task-completed" label={isNew ? "วันเวลาเสร็จจริง" : "วันเวลาเสร็จ"} error={errors.completedAt}>
            <Input
              id="task-completed"
              name="completedAt"
              type="datetime-local"
              defaultValue={task?.completedAt ? toDateTimeInput(task.completedAt) : status === "done" ? now : ""}
              aria-invalid={Boolean(errors.completedAt)}
              aria-describedby={errors.completedAt ? "task-completed-error" : undefined}
            />
          </Field>
        )}

        {status === "done" && (
          <Field
            id="task-duration"
            label={isNew ? "ใช้เวลา (นาที)" : "ใช้เวลา (นาที) ไม่บังคับ"}
            error={errors.durationMinutes}
          >
            <Input
              id="task-duration"
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={DURATION_MAX}
              step={1}
              placeholder="เช่น 45"
              defaultValue={task?.durationMinutes ?? ""}
              aria-invalid={Boolean(errors.durationMinutes)}
              aria-describedby={errors.durationMinutes ? "task-duration-error" : undefined}
            />
          </Field>
        )}
      </div>

      {year !== boardYear && (
        <p className="text-xs text-muted-foreground">งานนี้จะไปอยู่ในบอร์ดปี {year}</p>
      )}

      {task && <MoveHistory task={task} saved={savedHistory} />}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
        <Button type="submit">{isNew ? "เพิ่มงาน" : "ตกลง"}</Button>
      </DialogFooter>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** BR-58: when the task was created and every column change, oldest first. */
function MoveHistory({ task, saved }: { task: BoardTask; saved: TaskMove[] | undefined }) {
  const moves = movesOf(task, saved);
  if (moves.length === 0) return null;
  const unsavedFrom = moves.length - task.moves.length;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">ประวัติการย้าย</p>
      <ol className="flex flex-col gap-1 text-xs tabular-nums" data-testid="task-history">
        {moves.map((m, i) => (
          <li key={`${m.movedAt}-${i}`} className="flex flex-wrap gap-x-2">
            <span className="text-muted-foreground">{formatThaiDateTime(m.movedAt)}</span>
            <span>{m.from === null ? `สร้างใน "${STATUS_LABEL[m.to]}"` : `→ "${STATUS_LABEL[m.to]}"`}</span>
            {i >= unsavedFrom && <span className="text-brand-gold">(ยังไม่บันทึก)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
