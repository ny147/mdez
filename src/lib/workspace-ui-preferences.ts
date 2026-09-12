import { UNSORTED_COLLECTION_ID } from "@/lib/library-tree";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
const key = (workspaceId: string) => `mdez-library-expanded:${workspaceId}`;
const modeKey = (workspaceId: string) => `mdez-last-content-mode:${workspaceId}`;

function availableStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function loadExpandedCollection(workspaceId: string, validBookIds: ReadonlySet<string>, storage?: StorageLike): string | null {
  try {
    const value = availableStorage(storage)?.getItem(key(workspaceId)) ?? null;
    return value === UNSORTED_COLLECTION_ID || (value !== null && validBookIds.has(value)) ? value : null;
  } catch {
    return null;
  }
}

export function saveExpandedCollection(workspaceId: string, collectionId: string | null, storage?: StorageLike) {
  try { availableStorage(storage)?.setItem(key(workspaceId), collectionId ?? ""); } catch { /* Navigation remains available in memory. */ }
}

export type LastContentMode = "editor" | "preview" | "split";

export function loadLastContentMode(workspaceId: string, storage?: StorageLike): LastContentMode {
  try {
    const value = availableStorage(storage)?.getItem(modeKey(workspaceId));
    return value === "preview" || value === "split" || value === "editor" ? value : "editor";
  } catch { return "editor"; }
}

export function saveLastContentMode(workspaceId: string, mode: LastContentMode, storage?: StorageLike) {
  try { availableStorage(storage)?.setItem(modeKey(workspaceId), mode); } catch { /* Keep the in-memory mode. */ }
}
