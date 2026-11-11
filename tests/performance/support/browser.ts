import { expect, type Page, type Request } from "@playwright/test";
import type { GroupSnapshot } from "../../../src/types/key-group";
import { fixtureImport } from "./fixtures";
import type { RequestSample } from "./metrics";
import { attributeRequest, parseServerTiming, requestSample } from "./requests";

export async function collectRequests(page: Page) {
  const origin = await page.evaluate(() => performance.timeOrigin);
  let context: RequestSample["initiator"] = "unknown";
  const inFlight = new Map<Request, RequestSample>();
  let completed: RequestSample[] = [];
  const pending = new Set<Promise<void>>();
  const onRequest = (request: Request) => {
    if (!new URL(request.url()).pathname.startsWith("/api/key-groups")) return;
    const sample = requestSample({ method: request.method(), url: request.url(), startMs: Math.max(0, request.timing().startTime - origin) });
    sample.initiator = attributeRequest(sample.method, sample.route, context);
    inFlight.set(request, sample);
  };
  const finish = async (request: Request, failed: boolean) => {
    const sample = inFlight.get(request);
    if (!sample) return;
    inFlight.delete(request);
    const timing = request.timing();
    sample.endMs = timing.responseEnd >= 0 ? sample.startMs + timing.responseEnd : null;
    if (!failed) {
      const response = await request.response();
      sample.status = response?.status() ?? null;
      sample.serverTiming = parseServerTiming(await response?.headerValue("server-timing") ?? "");
      const id = await response?.headerValue("x-mdez-request-id");
      sample.requestId = id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
      const sizes = await request.sizes().catch(() => null);
      if (sizes) {
        sample.requestBytes = sizes.requestBodySize;
        sample.responseBytes = sizes.responseBodySize;
        sample.transferBytes = sizes.responseBodySize + sizes.responseHeadersSize;
      }
      sample.decodedResponseBytes = await page.evaluate((url) => {
        const entry = performance.getEntriesByName(url).at(-1) as PerformanceResourceTiming | undefined;
        return entry && entry.responseEnd > 0 ? entry.decodedBodySize : null;
      }, request.url()).catch(() => null);
    }
    completed.push(sample);
  };
  const track = (request: Request, failed: boolean) => {
    const promise = finish(request, failed).finally(() => pending.delete(promise));
    pending.add(promise);
  };
  const onFinished = (request: Request) => track(request, false);
  const onFailed = (request: Request) => track(request, true);
  page.on("request", onRequest); page.on("requestfinished", onFinished); page.on("requestfailed", onFailed);
  return {
    setContext(value: RequestSample["initiator"]) { context = value; },
    async flush() { await Promise.all([...pending]); },
    drain(): RequestSample[] { const result = [...completed, ...inFlight.values()]; completed = []; inFlight.clear(); return result; },
    dispose() { page.off("request", onRequest); page.off("requestfinished", onFinished); page.off("requestfailed", onFailed); inFlight.clear(); completed = []; },
  };
}

export class MeasurementFailure extends Error {
  constructor(readonly requests: RequestSample[]) { super("Action or request contract failed"); }
}

export async function measureAction(page: Page, context: { action: string; initiator: RequestSample["initiator"] }, perform: () => Promise<void>, assertResult: () => Promise<void>): Promise<{ paintMs: number; requests: RequestSample[]; confirmedMs: number | null; feedbackMs: number | null }> {
  const collector = await collectRequests(page);
  collector.setContext(context.initiator);
  await page.evaluate(() => {
    const state = window as typeof window & { __mdezInput?: number; __mdezFeedback?: number };
    delete state.__mdezInput;
    delete state.__mdezFeedback;
    const observer = new MutationObserver(() => {
      if (state.__mdezInput === undefined || state.__mdezFeedback !== undefined) return;
      if ([...document.querySelectorAll('[role="status"]')].some((element) => /^(Creating page|Deleting page|Renaming book|Deleting book|Saving changes)\.\.\.$/.test(element.textContent ?? ""))) state.__mdezFeedback = performance.now();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    const mark = () => { state.__mdezInput ??= performance.now(); };
    document.addEventListener("click", mark, { capture: true, once: true });
    document.addEventListener("input", mark, { capture: true, once: true });
    document.addEventListener("keydown", mark, { capture: true, once: true });
    (window as typeof window & { __mdezCleanup?: () => void }).__mdezCleanup = () => {
      document.removeEventListener("click", mark, true); document.removeEventListener("input", mark, true);
      document.removeEventListener("keydown", mark, true);
      observer.disconnect();
    };
  });
  try {
    await perform(); await assertResult();
    const frame = await page.evaluate(() => new Promise<{ start: number; end: number; feedback: number | null }>((resolve, reject) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const start = (window as typeof window & { __mdezInput?: number }).__mdezInput;
        if (start === undefined) { reject(new Error("No accepted input event")); return; }
        const feedback = (window as typeof window & { __mdezFeedback?: number }).__mdezFeedback;
        resolve({ start, end: performance.now(), feedback: feedback === undefined ? null : feedback - start });
      }));
    }));
    await collector.flush();
    const requests = collector.drain();
    const mutations = requests.filter((item) => item.initiator === "mutation" && item.endMs !== null);
    return { paintMs: frame.end - frame.start, requests, feedbackMs: frame.feedback, confirmedMs: mutations.length ? Math.max(0, Math.max(...mutations.map((item) => item.endMs!)) - frame.start) : null };
  } catch {
    await collector.flush();
    throw new MeasurementFailure(collector.drain());
  } finally {
    collector.dispose();
    await page.evaluate(() => (window as typeof window & { __mdezCleanup?: () => void }).__mdezCleanup?.()).catch(() => {});
  }
}

