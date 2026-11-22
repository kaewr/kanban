// FR-18 category rules shared by the admin page and its server actions.

export const CATEGORY_NAME_MAX = 50;
export const DUPLICATE_CATEGORY = "มีหมวดหมู่ชื่อนี้แล้ว";
export const LAST_ACTIVE_CATEGORY = "ต้องมีหมวดหมู่ที่ใช้งานอย่างน้อย 1 หมวด";

export type CategoryRow = { id: string; name: string; sortOrder: number; isActive: boolean };

/** Trims and collapses inner whitespace so "งาน  ประจำ" and "งาน ประจำ" count as the same name. */
export function normalizeCategoryName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

/** Returns a Thai error message, or null when the name is fine. */
export function validateCategoryName(name: string, others: readonly { name: string }[]): string | null {
  if (name.length === 0) return "กรุณากรอกชื่อหมวดหมู่";
  if (name.length > CATEGORY_NAME_MAX) return `ชื่อหมวดหมู่ยาวได้ไม่เกิน ${CATEGORY_NAME_MAX} ตัวอักษร`;
  const lower = name.toLocaleLowerCase("th");
  if (others.some((o) => o.name.toLocaleLowerCase("th") === lower)) return DUPLICATE_CATEGORY;
  return null;
}

/** New tasks need a category, so the last active one cannot be turned off. */
export function canDeactivate(categories: readonly CategoryRow[], id: string): boolean {
  return categories.some((c) => c.isActive && c.id !== id);
}

/** Ids in display order after moving one category up (-1) or down (+1). Null when it cannot move. */
export function moveCategory(categories: readonly CategoryRow[], id: string, direction: -1 | 1): string[] | null {
  const ids = categories.map((c) => c.id);
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}
