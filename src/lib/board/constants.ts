import type { TaskPriority, TaskStatus } from "@/types/domain";

export const BOARD_COLUMNS: readonly { status: TaskStatus; label: string; hint: string }[] = [
  { status: "long_term", label: "งานระยะยาว (ภายในปี)", hint: "Project พัฒนาตนเอง / พัฒนาระบบงาน" },
  { status: "short_term", label: "งานค้างระยะสั้น", hint: "ควรเสร็จภายใน 30 วัน" },
  { status: "in_progress", label: "กำลังทำ", hint: "ลงมือทำอยู่" },
  { status: "review", label: "รอตรวจสอบ", hint: "รอหัวหน้า/ผู้เกี่ยวข้องตรวจ" },
  { status: "done", label: "เสร็จแล้ว", hint: "ปิดงานแล้ว" },
];

export const STATUS_LABEL: Record<TaskStatus, string> = Object.fromEntries(
  BOARD_COLUMNS.map((c) => [c.status, c.label]),
) as Record<TaskStatus, string>;

export const PRIORITY_LABEL: Record<TaskPriority, string> = { 1: "สูง", 2: "กลาง", 3: "ต่ำ" };

/** BR-08: more than this many tasks in in_progress shows a WIP warning. */
export const WIP_LIMIT = 5;

/** BR-07: short_term tasks due later than this many days after creation get a hint. */
export const SHORT_TERM_MAX_DAYS = 30;

export const TITLE_MAX = 200;

/** BR-01: statuses that require an actual start date when a task is created there. */
export const STATUSES_REQUIRING_START: readonly TaskStatus[] = ["in_progress", "review", "done"];

export const TIME_ZONE = "Asia/Bangkok";
