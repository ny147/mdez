import { db, type CachedGroupState, type RememberedGroup } from "@/lib/db";
import type { GroupSnapshot } from "@/types/key-group";

export function rememberGroup(group: RememberedGroup): Promise<string> {
  return db.rememberedGroups.put(group);
}

export function loadRememberedGroups(): Promise<RememberedGroup[]> {
  return db.rememberedGroups.orderBy("lastOpenedAt").reverse().toArray();
}

export async function loadRememberedGroup(groupId: string): Promise<RememberedGroup | null> {
  return (await db.rememberedGroups.get(groupId)) ?? null;
}

export async function cacheGroupSnapshot(snapshot: GroupSnapshot, cachedAt = new Date().toISOString()): Promise<string> {
  return db.cachedGroups.put({ groupId: snapshot.group.id, revision: snapshot.group.revision, snapshot, cachedAt });
}

export async function loadCachedGroup(groupId: string): Promise<CachedGroupState | null> {
  return (await db.cachedGroups.get(groupId)) ?? null;
}

export async function forgetGroup(groupId: string): Promise<void> {
  await db.transaction("rw", db.rememberedGroups, db.cachedGroups, async () => {
    await db.rememberedGroups.delete(groupId);
    await db.cachedGroups.delete(groupId);
  });
}
