import { SHORT_TERM_MAX_DAYS, STATUSES_REQUIRING_START, TITLE_MAX, WIP_LIMIT } from "./constants";
import { bangkokDate, daysBetween } from "./dates";
import { MAX_YEAR, MIN_YEAR } from "./year";
import type { BoardTask, TaskInput } from "./types";
import type { TaskStatus } from "@/types/domain";

/**
 * BR-03 / BR-04: date changes caused by moving a task to another column.
 * The server re-applies the same rules on save (M6).
 */
export function statusChangeDates(
  task: Pick<BoardTask, "status" | "startedAt" | "completedAt">,
  to: TaskStatus,
  now: string,
): Pick<BoardTask, "startedAt" | "completedAt"> {
  if (task.status === to) return { startedAt: task.startedAt, completedAt: task.completedAt };

  const startedAt = to === "in_progress" && !task.startedAt ? now : task.startedAt; // BR-03
  let completedAt = task.completedAt;
  if (to === "done") completedAt = now; // BR-04 into done
  else if (task.status === "done") completedAt = null; // BR-04 out of done

  return { startedAt, completedAt };
}

export type TaskInputErrors = Partial<Record<keyof TaskInput, string>>;

/** Validates the task dialog. `status` is the column the task is (or will be) in. */
export function validateTaskInput(input: TaskInput, status: TaskStatus, isNew: boolean): TaskInputErrors {
  const errors: TaskInputErrors = {};
  const title = input.title.trim();

  if (title.length === 0) errors.title = "กรุณากรอกชื่องาน";
  else if (title.length > TITLE_MAX) errors.title = `ชื่องานต้องไม่เกิน ${TITLE_MAX} ตัวอักษร`;

  if (!input.categoryId) errors.categoryId = "กรุณาเลือกหมวดหมู่";
  if (![1, 2, 3].includes(input.priority)) errors.priority = "ความสำคัญไม่ถูกต้อง";
  if (!Number.isInteger(input.year) || input.year < MIN_YEAR || input.year > MAX_YEAR) {
    errors.year = "ปีไม่ถูกต้อง";
  }
  if (input.progress !== null && (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100)) {
    errors.progress = "ความคืบหน้าต้องเป็นจำนวนเต็ม 0–100";
  }

  // BR-01: creating in in_progress/review/done needs a start date; done also an end date.
  if (isNew && STATUSES_REQUIRING_START.includes(status) && !input.startedAt) {
    errors.startedAt = "กรุณากรอกวันเริ่มจริง";
  }
  if (isNew && status === "done" && !input.completedAt) {
    errors.completedAt = "กรุณากรอกวันเสร็จจริง";
  }
  if (input.startedAt && input.completedAt && bangkokDate(input.completedAt) < bangkokDate(input.startedAt)) {
    errors.completedAt = "วันเสร็จต้องไม่ก่อนวันเริ่ม";
  }

  return errors;
}

/** BR-07: short_term task due more than 30 days after creation -> suggest long_term. */
export function suggestsLongTerm(task: Pick<BoardTask, "status" | "dueDate" | "createdAt">): boolean {
  if (task.status !== "short_term" || !task.dueDate) return false;
  return daysBetween(bangkokDate(task.createdAt), task.dueDate) > SHORT_TERM_MAX_DAYS;
}

/** BR-08: WIP warning (does not block). */
export function exceedsWipLimit(inProgressCount: number): boolean {
  return inProgressCount > WIP_LIMIT;
}