export async function seedLibrary(page: Page, snapshot: GroupSnapshot, kind: "local" | "group"): Promise<void> {
  await page.goto("/");
  await openShelf(page);
  await expect(page.getByRole("button", { name: /Current workspace:/ })).toBeAttached();
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((database) => database.name === "mdez" && (database.version ?? 0) >= 60))).toBe(true);
  await page.goto("/icon.svg");
  const mode = process.env.PERF_MODE ?? "mock";
  await page.evaluate(async ({ snapshot, kind, mode, imported }) => {
    let key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
    if (kind === "group" && mode === "server") {
      const check = await fetch("/api/key-groups/performance-preflight", { cache: "no-store" });
      if (check.headers.get("x-mdez-performance") !== "disposable" || check.headers.get("x-mdez-performance-runtime") !== "production") throw new Error("Disposable production database preflight failed; no fixtures created");
      key = `mdez-group-${btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
      const response = await fetch("/api/key-groups", { method: "POST", headers: { "content-type": "application/json", "x-mdez-group-key": key }, body: JSON.stringify(imported) });
      if (!response.ok) throw new Error(`Fixture creation failed (${response.status})`);
      snapshot = await response.json();
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("mdez"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error("Fixture database unavailable")); });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(["folders", "documents", "rememberedGroups", "cachedGroups", "workspaceResume", "pageBookmarks"], "readwrite");
      for (const name of ["folders", "documents", "rememberedGroups", "cachedGroups", "workspaceResume", "pageBookmarks"]) tx.objectStore(name).clear();
      if (kind === "local") {
        snapshot.folders.forEach((item) => tx.objectStore("folders").put(item));
        snapshot.documents.forEach((item) => tx.objectStore("documents").put(item));
      } else {
        tx.objectStore("rememberedGroups").put({ groupId: snapshot.group.id, name: snapshot.group.name, key, joinedAt: snapshot.group.createdAt, lastOpenedAt: snapshot.group.updatedAt });
        tx.objectStore("cachedGroups").put({ groupId: snapshot.group.id, revision: snapshot.group.revision, snapshot, cachedAt: snapshot.group.updatedAt });
      }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error("Fixture seed failed"));
    });
    database.close(); localStorage.clear();
  }, { snapshot, kind, mode, imported: fixtureImport(snapshot) });
  await page.goto("/");
}

export async function openShelf(page: Page) {
  const button = page.getByRole("button", { name: "Open library shelf" });
  if (await button.isVisible() && await button.getAttribute("aria-expanded") === "false") {
    await button.click(); await expect(button).toHaveAttribute("aria-expanded", "true");
  }
}
export async function closeShelf(page: Page) {
  const button = page.getByRole("button", { name: "Open library shelf" });
  if (await button.isVisible() && await button.getAttribute("aria-expanded") === "true") {
    await page.keyboard.press("Escape"); await expect(button).toHaveAttribute("aria-expanded", "false");
  }
}
export async function visibleTab(page: Page, name: string) {
  const tabs = page.getByRole("tab", { name, exact: true });
  for (const tab of await tabs.all()) if (await tab.isVisible()) { await tab.click(); return; }
  throw new Error("Visible workspace tab unavailable");
}
export async function selectGroup(page: Page) {
  await openShelf(page);
  await page.getByRole("button", { name: /Current workspace:/ }).click();
  await page.getByRole("button", { name: "Performance library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Current workspace: Performance library" })).toBeVisible();
  await closeShelf(page);
}
