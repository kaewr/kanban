"use client";

import { useCallback, useSyncExternalStore } from "react";

// BR-50: per-browser preference for compact cards. Not saved to the database.
const KEY = "kanban:card-density";
const EVENT = "kanban:card-density";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "compact";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** [compact, setCompact]. The server and first paint use normal cards. */
export function useCardDensity(): [boolean, (compact: boolean) => void] {
  const compact = useSyncExternalStore(subscribe, read, () => false);
  const setCompact = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.setItem(KEY, "compact");
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage blocked: the choice simply is not remembered.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [compact, setCompact];
}
