"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_NAME_MAX, canDeactivate, type CategoryRow } from "@/lib/admin/categories";
import {
  createCategory,
  moveCategory,
  setCategoryActive,
  type CategoryActionResult,
} from "./actions";
import { RenameCategoryDialog } from "./rename-category-dialog";

/** FR-18: add, rename, reorder and turn categories on/off. */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<CategoryActionResult>, onSuccess?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onSuccess?.();
      else setError(result.error);
    });
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () => createCategory(newName),
      () => setNewName(""),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="new-category">เพิ่มหมวดหมู่</Label>
          <Input
            id="new-category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={CATEGORY_NAME_MAX}
            placeholder="ชื่อหมวดหมู่ใหม่"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          เพิ่ม
        </Button>
      </form>

      <FormMessage error={error} />

      <ol className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10" aria-busy={pending}>
        {categories.map((category, index) => (
          <li
            key={category.id}
            data-category={category.name}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
          >
            <span className={`flex-1 font-medium ${category.isActive ? "" : "text-muted-foreground line-through"}`}>
              {category.name}
            </span>
            {!category.isActive && <Badge variant="outline">ปิดใช้งาน</Badge>}

            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`เลื่อน ${category.name} ขึ้น`}
                disabled={pending || index === 0}
                onClick={() => run(() => moveCategory(category.id, -1))}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`เลื่อน ${category.name} ลง`}
                disabled={pending || index === categories.length - 1}
                onClick={() => run(() => moveCategory(category.id, 1))}
              >
                ↓
              </Button>
              <RenameCategoryDialog category={category} disabled={pending} />
              {category.isActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`ปิดใช้งาน ${category.name}`}
                  disabled={pending || !canDeactivate(categories, category.id)}
                  title={canDeactivate(categories, category.id) ? undefined : "ต้องมีหมวดหมู่ที่ใช้งานอย่างน้อย 1 หมวด"}
                  onClick={() => run(() => setCategoryActive(category.id, false))}
                >
                  ปิดใช้งาน
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`เปิดใช้งาน ${category.name}`}
                  disabled={pending}
                  onClick={() => run(() => setCategoryActive(category.id, true))}
                >
                  เปิดใช้งาน
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
