// FR-10: unsaved board changes parked in localStorage, offered back on the next visit.
// Storage may be unavailable (private mode, blocked site data): every access is guarded.
import type { BoardTask } from "./types";

const PREFIX = "kanban:draft:";
const FORMAT_VERSION = 1;

export type BoardDraft = { savedAt: string; tasks: BoardTask[] };

type StoredDraft = BoardDraft & { v: number };

export function draftKey(ownerId: string, year: number): string {
  return `${PREFIX}${ownerId}:${year}`;
}

function isBoardTaskLike(value: unknown): value is BoardTask {
  if (value === null || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.status === "string" &&
    typeof t.position === "number" &&
    typeof t.version === "number" &&
    Array.isArray(t.moves)
  );
}

export function loadDraft(key: string): BoardDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (parsed.v !== FORMAT_VERSION || typeof parsed.savedAt !== "string" || !Array.isArray(parsed.tasks)) {
      return null;
    }
    // Drafts saved by an older version may lack newer fields: fill them with "none".
    const tasks = parsed.tasks
      .filter(isBoardTaskLike)
      .map((t) => ({ ...t, reviewerId: t.reviewerId ?? null, durationMinutes: t.durationMinutes ?? null }));
    return tasks.length > 0 ? { savedAt: parsed.savedAt, tasks } : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, tasks: readonly BoardTask[]): void {
  try {
    const value: StoredDraft = { v: FORMAT_VERSION, savedAt: new Date().toISOString(), tasks: [...tasks] };
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or blocked storage: drafts are a convenience, ignore.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** On logout: remove every board draft in this browser (shared computers). */
export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
