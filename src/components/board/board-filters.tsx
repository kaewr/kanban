"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PRIORITY_LABEL } from "@/lib/board/constants";
import { EMPTY_FILTER, isFilterActive, type BoardFilter } from "@/lib/board/filter";
import type { BoardCategory } from "@/lib/board/types";
import type { TaskPriority } from "@/types/domain";

/** FR-14: search and filters. Kept in memory only; cleared on reload. */
export function BoardFilters({
  filter,
  onChange,
  categories,
  shown,
  total,
}: {
  filter: BoardFilter;
  onChange: (next: BoardFilter) => void;
  categories: BoardCategory[];
  shown: number;
  total: number;
}) {
  const active = isFilterActive(filter);

  return (
    <div role="search" aria-label="ค้นหาและกรองงาน" className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="ค้นหางาน"
          placeholder="ค้นหาชื่องานหรือรายละเอียด"
          className="pl-8"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
        />
      </div>

      <NativeSelect
        aria-label="กรองตามหมวดหมู่"
        className="w-auto"
        value={filter.categoryId}
        onChange={(e) => onChange({ ...filter, categoryId: e.target.value })}
      >
        <option value="">ทุกหมวดหมู่</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.isActive ? "" : " (ปิดใช้งาน)"}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="กรองตามความสำคัญ"
        className="w-auto"
        value={filter.priority}
        onChange={(e) => onChange({ ...filter, priority: Number(e.target.value) as TaskPriority | 0 })}
      >
        <option value={0}>ทุกความสำคัญ</option>
        {([1, 2, 3] as const).map((p) => (
          <option key={p} value={p}>
            ความสำคัญ{PRIORITY_LABEL[p]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="กรองตามวันกำหนดเสร็จ"
        className="w-auto"
        value={filter.due}
        onChange={(e) => onChange({ ...filter, due: e.target.value as BoardFilter["due"] })}
      >
        <option value="all">ทุกกำหนดเสร็จ</option>
        <option value="overdue">เกินกำหนด</option>
        <option value="soon">ใกล้ครบกำหนด (3 วัน)</option>
      </NativeSelect>

      {active && (
        <>
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="filter-count" role="status">
            แสดง {shown} จาก {total} งาน
          </span>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => onChange(EMPTY_FILTER)}>
            <XIcon aria-hidden />
            ล้างตัวกรอง
          </Button>
        </>
      )}
    </div>
  );
}
