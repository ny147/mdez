import "server-only";

import { validateLocalGroupCreation } from "@/lib/key-group";
import { consumeRateLimit } from "@/server/rate-limit";
import type { GroupSnapshot } from "@/types/key-group";
import { authorizeGroupKey, type AuthorizeGroupDeps } from "./authorize";
import { digestGroupKey } from "./secrets";
import { KeyGroupError } from "./store";

type ServiceDeps = AuthorizeGroupDeps & { groupId?: string };

export async function createGroupService(input: unknown, deps: ServiceDeps): Promise<GroupSnapshot> {
  const valid = validateLocalGroupCreation(input);
  const decision = await (deps.consumeRateLimit ?? consumeRateLimit)({
    scope: "key-group-create",
    identifier: deps.address,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!decision.allowed) {
    throw new KeyGroupError("LIMIT_EXCEEDED", "Too many groups created", undefined, decision.retryAfterSeconds);
  }
  return deps.store.createGroup(valid.import, digestGroupKey(valid.key));
}

export async function getGroupSnapshotService(key: string, deps: ServiceDeps): Promise<GroupSnapshot> {
  const groupId = await authorizeGroupKey(key, deps, deps.groupId);
  const snapshot = await deps.store.getSnapshot(groupId);
  if (!snapshot) throw new KeyGroupError("INVALID_KEY", "Group key is invalid");
  return snapshot;
}

export function joinGroupService(key: string, deps: ServiceDeps): Promise<GroupSnapshot> {
  return getGroupSnapshotService(key, deps);
}
