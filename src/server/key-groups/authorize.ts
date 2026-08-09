import "server-only";

import { isValidGroupKey } from "@/lib/key-group";
import { consumeRateLimit, type RateLimitDecision, type RateLimitRule } from "@/server/rate-limit";
import { digestGroupKey } from "./secrets";
import { KeyGroupError, type KeyGroupStore } from "./store";

export type GroupRateLimitConsumer = (rule: RateLimitRule) => Promise<RateLimitDecision>;

export type AuthorizeGroupDeps = {
  store: KeyGroupStore;
  address: string;
  consumeRateLimit?: GroupRateLimitConsumer;
};

async function rejectInvalid(deps: AuthorizeGroupDeps): Promise<never> {
  const decision = await (deps.consumeRateLimit ?? consumeRateLimit)({
    scope: "key-group-invalid-key",
    identifier: deps.address,
    limit: 20,
    windowSeconds: 60,
  });
  throw new KeyGroupError(
    "INVALID_KEY",
    "Group key is invalid",
    undefined,
    decision.allowed ? undefined : decision.retryAfterSeconds,
  );
}

export async function authorizeGroupKey(
  key: string,
  deps: AuthorizeGroupDeps,
  expectedGroupId?: string,
): Promise<string> {
  const candidate = key.trim();
  const matchedGroupId = await deps.store.findGroupIdByDigest(digestGroupKey(candidate));
  if (!isValidGroupKey(candidate) || !matchedGroupId || (expectedGroupId && matchedGroupId !== expectedGroupId)) {
    return rejectInvalid(deps);
  }
  return matchedGroupId;
}
