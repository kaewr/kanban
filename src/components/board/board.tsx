"use client";

import dynamic from "next/dynamic";
import type { BoardData } from "@/lib/board/load";
import { BoardStoreProvider } from "@/stores/board-store-provider";
import { BoardToolbar } from "./board-toolbar";
import { BoardView } from "./board-view";
import { UnsavedGuard } from "./unsaved-guard";

// Reads localStorage once at mount, so it must not render on the server.
const BoardDraft = dynamic(() => import("./board-draft").then((m) => m.BoardDraft), { ssr: false });

export function Board({ ownerId, data }: { ownerId: string; data: BoardData }) {
  return (
    <BoardStoreProvider init={{ ownerId, year: data.year, tasks: data.tasks }}>
      <UnsavedGuard>
        <div className="flex flex-col gap-4">
          <BoardToolbar year={data.year} years={data.years} yearType={data.yearType} />
          <BoardView categories={data.categories} years={data.years} />
        </div>
        <BoardDraft ownerId={ownerId} year={data.year} />
      </UnsavedGuard>
    </BoardStoreProvider>
  );
}
