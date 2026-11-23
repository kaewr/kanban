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
  /** BR-51 names offered in the task dialog. */
  titlePresets: string[];
  /** BR-54: reviewer comments on open review requests, by task id. */
  reviewComments: Record<string, string>;
};

export type BoardOwner = {
  id: string;
  username: string;
  displayName: string;
  position?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  isActive?: boolean;
};

/** FR-11: every account an admin can open, active first. RLS returns only the caller's row for non-admins. */
export async function loadBoardOwners(): Promise<BoardOwner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, position, is_active, unit_id, units(name)")
    .order("is_active", { ascending: false })
    .order("display_name");
  if (error) throw new Error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  return data.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    position: p.position,
    unitId: p.unit_id,
    unitName: p.units?.name ?? null,
    isActive: p.is_active,
  }));
}

/** Loads one owner's board for a year (FR-07, FR-12). Reads go through RLS. */
export async function loadBoard(ownerId: string, yearParam: unknown): Promise<BoardData> {
  const supabase = await createClient();

  const [settingsRes, ownerRes, categoriesRes, yearsRes, presetsRes] = await Promise.all([
    supabase.from("app_settings").select("fiscal_start_month").maybeSingle(),
    // BR-31: the board follows its owner's year type (also when an admin opens it).
    supabase.from("profiles").select("year_type").eq("id", ownerId).maybeSingle(),
    supabase.from("categories").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("tasks").select("year").eq("owner_id", ownerId).eq("is_deleted", false),
    supabase.from("task_title_presets").select("name").order("sort_order").order("name"),
  ]);
  if (settingsRes.error || ownerRes.error || categoriesRes.error || yearsRes.error || presetsRes.error) {
    throw new Error("โหลดข้อมูลบอร์ดไม่สำเร็จ");
  }

  const yearType: YearType = ownerRes.data?.year_type === "calendar" ? "calendar" : "fiscal";
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

  const reviewsRes = await supabase
    .from("task_reviews")
    .select("task_id, comment")
    .eq("owner_id", ownerId)
    .eq("status", "open")
    .not("comment", "is", null);
  if (reviewsRes.error) throw new Error("โหลดข้อมูลการตรวจงานไม่สำเร็จ");

  return {
    year,
    yearType,
    years: yearOptions(current, [...yearsRes.data.map((r) => r.year), year]),
    tasks: tasksRes.data.map(toBoardTask),
    categories: categoriesRes.data.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active })),
    titlePresets: presetsRes.data.map((p) => p.name),
    reviewComments: Object.fromEntries(reviewsRes.data.map((r) => [r.task_id, r.comment ?? ""])),
  };
}
