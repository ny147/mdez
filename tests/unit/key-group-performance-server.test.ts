// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { measureGroupPhase, measureGroupPhaseSync, withGroupPerformance } from "@/server/key-groups/performance";
vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
const request = () => new Request("http://127.0.0.1/api/key-groups/preflight");
function enable(database = "postgres://user:password@localhost/mdez_test") { vi.stubEnv("MDEZ_PERFORMANCE", "1"); vi.stubEnv("SUPABASE_DATABASE_URL", database); }

it("leaves ordinary responses untouched when disabled", async () => {
  vi.stubEnv("MDEZ_PERFORMANCE", "0");
  const response = new Response("ok", { headers: { "cache-control": "no-store" } });
  expect(await withGroupPerformance(request(), async () => response)).toBe(response);
  expect(response.headers.get("server-timing")).toBeNull();
});
it("fails closed before running handlers for unsafe or missing database configuration", async () => {
  for (const database of ["", "postgres://localhost/prod", "postgres://remote/mdez_test", "postgres://localhost/mdez_test?host=remote", "https://localhost/mdez_test"]) {
    enable(database); const work = vi.fn(async () => new Response("unsafe"));
    const response = await withGroupPerformance(request(), work);
    expect(response.status).toBe(503); expect(work).not.toHaveBeenCalled();
    expect(response.headers.get("x-mdez-performance")).toBeNull();
  }
  enable(); const work = vi.fn(async () => new Response("unsafe"));
  expect((await withGroupPerformance(new Request("https://public.example/api/key-groups/g1"), work)).status).toBe(503);
  expect(work).not.toHaveBeenCalled();
});
it("marks even unauthenticated preflight responses and keeps cache/error contracts", async () => {
  enable();
  const response = await withGroupPerformance(request(), async () => new Response("unauthorized", { status: 401, headers: { "cache-control": "no-store" } }));
  expect(response.status).toBe(401); expect(await response.text()).toBe("unauthorized");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-mdez-performance")).toBe("disposable");
  expect(response.headers.get("x-mdez-request-id")).toMatch(/^[a-f0-9-]{36}$/);
});
it("isolates concurrent inclusive spans and propagates original errors", async () => {
  enable();
  const error = new Error("FORBIDDEN_SECRET");
  const [first, second] = await Promise.all([
    withGroupPerformance(request(), async () => {
      await measureGroupPhase("authorize", async () => {
        await measureGroupPhase("store", async () => Promise.resolve());
      });
      await expect(measureGroupPhase("store", async () => { throw error; })).rejects.toBe(error);
      return measureGroupPhaseSync("serialize", () => new Response("ok"));
    }),
    withGroupPerformance(request(), async () => new Response("other")),
  ]);
  const spans = first.headers.get("server-timing")!;
  expect(spans).toContain('store;dur='); expect(spans).toContain('desc="2"');
  expect(second.headers.get("server-timing")).not.toContain("store");
  expect(first.headers.get("x-mdez-request-id")).not.toBe(second.headers.get("x-mdez-request-id"));
  expect(JSON.stringify([...first.headers])).not.toContain("FORBIDDEN");
  const authorize = Number(spans.match(/authorize;dur=([\d.]+)/)![1]);
  expect(authorize).toBeGreaterThanOrEqual(0);
});
