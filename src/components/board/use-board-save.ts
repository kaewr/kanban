"use client";

import { useState } from "react";
import { changedTasks } from "@/lib/board/changes";
import { toBoardTask } from "@/lib/board/mapping";
import { buildSavePayload, parseSaveResult, type SaveConflict } from "@/lib/board/save";
import { createClient } from "@/lib/supabase/client";
import { useBoardStoreApi } from "@/stores/board-store-provider";
import type { Json } from "@/types/database";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** FR-09: one save_board_changes call for every unsaved change. */
export function useBoardSave() {
  const store = useBoardStoreApi();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [conflicts, setConflicts] = useState<SaveConflict[] | null>(null);
  const [reloading, setReloading] = useState(false);

  async function save() {
    const { tasks, snapshot, applySaved } = store.getState();
    const changed = changedTasks(tasks, snapshot);
    if (changed.length === 0 || status === "saving") return;

    setStatus("saving");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("save_board_changes", {
      p_changes: buildSavePayload(changed) as unknown as Json,
    });
    if (error) {
      setStatus("error");
      return;
    }

    try {
      const result = parseSaveResult(data);
      if (result.ok) {
        applySaved(result.tasks, changed);
        setStatus("saved");
      } else {
        setConflicts(result.conflicts);
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  /** Conflict resolution: take the database version of the conflicting tasks only. */
  async function reloadConflicts() {
    if (!conflicts) return;
    setReloading(true);
    const ids = conflicts.map((c) => c.id);
    const { data, error } = await createClient().from("tasks").select("*").in("id", ids);
    setReloading(false);
    if (error) {
      setStatus("error");
      return;
    }
    store.getState().reloadTasks(ids, data.map(toBoardTask));
    setConflicts(null);
  }

  return {
    status,
    save,
    conflicts,
    reloading,
    reloadConflicts,
    dismissConflicts: () => setConflicts(null),
  };
}
