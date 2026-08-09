import "server-only";
import { createHmac } from "node:crypto";

import { getDatabase } from "@/server/database";

export type RateLimitRule = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function bucketKey(rule: RateLimitRule): Buffer {
  const pepper = process.env.RATE_LIMIT_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new Error("RATE_LIMIT_PEPPER must contain at least 32 bytes");
  }
  return createHmac("sha256", pepper)
    .update(`${rule.scope}:${rule.identifier}`, "utf8")
    .digest();
}

export async function consumeRateLimit(
  rule: RateLimitRule,
  now = new Date()
): Promise<RateLimitDecision> {
  const sql = getDatabase();
  const key = bucketKey(rule);
  const nextExpiry = new Date(now.getTime() + rule.windowSeconds * 1000);
  const rows = await sql<{ request_count: number; expires_at: Date }[]>`
    insert into public.rate_limit_buckets (
      bucket_key,
      request_count,
      window_started_at,
      expires_at
    ) values (${key}, 1, ${now}, ${nextExpiry})
    on conflict (bucket_key) do update set
      request_count = case
        when public.rate_limit_buckets.expires_at <= ${now} then 1
        else public.rate_limit_buckets.request_count + 1
      end,
      window_started_at = case
        when public.rate_limit_buckets.expires_at <= ${now} then ${now}
        else public.rate_limit_buckets.window_started_at
      end,
      expires_at = case
        when public.rate_limit_buckets.expires_at <= ${now} then ${nextExpiry}
        else public.rate_limit_buckets.expires_at
      end
    returning request_count, expires_at
  `;
  const count = rows[0].request_count;
  const expiresAt = rows[0].expires_at;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000))
  };
}

export async function purgeExpiredRateLimitBuckets(now = new Date()): Promise<number> {
  const sql = getDatabase();
  const deleted = await sql`
    delete from public.rate_limit_buckets
    where expires_at <= ${now}
  `;
  return deleted.count;
}
