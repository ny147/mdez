import "server-only";

import { getDatabase } from "@/server/database";
import {
  consumeRateLimit,
  purgeExpiredRateLimitBuckets
} from "@/server/rate-limit";
import type { CreateQuickShareResult, QuickSharePayload } from "@/types/quick-share";
import { PostgresQuickShareStore } from "./postgres-store";
import {
  createQuickShareService,
  deleteQuickShareService,
  purgeExpiredQuickShares,
  readQuickShareService
} from "./service";

export class QuickShareRateLimitError extends Error {
  readonly code = "RATE_LIMITED";

  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests");
  }
}

function store() {
  return new PostgresQuickShareStore(getDatabase());
}

async function enforceRateLimit(rule: {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  const decision = await consumeRateLimit(rule);
  if (!decision.allowed) throw new QuickShareRateLimitError(decision.retryAfterSeconds);
}

export async function createShare(
  input: unknown,
  context: { origin: string; address: string }
): Promise<CreateQuickShareResult> {
  await enforceRateLimit({
    scope: "quick-share:create",
    identifier: context.address,
    limit: 20,
    windowSeconds: 60 * 60
  });
  return createQuickShareService(input, {
    store: store(),
    now: () => new Date(),
    origin: context.origin
  });
}

export async function readShare(publicId: string, address: string): Promise<QuickSharePayload> {
  await enforceRateLimit({
    scope: "quick-share:read",
    identifier: `${publicId}:${address}`,
    limit: 120,
    windowSeconds: 60
  });
  return readQuickShareService(publicId, { store: store(), now: () => new Date() });
}

export function deleteShare(publicId: string, token: string): Promise<void> {
  return deleteQuickShareService(publicId, token, { store: store() });
}

export async function purgeShares(): Promise<{ shares: number; buckets: number }> {
  const now = new Date();
  const [shares, buckets] = await Promise.all([
    purgeExpiredQuickShares(now, store()),
    purgeExpiredRateLimitBuckets(now)
  ]);
  return { shares, buckets };
}
