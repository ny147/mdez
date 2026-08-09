"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGroupChanges, getGroupSnapshot } from "@/lib/key-group-client";
import type { GroupChangesResult, GroupSnapshot } from "@/types/key-group";

export type GroupRefreshOptions = { groupId: string; key: string; revision: number; hasUnsavedDraft: boolean; hasConflict?: boolean; onChanges: (result: Extract<GroupChangesResult, { status: "changes" }>) => Promise<void> | void; onReset: (snapshot: GroupSnapshot) => Promise<void> | void };

export function useGroupRefresh(options: GroupRefreshOptions): { refresh: () => Promise<void>; refreshing: boolean } {
  const optionsRef = useRef(options); optionsRef.current = options;
  const inFlight = useRef<Promise<void> | null>(null); const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      const current = optionsRef.current;
      if (!current.groupId || !current.key) return;
      setRefreshing(true);
      try {
        const result = await getGroupChanges(current.groupId, current.key, current.revision);
        if (result.status === "reset_required") await current.onReset(await getGroupSnapshot(current.groupId, current.key));
        else await current.onChanges(result);
      } finally { setRefreshing(false); }
    })();
    inFlight.current = run.finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, []);

  useEffect(() => {
    const automatic = () => { const current = optionsRef.current; if (current.hasUnsavedDraft || current.hasConflict || document.visibilityState === "hidden") return; void refresh().catch(() => undefined); };
    const interval = window.setInterval(automatic, 30_000); window.addEventListener("focus", automatic);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", automatic); };
  }, [refresh]);
  return { refresh, refreshing };
}
