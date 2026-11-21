import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { TaskPriority, TaskStatus, YearType } from "@/types/domain";
import type { BoardCategory, BoardTask } from "./types";
import { currentBoardYear, parseYearParam, yearOptions } from "./year";

export type BoardData = {
  year: number;
  yearType: YearType;
  years: number[];
  tasks: BoardTask[];
  categories: BoardCategory[];
};

function toBoardTask(row: Tables<"tasks">): BoardTask {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus, // check constraint guarantees the 5 values
    categoryId: row.category_id,
    priority: row.priority as TaskPriority, // check constraint 1–3
    year: row.year,
    dueDate: row.due_date,
    progress: row.progress,
    position: Number(row.position),
    carriedFromYear: row.carried_from_year,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    version: row.version,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    isNew: false,
    moves: [],
  };
}

/** Loads one owner's board for a year (FR-07, FR-12). Reads go through RLS. */
export async function loadBoard(ownerId: string, yearParam: unknown): Promise<BoardData> {
  const supabase = await createClient();

  const [settingsRes, categoriesRes, yearsRes] = await Promise.all([
    supabase.from("app_settings").select("year_type, fiscal_start_month").maybeSingle(),
    supabase.from("categories").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("tasks").select("year").eq("owner_id", ownerId).eq("is_deleted", false),
  ]);
  if (settingsRes.error || categoriesRes.error || yearsRes.error) {
    throw new Error("โหลดข้อมูลบอร์ดไม่สำเร็จ");
  }

  const yearType: YearType = settingsRes.data?.year_type === "fiscal" ? "fiscal" : "calendar";
  const current = currentBoardYear({
    yearType,
    fiscalStartMonth: settingsRes.data?.fiscal_start_month ?? 10,
  });
  const year = parseYearParam(yearParam, current);

  const tasksRes = await supabase
    .from("tasks")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("year", year)
    .eq("is_deleted", false)
    .order("position");
  if (tasksRes.error) throw new Error("โหลดงานไม่สำเร็จ");

  return {
    year,
    yearType,
    years: yearOptions(current, [...yearsRes.data.map((r) => r.year), year]),
    tasks: tasksRes.data.map(toBoardTask),
    categories: categoriesRes.data.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active })),
  };
}
