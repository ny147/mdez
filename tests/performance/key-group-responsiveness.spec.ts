import { expect, test, type Page } from "@playwright/test";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildPerformanceFixture, fixtureSeed, fixtureSizes, type FixtureSize } from "./support/fixtures";
import { actions, percentile, serializePerformanceSample, type PerformanceAction, type PerformanceSample } from "./support/metrics";
import { serializeRequestSample } from "./support/requests";
import { closeShelf, measureAction, MeasurementFailure, openShelf, seedLibrary, selectGroup, visibleTab } from "./support/browser";
import { installKeyGroupApiModel, resetKeyGroupApiModel } from "../e2e/support/key-group-api-model";

const samples = Number(process.env.PERF_SAMPLES ?? 100);
const runs = Number(process.env.PERF_RUNS ?? 3);
const warmups = Number(process.env.PERF_WARMUPS ?? 5);
if (!Number.isSafeInteger(warmups) || warmups < 0) throw new Error("Nonnegative integer PERF_WARMUPS required");
if (![samples, runs].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Positive integer PERF_SAMPLES and PERF_RUNS required");
function filter<T extends string>(values: readonly T[], input?: string): T[] {
  if (!input) return [...values];
  const selected = input.split(",");
  if (selected.some((item) => !values.includes(item as T))) throw new Error("Unknown performance filter");
  return selected as T[];
}
const sizes = filter(Object.keys(fixtureSizes) as FixtureSize[], process.env.PERF_FIXTURE);
const selectedActions = filter(actions, process.env.PERF_ACTION);
const profiles = filter(["unthrottled", "latency"] as const, process.env.PERF_PROFILE);
const mode = (process.env.PERF_MODE ?? "mock") as "mock" | "server";
if (mode === "server" && (sizes.length !== 1 || selectedActions.length !== 1 || profiles.length !== 1)) throw new Error("Server runs require one fixture/action/profile per invocation to respect group creation limits");

async function targetPage(page: Page, title = "Page 0") {
  await openShelf(page);
  const expand = page.getByRole("button", { name: /^(Expand|Collapse) Unsorted pages$/ });
  await expect(expand).toBeVisible();
  if (await expand.getAttribute("aria-expanded") === "false") await expand.click();
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).first().click();
  await closeShelf(page);
}

