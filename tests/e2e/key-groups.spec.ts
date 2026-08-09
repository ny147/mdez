import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { GroupChange, GroupSnapshot } from "../../src/types/key-group";

type KeyGroupApiModel = { revision: number; snapshot: GroupSnapshot; key: string; deletedAt: string | null };
const logs = new WeakMap<KeyGroupApiModel, GroupChange[]>();
const timestamp = "2026-08-09T00:00:00.000Z";

async function installKeyGroupApiModel(context: BrowserContext, model?: KeyGroupApiModel): Promise<KeyGroupApiModel> {
  const shared = model ?? { revision: 0, key: "", deletedAt: null, snapshot: { group: { id: "g1", name: "Writers", revision: 0, deletedAt: null, purgeAfter: null, createdAt: timestamp, updatedAt: timestamp }, folders: [], documents: [] } };
  if (!logs.has(shared)) logs.set(shared, []);
  await context.route("**/api/key-groups**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const key = request.headers()["x-mdez-group-key"] ?? "";
    if (path === "/api/key-groups" && request.method() === "POST") {
      shared.key = key; const input = request.postDataJSON() as { name: string; folders: Array<{ clientId: string; parentClientId: string | null; name: string; order: number; createdAt: string; updatedAt: string }>; documents: Array<{ clientId: string; folderClientId: string | null; title: string; body: string; order: number; createdAt: string; updatedAt: string }> };
      shared.snapshot = { group: { ...shared.snapshot.group, name: input.name }, folders: input.folders.map((item) => ({ id: item.clientId, parentId: item.parentClientId, name: item.name, order: item.order, version: 1, groupRevision: 0, createdAt: item.createdAt, updatedAt: item.updatedAt })), documents: input.documents.map((item) => ({ id: item.clientId, folderId: item.folderClientId, title: item.title, body: item.body, order: item.order, version: 1, groupRevision: 0, createdAt: item.createdAt, updatedAt: item.updatedAt })) };
      return route.fulfill({ status: 201, json: shared.snapshot });
    }
    if (!shared.key || key !== shared.key) return route.fulfill({ status: 401, json: { error: "Group key is invalid" } });
    if (path === "/api/key-groups/join" && request.method() === "POST") return route.fulfill({ status: 200, json: shared.snapshot });
    if (path.endsWith("/changes") && request.method() === "GET") {
      const after = Number(url.searchParams.get("after") ?? 0); const changes = (logs.get(shared) ?? []).filter((entry) => entry.revision > after); const changedIds = new Set(changes.filter((entry) => entry.entityType === "document" && entry.operation !== "delete").map((entry) => entry.entityId));
      return route.fulfill({ status: 200, json: { status: "changes", revision: shared.revision, changes, records: { group: null, folders: [], documents: shared.snapshot.documents.filter((item) => changedIds.has(item.id)) } } });
    }
    const documentMatch = path.match(/\/documents\/([^/]+)$/);
    if (documentMatch && request.method() === "PATCH") {
      const id = decodeURIComponent(documentMatch[1]); const input = request.postDataJSON() as { body?: string; title?: string; expectedVersion: number }; const current = shared.snapshot.documents.find((item) => item.id === id);
      if (!current) return route.fulfill({ status: 404, json: { error: "Not found" } });
      if (current.version !== input.expectedVersion) return route.fulfill({ status: 409, json: { error: "VERSION_CONFLICT", conflict: { entityType: "document", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version } } });
      shared.revision += 1; Object.assign(current, { body: input.body ?? current.body, title: input.title ?? current.title, version: current.version + 1, groupRevision: shared.revision, updatedAt: timestamp }); shared.snapshot.group.revision = shared.revision;
      logs.get(shared)!.push({ revision: shared.revision, entityType: "document", entityId: id, operation: "update", changedAt: timestamp });
      return route.fulfill({ status: 200, json: current });
    }
    if (path === "/api/key-groups/g1" && request.method() === "GET") return route.fulfill({ status: 200, json: shared.snapshot });
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return shared;
}

async function reset(page: Page) { await page.goto("/icon.svg"); await page.evaluate(() => new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase("mdez"); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); })); await page.goto("/"); await expect(page.getByRole("heading", { name: "Library" })).toBeVisible(); }
async function clickVisibleTab(page: Page, name: string) { const tabs = page.getByRole("tab", { name, exact: true }); for (let index = 0; index < await tabs.count(); index += 1) { if (await tabs.nth(index).isVisible()) { await tabs.nth(index).click(); return; } } }
async function createGroupFromLocalLibrary(page: Page, name: string): Promise<void> { await page.getByRole("button", { name: /Current workspace:/ }).click(); await page.getByRole("button", { name: "Create group" }).click(); await page.getByRole("textbox", { name: "Group name" }).fill(name); await page.getByRole("button", { name: "Create and copy Local Library" }).click(); await expect(page.getByLabel("Group key")).toHaveValue(/^mdez-group-/); }
async function joinGroup(page: Page, key: string): Promise<void> { await page.getByRole("button", { name: /Current workspace:/ }).click(); await page.getByRole("button", { name: "Join group" }).click(); await page.getByLabel("Group key").fill(key); await page.getByRole("button", { name: "Join group", exact: true }).click(); await expect(page.getByRole("button", { name: "Current workspace: Writers" })).toBeVisible(); }

test("two browsers join one key and share saved Markdown", async ({ browser }) => {
  test.setTimeout(60_000);
  const creatorContext = await browser.newContext(); const joinerContext = await browser.newContext(); const creator = await creatorContext.newPage(); const joiner = await joinerContext.newPage();
  const model = await installKeyGroupApiModel(creatorContext); await installKeyGroupApiModel(joinerContext, model); await reset(creator); await reset(joiner);
  await creator.getByRole("button", { name: "Create page", exact: true }).last().click(); await createGroupFromLocalLibrary(creator, "Writers"); const key = await creator.getByLabel("Group key").inputValue();
  await creator.getByRole("button", { name: "Close group creation" }).click(); await joinGroup(joiner, key); await expect(creator.getByRole("button", { name: "Current workspace: Writers" })).toBeVisible();
  await clickVisibleTab(creator, "Edit"); const editor = creator.getByRole("textbox", { name: "Markdown editor" }); await editor.click(); await editor.press("Control+A"); await creator.keyboard.insertText("# Saved by creator"); await expect.poll(() => model.snapshot.documents[0]?.body).toBe("# Saved by creator");
  await joiner.getByRole("button", { name: "Refresh group" }).click(); await clickVisibleTab(joiner, "Edit"); await expect(joiner.getByRole("textbox", { name: "Markdown editor" })).toContainText("# Saved by creator");
  for (const page of [creator, joiner]) expect(page.url()).not.toContain(key);
  await creatorContext.close(); await joinerContext.close();
});
