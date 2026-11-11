import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

type Phase = "authorize" | "rate_limit" | "store" | "serialize";
type Span = { duration: number; count: number };
const contexts = new AsyncLocalStorage<Map<Phase, Span>>();
const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);

function disposable(request: Request): boolean {
  try {
    const app = new URL(request.url);
    const database = new URL(process.env.SUPABASE_DATABASE_URL ?? "");
    // Reject connection-string overrides (host, service, options, etc.).
    return loopback(app.hostname) && ["postgres:", "postgresql:"].includes(database.protocol) && loopback(database.hostname) && /^\/[a-zA-Z0-9_-]+_test$/.test(database.pathname) && !database.search && !database.hash;
  } catch { return false; }
}
function record(phase: Phase, start: number) {
  const spans = contexts.getStore();
  if (!spans) return;
  const span = spans.get(phase) ?? { duration: 0, count: 0 };
  span.duration += performance.now() - start; span.count += 1; spans.set(phase, span);
}
/** Inclusive durations; nested/overlapping spans must not be subtracted as SQL time. */
export async function measureGroupPhase<T>(phase: Phase, work: () => Promise<T>): Promise<T> {
  if (!contexts.getStore()) return work();
  const start = performance.now();
  try { return await work(); } finally { record(phase, start); }
}
export function measureGroupPhaseSync<T>(phase: Phase, work: () => T): T {
  if (!contexts.getStore()) return work();
  const start = performance.now();
  try { return work(); } finally { record(phase, start); }
}
export async function withGroupPerformance(request: Request, work: () => Promise<Response>): Promise<Response> {
  if (process.env.MDEZ_PERFORMANCE !== "1") return work();
  if (!disposable(request)) return Response.json({ error: "Disposable performance configuration required" }, { status: 503, headers: { "cache-control": "no-store" } });
  const spans = new Map<Phase, Span>();
  return contexts.run(spans, async () => {
    const start = performance.now(); const response = await work();
    const entries = [`total;dur=${(performance.now() - start).toFixed(3)};desc="1"`];
    for (const phase of ["authorize", "rate_limit", "store", "serialize"] as const) {
      const span = spans.get(phase);
      if (span) entries.push(`${phase};dur=${span.duration.toFixed(3)};desc="${span.count}"`);
    }
    response.headers.set("server-timing", entries.join(", "));
    response.headers.set("x-mdez-performance", "disposable");
    response.headers.set("x-mdez-performance-runtime", process.env.NODE_ENV === "production" ? "production" : "development");
    response.headers.set("x-mdez-request-id", randomUUID());
    return response;
  });
}
