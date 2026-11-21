// Seed / inspect tasks with the service role (Node side only).
import { currentBoardYear } from "../../src/lib/board/year";
import type { Database } from "../../src/types/database";
import type { TaskStatus } from "../../src/types/domain";
import { service } from "./users";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

let cachedCategoryId: string | null = null;

export async function firstCategory(): Promise<{ id: string; name: string }> {
  const { data, error } = await service()
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .single();
  if (error) throw new Error(`firstCategory: ${error.message}`);
  cachedCategoryId = data.id;
  return data;
}

/** Board year the app shows by default (BR-10, from app_settings). */
export async function currentYear(): Promise<number> {
  const { data, error } = await service().from("app_settings").select("year_type, fiscal_start_month").single();
  if (error) throw new Error(`currentYear: ${error.message}`);
  return currentBoardYear({
    yearType: data.year_type === "fiscal" ? "fiscal" : "calendar",
    fiscalStartMonth: data.fiscal_start_month,
  });
}

export type SeedTask = {
  title: string;
  status: TaskStatus;
  position?: number;
  year?: number;
  dueDate?: string | null;
  progress?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
};

export async function seedTasks(ownerId: string, tasks: SeedTask[]): Promise<TaskRow[]> {
  const categoryId = cachedCategoryId ?? (await firstCategory()).id;
  const year = await currentYear();
  const rows = tasks.map((t, i) => ({
    owner_id: ownerId,
    title: t.title,
    status: t.status,
    category_id: categoryId,
    year: t.year ?? year,
    position: t.position ?? (i + 1) * 1024,
    due_date: t.dueDate ?? null,
    progress: t.progress ?? null,
    started_at: t.startedAt ?? null,
    completed_at: t.completedAt ?? null,
    ...(t.createdAt ? { created_at: t.createdAt } : {}),
  }));
  const { data, error } = await service().from("tasks").insert(rows).select("*");
  if (error) throw new Error(`seedTasks: ${error.message}`);
  // Keep the caller's order.
  return tasks.map((t) => data.find((r) => r.title === t.title) as TaskRow);
}

export async function tasksOf(ownerId: string): Promise<TaskRow[]> {
  const { data, error } = await service().from("tasks").select("*").eq("owner_id", ownerId).order("title");
  if (error) throw new Error(`tasksOf: ${error.message}`);
  return data;
}
