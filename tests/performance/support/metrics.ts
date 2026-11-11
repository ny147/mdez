import type { FixtureSize } from "./fixtures";

export const actions = ["cold-open", "cached-reopen", "switch", "dirty-switch", "create-page", "delete-active", "delete-inactive", "rename-page", "rename-book", "delete-book"] as const;
export type PerformanceAction = typeof actions[number];
export type PerformanceSample = {
  action: PerformanceAction; workspaceKind: "local" | "group"; fixture: FixtureSize;
  mode: "mock" | "server"; profile: "unthrottled" | "latency"; run: number;
  outcome: "success" | "failed"; paintMs: number | null; feedbackMs: number | null; confirmedMs: number | null;
};
export const initiators = ["navigation", "mutation", "autosave", "initial-load", "manual-refresh", "poll", "unknown"] as const;
export type RequestSample = {
  method: "GET" | "POST" | "PATCH" | "DELETE" | "OTHER";
  route: string; initiator: typeof initiators[number]; startMs: number; endMs: number | null;
  status: number | null; requestBytes: number | null; responseBytes: number | null; transferBytes: number | null;
  serverTiming: Partial<Record<"total" | "authorize" | "rate_limit" | "store" | "serialize", { duration: number; count: number }>>;
  requestId: string | null;
};
export function duration(value: number | null): number | null {
  if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error("Invalid duration");
  return value;
}
export function percentile(samples: readonly number[], quantile: 0.5 | 0.95): number | null {
  samples.forEach(duration);
  if (!samples.length) return null;
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * quantile) - 1];
}
export function serializePerformanceSample(sample: PerformanceSample): string {
  if (!actions.includes(sample.action) || !["local", "group"].includes(sample.workspaceKind) || !["small", "typical", "large", "single-page-limit"].includes(sample.fixture) || !["mock", "server"].includes(sample.mode) || !["unthrottled", "latency"].includes(sample.profile) || !["success", "failed"].includes(sample.outcome) || !Number.isSafeInteger(sample.run) || sample.run < 1) throw new Error("Invalid metric category");
  return JSON.stringify({ action: sample.action, workspaceKind: sample.workspaceKind, fixture: sample.fixture, mode: sample.mode, profile: sample.profile, run: sample.run, outcome: sample.outcome, paintMs: duration(sample.paintMs), feedbackMs: duration(sample.feedbackMs), confirmedMs: duration(sample.confirmedMs) });
}
