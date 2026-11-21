"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createBoardStore, type BoardInit, type BoardStore, type BoardStoreApi } from "./board-store";

const BoardStoreContext = createContext<BoardStoreApi | null>(null);

/** Creates one store per mount. Re-mount (e.g. key={year}) to load another board. */
export function BoardStoreProvider({ init, children }: { init: BoardInit; children: ReactNode }) {
  const [store] = useState(() => createBoardStore(init));
  return <BoardStoreContext.Provider value={store}>{children}</BoardStoreContext.Provider>;
}

export function useBoardStore<T>(selector: (state: BoardStore) => T): T {
  const store = useContext(BoardStoreContext);
  if (!store) throw new Error("useBoardStore must be used inside BoardStoreProvider");
  return useStore(store, selector);
}
