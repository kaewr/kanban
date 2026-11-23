"use client";

import dynamic from "next/dynamic";
import type { BoardData, BoardOwner } from "@/lib/board/load";
import type { TodayNotice } from "@/lib/leave/today";
import { BoardStoreProvider } from "@/stores/board-store-provider";
import { BoardToolbar } from "./board-toolbar";
import { BoardView } from "./board-view";
import { ForeignBoardBanner } from "./foreign-board-banner";
import { TodayBanner } from "./today-banner";
import { UnsavedGuard } from "./unsaved-guard";

// Reads localStorage once at mount, so it must not render on the server.
const BoardDraft = dynamic(() => import("./board-draft").then((m) => m.BoardDraft), { ssr: false });

export function Board({
  ownerId,
  data,
  viewer,
  owner,
  owners,
  todayNotice,
}: {
  ownerId: string;
  data: BoardData;
  viewer: { id: string; username: string };
  owner: BoardOwner;
  /** Accounts an admin can switch to (FR-11); empty for normal users. */
  owners: BoardOwner[];
  todayNotice: TodayNotice;
}) {
  const isForeign = owner.id !== viewer.id;
  // Links keep pointing at this board: no ?user= for the viewer's own board.
  const ownerParam = isForeign ? owner.username : undefined;

  return (
    <BoardStoreProvider init={{ ownerId, year: data.year, tasks: data.tasks }}>
      <UnsavedGuard>
        <div className="flex flex-col gap-4">
          {isForeign && <ForeignBoardBanner owner={owner} year={data.year} />}
          <TodayBanner notice={todayNotice} ownerName={isForeign ? owner.displayName : null} />
          <BoardToolbar
            year={data.year}
            years={data.years}
            yearType={data.yearType}
            ownerParam={ownerParam}
            owners={owners}
            viewer={viewer}
            ownerId={owner.id}
          />
          <BoardView categories={data.categories} years={data.years} titlePresets={data.titlePresets} />
        </div>
        <BoardDraft ownerId={ownerId} year={data.year} />
      </UnsavedGuard>
    </BoardStoreProvider>
  );
}
