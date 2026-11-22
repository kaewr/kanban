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

/** Board year a test user sees by default: test users keep the default fiscal year type (BR-31). */
export async function currentYear(yearType: "fiscal" | "calendar" = "fiscal"): Promise<number> {
  const { data, error } = await service().from("app_settings").select("fiscal_start_month").single();
  if (error) throw new Error(`currentYear: ${error.message}`);
  return currentBoardYear({ yearType, fiscalStartMonth: data.fiscal_start_month });
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
  priority?: 1 | 2 | 3;
  description?: string | null;
  categoryId?: string;
};

export async function seedTasks(ownerId: string, tasks: SeedTask[]): Promise<TaskRow[]> {
  const categoryId = cachedCategoryId ?? (await firstCategory()).id;
  const year = await currentYear();
  const rows = tasks.map((t, i) => ({
    owner_id: ownerId,
    title: t.title,
    status: t.status,
    category_id: t.categoryId ?? categoryId,
    priority: t.priority ?? 2,
    description: t.description ?? null,
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

export async function historyOf(taskId: string) {
  const { data, error } = await service()
    .from("task_history")
    .select("from_status, to_status, changed_by, changed_at")
    .eq("task_id", taskId)
    .order("changed_at")
    .order("id");
  if (error) throw new Error(`historyOf: ${error.message}`);
  return data;
}

/** Simulates an edit "from elsewhere": bumps version like a real save would. */
export async function editElsewhere(taskId: string, title: string): Promise<void> {
  const { data, error } = await service().from("tasks").select("version").eq("id", taskId).single();
  if (error) throw new Error(`editElsewhere: ${error.message}`);
  const res = await service().from("tasks").update({ title, version: data.version + 1 }).eq("id", taskId);
  if (res.error) throw new Error(`editElsewhere: ${res.error.message}`);
}

// ---------------------------------------------------------------------------
// Categories / settings (M7). Tests only touch e2e_* categories so parallel
// board tests keep their seed categories.
// ---------------------------------------------------------------------------
export const E2E_CATEGORY_PREFIX = "e2e_";

export async function categoriesInOrder() {
  const { data, error } = await service()
    .from("categories")
    .select("id, name, sort_order, is_active")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`categoriesInOrder: ${error.message}`);
  return data;
}

export async function deleteCategoriesNamed(names: string[]): Promise<void> {
  if (names.length > 0) await service().from("categories").delete().in("name", names);
}

/** Hard delete is fine here: the app never deletes categories, the service role can. */
export async function deleteTestCategories(): Promise<void> {
  await service().from("categories").delete().like("name", `${E2E_CATEGORY_PREFIX}%`);
}

export async function fiscalSettings() {
  const { data, error } = await service().from("app_settings").select("fiscal_start_month, updated_by").single();
  if (error) throw new Error(`fiscalSettings: ${error.message}`);
  return data;
}

/** Also clears updated_by so the test admin can be deleted (FK on delete restrict). */
export async function setFiscalStartMonth(month: number): Promise<void> {
  const { error } = await service()
    .from("app_settings")
    .update({ fiscal_start_month: month, updated_by: null })
    .eq("id", true);
  if (error) throw new Error(`setFiscalStartMonth: ${error.message}`);
}

/** Writes task_history rows directly (dashboard review/rework metrics). */
export async function seedHistory(
  rows: { taskId: string; from: TaskStatus | null; to: TaskStatus; by: string; at: string }[],
): Promise<void> {
  const { error } = await service()
    .from("task_history")
    .insert(rows.map((r) => ({ task_id: r.taskId, from_status: r.from, to_status: r.to, changed_by: r.by, changed_at: r.at })));
  if (error) throw new Error(`seedHistory: ${error.message}`);
}

export async function categoryByName(name: string): Promise<{ id: string; name: string }> {
  const { data, error } = await service().from("categories").select("id, name").eq("name", name).single();
  if (error) throw new Error(`categoryByName: ${error.message}`);
  return data;
}
