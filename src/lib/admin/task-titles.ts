// BR-51 task title presets, shared by the admin page, its server actions and the task dialog.

export const PRESET_NAME_MAX = 100;
export const DUPLICATE_PRESET = "มีหัวข้องานนี้แล้ว";

export type TitlePreset = { id: string; name: string; sortOrder: number };

/** Trims and collapses inner whitespace. */
export function normalizePresetName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

/** Returns a Thai error message, or null when the name is fine. */
export function validatePresetName(name: string, others: readonly { name: string }[]): string | null {
  if (name.length === 0) return "กรุณากรอกหัวข้องาน";
  if (name.length > PRESET_NAME_MAX) return `หัวข้องานยาวได้ไม่เกิน ${PRESET_NAME_MAX} ตัวอักษร`;
  const lower = name.toLocaleLowerCase("th");
  if (others.some((o) => o.name.toLocaleLowerCase("th") === lower)) return DUPLICATE_PRESET;
  return null;
}
