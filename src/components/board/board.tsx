"use client";

import type { BoardData } from "@/lib/board/load";
import { BoardStoreProvider } from "@/stores/board-store-provider";
import { BoardToolbar } from "./board-toolbar";
import { BoardView } from "./board-view";

export function Board({ ownerId, data }: { ownerId: string; data: BoardData }) {
  return (
    <BoardStoreProvider init={{ ownerId, year: data.year, tasks: data.tasks }}>
      <div className="flex flex-col gap-4">
        <BoardToolbar year={data.year} years={data.years} yearType={data.yearType} />
        <BoardView categories={data.categories} years={data.years} />
      </div>
    </BoardStoreProvider>
  );
}