for (const fixture of sizes) for (const profile of profiles) for (const workspaceKind of ["local", "group"] as const) {
  test(`${workspaceKind} ${fixture} ${profile}`, async ({ page, context, browser }, testInfo) => {
    if (mode === "server") {
      const preflight = await page.request.get("/api/key-groups/performance-preflight");
      expect(preflight.headers()["x-mdez-performance"]).toBe("disposable");
      expect(preflight.headers()["x-mdez-performance-runtime"]).toBe("production");
    }
    const snapshot = buildPerformanceFixture(fixture);
    let model: Awaited<ReturnType<typeof installKeyGroupApiModel>> | undefined;
    if (mode === "mock" && workspaceKind === "group") model = await installKeyGroupApiModel(context);
    // Native prompt dwell is excluded by deterministic test-only acceptance.
    await context.addInitScript(() => { window.confirm = () => true; });
    const network = profile === "latency" ? { offline: false, latency: 100, downloadThroughput: 10_000_000 / 8, uploadThroughput: 10_000_000 / 8 } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
    const session = await context.newCDPSession(page);
    await session.send("Network.enable"); await session.send("Network.emulateNetworkConditions", network);
    const records: (PerformanceSample & { viewMode: string; collection: string })[] = [];
    const timelines: { sample: number; requests: unknown[] }[] = [];
    const summaries: unknown[] = [];
    let observedRttMs: number | null = null;
    let seeded = false;
    for (const action of selectedActions) for (const contentMode of action === "switch" || action === "dirty-switch" ? ["Edit", "Read", "Split"] : ["Edit"]) for (const collection of action === "create-page" ? ["unsorted", "book"] : ["n/a"]) {
      if (snapshot.documents.length < 6 && ["switch", "dirty-switch", "delete-inactive"].includes(action)) {
        summaries.push({ action, contentMode, skipped: "Fixture has only one page" }); continue;
      }
      if (workspaceKind === "local" && ["cold-open", "cached-reopen"].includes(action)) {
        summaries.push({ action, contentMode, skipped: "Group open action" }); continue;
      }
      if (action === "delete-book" && !snapshot.documents.some((item) => item.folderId === snapshot.folders[0].id)) {
        summaries.push({ action, contentMode, skipped: "Boundary fixture has no populated book" }); continue;
      }
      const cell: PerformanceSample[] = [];
      for (let run = 1; run <= runs; run++) for (let index = -warmups; index < samples; index++) {
        // Leave one page of headroom at the server's 1,000-page ceiling.
        const prepared = action === "create-page" && snapshot.documents.length === 1000 ? { ...snapshot, documents: snapshot.documents.slice(0, 999) } : snapshot;
        if (model) resetKeyGroupApiModel(model, prepared);
        if (mode === "server" && workspaceKind === "group" && seeded) await resetServerFixture(page, prepared);
        else await seedLibrary(page, prepared, workspaceKind);
        seeded = true;
        observedRttMs ??= await page.evaluate(async () => {
          const start = performance.now(); await fetch("/icon.svg", { method: "HEAD", cache: "no-store" }); return performance.now() - start;
        });
        if (workspaceKind === "group") await selectGroup(page);
        await targetPage(page); await visibleTab(page, contentMode);
        if (contentMode === "Read") await expect(page.getByRole("heading", { name: "Synthetic page 0", exact: true })).toBeVisible();
        else await expect(page.locator(".cm-content")).toContainText("Synthetic page 0");
        if (action === "dirty-switch") {
          await visibleTab(page, "Edit"); await page.locator(".cm-content").fill("# Unsaved synthetic edit");
          await visibleTab(page, contentMode);
        }
        if (action === "cold-open" || action === "cached-reopen") {
          if (action === "cold-open" && workspaceKind === "group") await clearSnapshotCache(page);
          await page.reload(); await visibleTab(page, "Edit"); await openShelf(page);
          await page.getByRole("button", { name: /Current workspace:/ }).click();
        } else if (["delete-active", "delete-inactive", "rename-book", "delete-book"].includes(action)) {
          await openShelf(page);
          await page.getByRole("button", { name: action.endsWith("book") ? "Manage Book 0" : `Manage Page ${action === "delete-active" ? 0 : 5}`, exact: true }).click();
          if (action === "rename-book") {
            await page.getByRole("menuitem", { name: "Rename Book 0", exact: true }).click();
            await page.getByRole("textbox", { name: "Rename Book 0", exact: true }).fill(`Renamed book ${index}`);
          }
        } else if (action === "switch" || action === "dirty-switch") {
          await openShelf(page);
        } else if (action === "create-page") {
          await openShelf(page);
          if (collection === "book") await page.getByRole("button", { name: "Manage Book 0", exact: true }).click();
        }
        if (action === "dirty-switch") {
          await expect(page.getByRole("status", { includeHidden: true }).filter({ hasText: /Unsaved changes|Saving changes/ })).toHaveCount(1);
        }
        let outcome: PerformanceSample["outcome"] = "success";
        let paintMs: number | null = null; let confirmedMs: number | null = null; let feedbackMs: number | null = null;
        try {
          const measured = await measureAction(page, { action, initiator: ["switch", "dirty-switch"].includes(action) ? "navigation" : action.endsWith("open") ? "initial-load" : "mutation" },
            () => performAction(page, action, workspaceKind, index, collection),
            () => assertAction(page, action, workspaceKind, index));
          paintMs = measured.paintMs; confirmedMs = measured.confirmedMs; feedbackMs = measured.feedbackMs;
          if (action === "switch") expect(measured.requests).toHaveLength(0);
          if (workspaceKind === "group" && ["create-page", "delete-active", "delete-inactive"].includes(action)) expect(measured.requests.filter((item) => item.method === "GET" && item.route === "/api/key-groups/:groupId")).toHaveLength(0);
          if (workspaceKind === "group" && action === "delete-book") expect(measured.requests.filter((item) => item.method === "GET" && item.route === "/api/key-groups/:groupId")).toHaveLength(1);
          if (index >= 0) timelines.push({ sample: records.length, requests: measured.requests.map((item) => JSON.parse(serializeRequestSample(item))) });
        } catch (error) {
          outcome = "failed";
          if (index >= 0 && error instanceof MeasurementFailure) timelines.push({ sample: records.length, requests: error.requests.map((item) => JSON.parse(serializeRequestSample(item))) });
          summaries.push({ action, contentMode, run, sample: index, failure: "Action or request contract failed" });
          // Error messages/stacks can contain URLs, titles, bodies, or credentials.
        }
        if (index >= 0) {
          const record = { action, workspaceKind, fixture, mode, profile, run, outcome, paintMs, feedbackMs, confirmedMs, viewMode: contentMode, collection };
          records.push(record); cell.push(record);
        }
        // Pacing is outside the timed action, including reset calls below.
        if (mode === "server" && workspaceKind === "group") await new Promise((resolve) => setTimeout(resolve, 1100));
      }
      summaries.push({ action, contentMode, collection, preparedPageCount: action === "create-page" && snapshot.documents.length === 1000 ? 999 : snapshot.documents.length, movedPageCount: action === "delete-book" ? snapshot.documents.filter((item) => item.folderId === snapshot.folders[0].id).length : null, count: cell.length, failures: cell.filter((item) => item.outcome === "failed").length, p50: percentile(cell.flatMap((item) => item.paintMs === null ? [] : [item.paintMs]), 0.5), p95: percentile(cell.flatMap((item) => item.paintMs === null ? [] : [item.paintMs]), 0.95) });
    }
    const output = { environment: { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), browser: browser.version(), os: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(), viewport: page.viewportSize(), project: testInfo.project.name, cpuThrottling: 1, network, observedRttMs, seed: fixtureSeed, fixture, books: snapshot.folders.length, pages: snapshot.documents.length, bodyBytes: snapshot.documents.reduce((sum, item) => sum + Buffer.byteLength(item.body), 0), samplesPerRun: samples, runs, excludedWarmupsPerRun: 5, diagnostic: samples < 100 || runs < 3, paintBoundary: "two-animation-frame proxy; not validated presented-frame timing", mode }, records: records.map((item) => ({ ...JSON.parse(serializePerformanceSample(item)), viewMode: item.viewMode, collection: item.collection })), timelines, summaries };
    output.environment.excludedWarmupsPerRun = warmups;
    output.environment.observedRttMs = observedRttMs;
    output.environment.diagnostic ||= warmups < 5;
    const source = createHash("sha256");
    const sourceFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "src", "tests", "package.json", "package-lock.json", "playwright.performance.config.ts"], { encoding: "utf8" }).trim().split(/\r?\n/).sort();
    for (const file of sourceFiles) source.update(file).update(readFileSync(file));
    const json = JSON.stringify({ ...output, provenance: { sourceSha256: source.digest("hex"), workingTreeDirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).length > 0, observedRttKind: "HEAD asset roundtrip including app processing" } }, null, 2);
    expect(json).not.toMatch(/FORBIDDEN|mdez-group-|x-mdez-group-key/);
    await mkdir(testInfo.outputDir, { recursive: true });
    const outputPath = testInfo.outputPath("sanitized-performance.json");
    await writeFile(outputPath, json);
    await testInfo.attach("sanitized-performance.json", { path: outputPath, contentType: "application/json" });
    expect(records.filter((item) => item.outcome === "failed")).toHaveLength(0);
  });
}

