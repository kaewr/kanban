"use server";

import { refresh } from "next/cache";
import {
  canDeactivate,
  DUPLICATE_CATEGORY,
  LAST_ACTIVE_CATEGORY,
  moveCategory as moveInList,
  normalizeCategoryName,
  validateCategoryName,
  type CategoryRow,
} from "@/lib/admin/categories";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// FR-18. Writes use the admin's own session; RLS (categories_*_admin) enforces the role.

export type CategoryActionResult = { ok: true } | { ok: false; error: string };

const FAILED = "บันทึกหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
const NOT_FOUND = "ไม่พบหมวดหมู่นี้ อาจถูกแก้ไขจากที่อื่น กรุณาโหลดหน้าใหม่";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadCategories(supabase: Supabase): Promise<CategoryRow[] | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order, is_active")
    .order("sort_order")
    .order("name");
  if (error) return null;
  return data.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order, isActive: c.is_active }));
}

function done(): CategoryActionResult {
  refresh();
  return { ok: true };
}

export async function createCategory(rawName: string): Promise<CategoryActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const categories = await loadCategories(supabase);
  if (!categories) return { ok: false, error: FAILED };

  const name = normalizeCategoryName(rawName);
  const invalid = validateCategoryName(name, categories);
  if (invalid) return { ok: false, error: invalid };

  const sortOrder = Math.max(0, ...categories.map((c) => c.sortOrder)) + 1;
  const { error } = await supabase.from("categories").insert({ name, sort_order: sortOrder });
  if (error) return { ok: false, error: error.code === "23505" ? DUPLICATE_CATEGORY : FAILED };
  return done();
}

export async function renameCategory(id: string, rawName: string): Promise<CategoryActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const categories = await loadCategories(supabase);
  if (!categories) return { ok: false, error: FAILED };
  if (!categories.some((c) => c.id === id)) return { ok: false, error: NOT_FOUND };

  const name = normalizeCategoryName(rawName);
  const invalid = validateCategoryName(
    name,
    categories.filter((c) => c.id !== id),
  );
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? DUPLICATE_CATEGORY : FAILED };
  return done();
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<CategoryActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const categories = await loadCategories(supabase);
  if (!categories) return { ok: false, error: FAILED };
  if (!categories.some((c) => c.id === id)) return { ok: false, error: NOT_FOUND };
  if (!isActive && !canDeactivate(categories, id)) return { ok: false, error: LAST_ACTIVE_CATEGORY };

  const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: FAILED };
  return done();
}

export async function moveCategory(id: string, direction: -1 | 1): Promise<CategoryActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const categories = await loadCategories(supabase);
  if (!categories) return { ok: false, error: FAILED };

  const ids = moveInList(categories, id, direction === -1 ? -1 : 1);
  if (!ids) return { ok: false, error: NOT_FOUND };

  const { error } = await supabase.rpc("reorder_categories", { p_ids: ids });
  if (error) return { ok: false, error: FAILED };
  return done();
}
