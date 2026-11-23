"use server";

import { refresh } from "next/cache";
import {
  DUPLICATE_PRESET,
  normalizePresetName,
  validatePresetName,
  type TitlePreset,
} from "@/lib/admin/task-titles";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// BR-51. Writes use the admin's own session; RLS (task_title_presets_*_admin) enforces the role.
// Presets are copied into tasks.title, so nothing here changes existing tasks.

export type PresetActionResult = { ok: true } | { ok: false; error: string };

const FAILED = "บันทึกหัวข้องานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
const NOT_FOUND = "ไม่พบหัวข้องานนี้ อาจถูกแก้ไขจากที่อื่น กรุณาโหลดหน้าใหม่";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadPresets(supabase: Supabase): Promise<TitlePreset[] | null> {
  const { data, error } = await supabase
    .from("task_title_presets")
    .select("id, name, sort_order")
    .order("sort_order")
    .order("name");
  if (error) return null;
  return data.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sort_order }));
}

function done(): PresetActionResult {
  refresh();
  return { ok: true };
}

export async function createPreset(rawName: string): Promise<PresetActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const presets = await loadPresets(supabase);
  if (!presets) return { ok: false, error: FAILED };

  const name = normalizePresetName(rawName);
  const invalid = validatePresetName(name, presets);
  if (invalid) return { ok: false, error: invalid };

  const sortOrder = Math.max(0, ...presets.map((p) => p.sortOrder)) + 1;
  const { error } = await supabase.from("task_title_presets").insert({ name, sort_order: sortOrder });
  if (error) return { ok: false, error: error.code === "23505" ? DUPLICATE_PRESET : FAILED };
  return done();
}

export async function renamePreset(id: string, rawName: string): Promise<PresetActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const presets = await loadPresets(supabase);
  if (!presets) return { ok: false, error: FAILED };
  if (!presets.some((p) => p.id === id)) return { ok: false, error: NOT_FOUND };

  const name = normalizePresetName(rawName);
  const invalid = validatePresetName(
    name,
    presets.filter((p) => p.id !== id),
  );
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from("task_title_presets").update({ name }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? DUPLICATE_PRESET : FAILED };
  return done();
}

export async function deletePreset(id: string): Promise<PresetActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_title_presets").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: FAILED };
  if (data.length !== 1) return { ok: false, error: NOT_FOUND };
  return done();
}

/** Moves one preset up (-1) or down (+1) by renumbering the whole list. */
export async function movePreset(id: string, direction: -1 | 1): Promise<PresetActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const presets = await loadPresets(supabase);
  if (!presets) return { ok: false, error: FAILED };

  const from = presets.findIndex((p) => p.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= presets.length) return { ok: false, error: NOT_FOUND };
  const ordered = [...presets];
  [ordered[from], ordered[to]] = [ordered[to]!, ordered[from]!];

  const changed = ordered
    .map((p, i) => ({ id: p.id, sortOrder: i + 1, before: p.sortOrder }))
    .filter((p) => p.sortOrder !== p.before);
  for (const p of changed) {
    const { error } = await supabase.from("task_title_presets").update({ sort_order: p.sortOrder }).eq("id", p.id);
    if (error) return { ok: false, error: FAILED };
  }
  return done();
}
