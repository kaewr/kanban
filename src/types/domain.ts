import type { Tables } from "@/types/database";

// Values enforced by check constraints in supabase/migrations (init_schema).
export const TASK_STATUSES = [
  "long_term",
  "short_term",
  "in_progress",
  "review",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type YearType = "calendar" | "fiscal";

/** 1 = high, 2 = medium, 3 = low */
export type TaskPriority = 1 | 2 | 3;

export type Profile = Tables<"profiles">;
export type Task = Tables<"tasks">;
export type TaskHistory = Tables<"task_history">;
export type Category = Tables<"categories">;
export type AppSettings = Tables<"app_settings">;
