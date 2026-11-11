import { expect, test, type Page } from "@playwright/test";
import { installKeyGroupApiModel } from "./support/key-group-api-model";
import { buildPerformanceFixture } from "../performance/support/fixtures";
import { closeShelf, measureAction, openShelf, seedLibrary, selectGroup, visibleTab } from "../performance/support/browser";

test("loaded page selection and confirmed page mutations avoid snapshot requests", async ({ page, context }) => {
  const snapshot = buildPerformanceFixture("small");
  const model = await installKeyGroupApiModel(context);
  model.snapshot = snapshot; model.key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
  await seedLibrary(page, snapshot, "group"); await selectGroup(page);
  await openShelf(page);
  await page.getByRole("button", { name: "Expand Unsorted pages", exact: true }).click();
  await page.getByRole("button", { name: "Open Page 0", exact: true }).first().click();
  await closeShelf(page); await visibleTab(page, "Edit"); await openShelf(page);
  const switched = await measureAction(page, { action: "switch", initiator: "navigation" },
    () => page.getByRole("button", { name: "Open Page 5", exact: true }).first().click(),
    async () => { await closeShelf(page); await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue("Page 5"); });
  expect(switched.requests).toHaveLength(0);
  await openShelf(page);
  const created = await measureAction(page, { action: "create-page", initiator: "mutation" },
    () => page.getByRole("button", { name: "Add page to Unsorted", exact: true }).click(),
    async () => { await closeShelf(page); await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue("untitled.md"); });
  expect(created.requests.filter((item) => item.method === "POST")).toHaveLength(1);
  expect(created.requests.filter((item) => item.method === "GET")).toHaveLength(0);
  await openShelf(page);
  await page.getByRole("button", { name: "Manage untitled.md", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  const deleted = await measureAction(page, { action: "delete-active", initiator: "mutation" },
    () => page.getByRole("menuitem", { name: "Delete page", exact: true }).click(),
    () => expect(page.getByRole("button", { name: "Manage untitled.md", exact: true })).toHaveCount(0));
  expect(deleted.requests.filter((item) => item.method === "DELETE")).toHaveLength(1);
  expect(deleted.requests.filter((item) => item.method === "GET")).toHaveLength(0);
  expect(model.snapshot.documents).toHaveLength(10);
});

test("book deletion refreshes authoritative moved page versions", async ({ page, context }) => {
  const snapshot = buildPerformanceFixture("small");
  const model = await installKeyGroupApiModel(context);
  model.snapshot = snapshot; model.key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
  await seedLibrary(page, snapshot, "group"); await selectGroup(page); await openShelf(page);
  await page.getByRole("button", { name: "Manage Book 0", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  const result = await measureAction(page, { action: "delete-book", initiator: "mutation" },
    () => page.getByRole("menuitem", { name: "Delete book", exact: true }).click(),
    () => expect(page.getByRole("button", { name: "Open Book 0 book", exact: true })).toHaveCount(0));
  expect(result.requests.filter((item) => item.method === "GET" && item.route === "/api/key-groups/:groupId")).toHaveLength(1);
  expect(model.snapshot.documents).toHaveLength(10);
  expect(model.snapshot.documents.filter((item) => item.version === 2).every((item) => item.folderId === null)).toBe(true);
});

async function reset(page: Page) { await page.goto("/icon.svg"); await page.evaluate(() => new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase("mdez"); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); })); await page.goto("/"); await expect(page.getByRole("heading", { name: "A little space for big ideas." })).toBeVisible(); }
async function clickVisibleTab(page: Page, name: string) { const tabs = page.getByRole("tab", { name, exact: true }); for (let index = 0; index < await tabs.count(); index += 1) { if (await tabs.nth(index).isVisible()) { await tabs.nth(index).click(); return; } } }
async function openShelfDrawerIfAvailable(page: Page): Promise<void> { const trigger = page.getByRole("button", { name: "Open library shelf" }); if (await trigger.isVisible().catch(() => false)) await trigger.click(); }
async function closeShelfDrawerIfAvailable(page: Page): Promise<void> { const close = page.getByRole("complementary", { name: "Library shelf" }).getByRole("button", { name: "Close library shelf" }); if (await close.isVisible().catch(() => false)) await close.click(); }
async function createGroupFromLocalLibrary(page: Page, name: string): Promise<void> { await openShelfDrawerIfAvailable(page); await page.getByRole("button", { name: /Current workspace:/ }).click(); await page.getByRole("button", { name: "Create group" }).click(); await page.getByRole("textbox", { name: "Group name" }).fill(name); await page.getByRole("button", { name: "Create and copy Local Library" }).click(); await expect(page.getByLabel("Group key")).toHaveValue(/^mdez-group-/); }
async function joinGroup(page: Page, key: string): Promise<void> { await openShelfDrawerIfAvailable(page); await page.getByRole("button", { name: /Current workspace:/ }).click(); await page.getByRole("button", { name: "Join group" }).click(); await page.getByLabel("Group key").fill(key); await page.getByRole("button", { name: "Join group", exact: true }).click(); await expect(page.getByRole("button", { name: "Current workspace: Writers" })).toBeVisible(); await closeShelfDrawerIfAvailable(page); }

test("joined members can reveal their remembered group key after reload", async ({ page, context }, testInfo) => {
  const model = await installKeyGroupApiModel(context);
  model.key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
  await reset(page);
  await joinGroup(page, model.key);
  await page.reload();
  await openShelfDrawerIfAvailable(page);
  await expect(page.getByRole("button", { name: "Current workspace: Writers" })).toBeVisible();
  await page.getByRole("button", { name: "Group settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Group settings" });
  const keyInput = dialog.getByLabel("Group key", { exact: true });
  await expect(keyInput).toHaveValue(model.key);
  await expect(keyInput).toHaveAttribute("type", "password");
  await dialog.getByRole("button", { name: "Show key" }).click();
  await expect(keyInput).toHaveAttribute("type", "text");
  await expect(keyInput).toHaveAttribute("readonly", "");
  await page.screenshot({ path: testInfo.outputPath("group-key-settings.png") });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Close group settings" }).click();
  await page.getByRole("button", { name: "Group settings", exact: true }).click();
  await expect(keyInput).toHaveAttribute("type", "password");
  expect(page.url()).not.toContain(model.key);
});

test("refresh preserves an explicit switch back to Local Library", async ({ page, context }) => {
  const model = await installKeyGroupApiModel(context);
  model.key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
  await reset(page);
  await joinGroup(page, model.key);
  await openShelfDrawerIfAvailable(page);
  await page.getByRole("button", { name: "Current workspace: Writers" }).click();
  await page.getByRole("button", { name: "Local Library", exact: true }).click();
  await page.reload();
  await openShelfDrawerIfAvailable(page);
  await expect(page.getByRole("button", { name: "Current workspace: Local Library" })).toBeVisible();
  await page.getByRole("button", { name: "Current workspace: Local Library" }).click();
  await expect(page.getByRole("button", { name: "Writers", exact: true })).toBeVisible();
});

test("leaving a group keeps Local Library selected after refresh", async ({ page, context }) => {
  const model = await installKeyGroupApiModel(context);
  model.key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
  await reset(page);
  await joinGroup(page, model.key);
  await openShelfDrawerIfAvailable(page);
  await page.getByRole("button", { name: "Group settings", exact: true }).click();
  await page.getByRole("button", { name: "Leave group on this browser", exact: true }).click();
  await expect(page.getByRole("button", { name: "Current workspace: Local Library" })).toBeVisible();
  await page.reload();
  await openShelfDrawerIfAvailable(page);
  await expect(page.getByRole("button", { name: "Current workspace: Local Library" })).toBeVisible();
  await page.getByRole("button", { name: "Current workspace: Local Library" }).click();
  await expect(page.getByRole("button", { name: "Writers", exact: true })).toHaveCount(0);
});

test("two browsers join one key and share saved Markdown", async ({ browser }) => {
  test.setTimeout(60_000);
  const creatorContext = await browser.newContext(); const joinerContext = await browser.newContext(); const creator = await creatorContext.newPage(); const joiner = await joinerContext.newPage();
  const model = await installKeyGroupApiModel(creatorContext); await installKeyGroupApiModel(joinerContext, model); await reset(creator); await reset(joiner);
  await creator.getByRole("button", { name: "Create page", exact: true }).last().click(); await createGroupFromLocalLibrary(creator, "Writers"); const key = await creator.getByLabel("Group key").inputValue();
  await creator.getByRole("button", { name: "Close group creation" }).click(); await closeShelfDrawerIfAvailable(creator); await joinGroup(joiner, key); await openShelfDrawerIfAvailable(creator); await expect(creator.getByRole("button", { name: "Current workspace: Writers" })).toBeVisible(); await closeShelfDrawerIfAvailable(creator);
  await clickVisibleTab(creator, "Edit"); const editor = creator.getByRole("textbox", { name: "Markdown editor" }); await editor.click(); await editor.press("Control+A"); await creator.keyboard.insertText("# Saved by creator"); await expect.poll(() => model.snapshot.documents[0]?.body).toBe("# Saved by creator");
  await openShelfDrawerIfAvailable(joiner); await joiner.getByRole("button", { name: "Refresh group" }).click(); await closeShelfDrawerIfAvailable(joiner); await clickVisibleTab(joiner, "Edit"); await expect(joiner.getByRole("textbox", { name: "Markdown editor" })).toContainText("# Saved by creator");
  for (const page of [creator, joiner]) expect(page.url()).not.toContain(key);
  await creatorContext.close(); await joinerContext.close();
});

test("Key Group restore exits to Local Library without changing the group snapshot", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The workspace-boundary recovery case is covered in desktop Chromium.");
  test.setTimeout(60_000);
  const model = await installKeyGroupApiModel(context);
  await reset(page);

  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Page title" }).fill("Local seed");
  await page.locator(".cm-content").fill("# Local seed\n\nThis stays in the browser library.");
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });
  await clickVisibleTab(page, "Shelf");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up library" }).click();
  const backupPath = await (await downloadPromise).path();
  expect(backupPath).not.toBeNull();

  await createGroupFromLocalLibrary(page, "Writers");
  const originalSnapshot = structuredClone(model.snapshot);
  await page.getByRole("button", { name: "Close group creation" }).click();
  await closeShelfDrawerIfAvailable(page);
  await clickVisibleTab(page, "Shelf");
  await page.getByRole("button", { name: "Import Markdown", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await dialog.getByRole("tab", { name: "Restore backup" }).click();
  await dialog.getByLabel("Choose Mdez backup").setInputFiles(backupPath!);
  await expect(dialog.getByRole("heading", { name: "Backup ready to restore" })).toBeVisible();
  await dialog.getByRole("button", { name: "Restore backup" }).click();

  await openShelfDrawerIfAvailable(page);
  await expect(page.getByRole("button", { name: "Current workspace: Local Library" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Local seed" })).toHaveCount(2);
  expect(model.snapshot).toEqual(originalSnapshot);

  await page.reload();
  await openShelfDrawerIfAvailable(page);
  await expect(page.getByRole("button", { name: "Current workspace: Local Library" })).toBeVisible();
  expect(model.snapshot).toEqual(originalSnapshot);
});
