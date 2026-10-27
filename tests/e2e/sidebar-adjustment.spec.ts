import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(async () =>
    (await indexedDB.databases()).find((database) => database.name === "mdez")?.version ?? 0
  )).toBeGreaterThanOrEqual(6);
});

test("desktop sidebar supports drag, keyboard limits, persistence and collapse", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop resizing uses the persistent sidebar.");
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const handle = page.getByRole("separator", { name: "Resize library sidebar" });
  await expect(handle).toHaveAttribute("aria-valuenow", "272");
  await handle.press("ArrowRight");
  await expect(sidebar).toHaveCSS("width", "288px");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "368");
  await expect(sidebar).toHaveCSS("width", "368px");
  await page.mouse.move(700, 400);
  await expect(handle).toHaveAttribute("aria-valuenow", "368");
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(handle).toBeHidden();
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(sidebar).toHaveCSS("width", "368px");
  await page.reload();
  await expect(handle).toHaveAttribute("aria-valuenow", "368");
  await handle.press("End");
  await handle.press("ArrowRight");
  await expect(sidebar).toHaveCSS("width", "480px");
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await handle.press("Home");
  await handle.press("ArrowLeft");
  await expect(sidebar).toHaveCSS("width", "240px");
  await handle.dblclick();
  await expect(sidebar).toHaveCSS("width", "272px");
  await page.screenshot({ path: testInfo.outputPath("sidebar-desktop.png"), animations: "disabled" });
});

test("drawer ignores saved desktop width and preserves it when returning to desktop", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("mdez-sidebar-width", "480"));
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 740 });
  await page.getByRole("button", { name: "Open library shelf" }).click();
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize library sidebar" })).toBeHidden();
  expect((await sidebar.boundingBox())!.width).toBeLessThan(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sidebar-mobile.png"), animations: "disabled" });
  await sidebar.getByRole("button", { name: "Close library shelf" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(sidebar).toHaveCSS("width", "480px");
});

test("workspace menu fits the default and minimum sidebar widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop sidebar width limits.");
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const handle = page.getByRole("separator", { name: "Resize library sidebar" });
  for (const width of [272, 240]) {
    if (width === 240) await handle.press("Home");
    await expect(sidebar).toHaveCSS("width", `${width}px`);
    await sidebar.getByRole("button", { name: "Current workspace: Local Library" }).click();
    await expect(sidebar.locator('[aria-label="Workspaces"]')).toBeVisible();
    expect(await page.locator(".sidebar-content").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await sidebar.getByRole("button", { name: "Current workspace: Local Library" }).click();
  }
});

test("library list scrolls independently and stays reachable in a short viewport", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little space for big ideas." })).toBeVisible();
  await expect.poll(() => page.evaluate(async () =>
    (await indexedDB.databases()).find((database) => database.name === "mdez")?.version ?? 0
  )).toBeGreaterThanOrEqual(6);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mdez");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("folders", "readwrite");
    const timestamp = new Date().toISOString();
    for (let index = 0; index < 40; index++) {
      transaction.objectStore("folders").add({ id: `book-${index}`, name: `Book ${index}`, parentId: null, order: index, createdAt: timestamp, updatedAt: timestamp });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Open library shelf" }).click();
  const scroller = page.locator(".sidebar-library-scroll");
  await expect(page.getByRole("button", { name: "Open Book 39 book" })).toBeAttached();
  const headingTop = await page.locator(".sidebar-section-heading").first().evaluate((element) => element.getBoundingClientRect().top);
  await scroller.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator(".sidebar-section-heading").first().evaluate((element) => element.getBoundingClientRect().top)).toBe(headingTop);
  await page.setViewportSize({ width: testInfo.project.name === "mobile" ? 390 : 1280, height: 430 });
  expect(await scroller.evaluate((element) => element.clientHeight)).toBeGreaterThanOrEqual(100);
  await page.getByRole("button", { name: "Open Book 39 book" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Open Book 39 book" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sidebar-short.png"), animations: "disabled" });
});
