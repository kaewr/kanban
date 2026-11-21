import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { YearType } from "@/types/domain";
import { toBoardTask } from "./mapping";
import type { BoardCategory, BoardTask } from "./types";
import { currentBoardYear, parseYearParam, yearOptions } from "./year";

export type BoardData = {
  year: number;
  yearType: YearType;
  years: number[];
  tasks: BoardTask[];
  categories: BoardCategory[];
};

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