async function performAction(page: Page, action: PerformanceAction, kind: "local" | "group", iteration: number, collection: string) {
  switch (action) {
    case "switch": case "dirty-switch": return page.getByRole("button", { name: "Open Page 5", exact: true }).first().click();
    case "cold-open": case "cached-reopen":
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "GET" && /\/api\/key-groups\/[^/?]+$/.test(response.url())),
        page.getByRole("button", { name: kind === "group" ? "Performance library" : "Local Library", exact: true }).click(),
      ]); return;
    case "create-page": return collection === "book" ? page.getByRole("menuitem", { name: "Add page", exact: true }).click() : page.getByRole("button", { name: "Add page to Unsorted", exact: true }).click();
    case "delete-active": case "delete-inactive": return page.getByRole("menuitem", { name: "Delete page", exact: true }).click();
    case "rename-page":
      if (kind === "group") {
        await Promise.all([page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/documents/")), page.getByRole("textbox", { name: "Page title", exact: true }).fill(`Renamed ${iteration}`)]); return;
      }
      return page.getByRole("textbox", { name: "Page title", exact: true }).fill(`Renamed ${iteration}`);
    case "rename-book":
      return page.getByRole("textbox", { name: "Rename Book 0", exact: true }).press("Enter");
    case "delete-book": return page.getByRole("menuitem", { name: "Delete book", exact: true }).click();
  }
}
async function assertAction(page: Page, action: PerformanceAction, kind: "local" | "group", iteration: number) {
  switch (action) {
    case "switch": case "dirty-switch":
      await drawerClosed(page);
      if (await page.getByRole("textbox", { name: "Page title", exact: true }).isVisible()) await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue("Page 5");
      else await expect(page.getByRole("heading", { name: "Page 5", exact: true })).toBeVisible();
      if (await page.locator(".cm-content").isVisible()) await expect(page.locator(".cm-content")).toContainText("Synthetic page 5");
      else await expect(page.getByRole("heading", { name: "Synthetic page 5", exact: true })).toBeVisible(); return;
    case "cold-open": case "cached-reopen":
      await expect(page.getByRole("button", { name: `Current workspace: ${kind === "group" ? "Performance library" : "Local Library"}`, exact: true })).toBeVisible();
      await expect(page.locator('input[aria-label="Page title"]')).toHaveValue("Page 0");
      if (kind === "group") await expect(page.getByRole("button", { name: "Open Book 0 book", exact: true })).toBeVisible(); return;
    case "create-page": await drawerClosed(page); await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue("untitled.md"); return;
    case "delete-active": case "delete-inactive": await expect(page.getByRole("button", { name: `Manage Page ${action === "delete-active" ? 0 : 5}`, exact: true })).toHaveCount(0); return;
    case "rename-page":
      await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue(`Renamed ${iteration}`); return;
    case "rename-book": await expect(page.getByRole("button", { name: `Open Renamed book ${iteration} book`, exact: true })).toBeVisible(); return;
    case "delete-book": await expect(page.getByRole("button", { name: "Open Book 0 book", exact: true })).toHaveCount(0); return;
  }
}
async function drawerClosed(page: Page) {
  const trigger = page.getByRole("button", { name: "Open library shelf" });
  if (await trigger.isVisible()) await expect(trigger).toHaveAttribute("aria-expanded", "false");
}
async function clearSnapshotCache(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("mdez"); req.onsuccess = () => resolve(req.result); });
    await new Promise<void>((resolve) => { const tx = db.transaction("cachedGroups", "readwrite"); tx.objectStore("cachedGroups").clear(); tx.oncomplete = () => resolve(); }); db.close();
  });
}
async function resetServerFixture(page: Page, fixture: ReturnType<typeof buildPerformanceFixture>) {
  await page.goto("/icon.svg");
  await page.evaluate(async (fixture) => {
    const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open("mdez"); req.onsuccess = () => resolve(req.result); });
    const remembered = await new Promise<{ groupId: string; key: string }>((resolve) => { const req = db.transaction("rememberedGroups").objectStore("rememberedGroups").getAll(); req.onsuccess = () => resolve(req.result[0]); }); db.close();
    const base = `/api/key-groups/${remembered.groupId}`;
    const headers = { "x-mdez-group-key": remembered.key, "content-type": "application/json" };
    const preflight = await fetch(base, { headers });
    if (preflight.headers.get("x-mdez-performance") !== "disposable" || !preflight.ok) throw new Error("Disposable reset preflight failed");
    const current = await preflight.json() as typeof fixture;
    async function mutate(path: string, method: string, input: unknown) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      const response = await fetch(base + path, { method, headers, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(`Fixture reset failed (${response.status})`);
      return response.json();
    }
    const books = new Map<string, string>();
    for (const book of fixture.folders) {
      let row = current.folders.find((item) => item.name === book.name);
      if (!row) row = await mutate("/folders", "POST", { name: book.name, parentId: null });
      books.set(book.id, row!.id);
    }
    for (const row of current.documents) if (!fixture.documents.some((item) => item.title === row.title)) await mutate(`/documents/${row.id}`, "DELETE", { expectedVersion: row.version });
    for (const row of current.folders) if (!fixture.folders.some((item) => item.name === row.name)) await mutate(`/folders/${row.id}`, "DELETE", { expectedVersion: row.version });
    // Reload after book moves so expected versions are authoritative.
    const refreshed = await (await fetch(base, { headers })).json() as typeof fixture;
    for (const item of fixture.documents) {
      const row = refreshed.documents.find((row) => row.title === item.title);
      const folderId = item.folderId ? books.get(item.folderId)! : null;
      if (!row) await mutate("/documents", "POST", { title: item.title, body: item.body, folderId });
      else if (row.body !== item.body || row.folderId !== folderId) await mutate(`/documents/${row.id}`, "PATCH", { body: item.body, folderId, expectedVersion: row.version });
    }
  }, fixture);
  await page.goto("/");
}



