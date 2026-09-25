import { expect, test, type Page } from "@playwright/test";

async function mode(page: Page, name: string) {
  const nav = page.locator((page.viewportSize()?.width ?? 1280) <= 767 ? ".mobile-mode-nav" : ".workspace-mode-nav");
  await nav.getByRole("tab", { name, exact: true }).evaluate((element) => (element as HTMLElement).click());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill("# Reading test\n\n- First bullet\n  - Nested bullet\n\n3. Third item\n4. Fourth item\n\n- [ ] Pending task\n- [x] Finished task\n\nA paragraph to read.");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Reading test");
  await mode(page, "Read");
});

test("renders visible list markers and preserves task checkboxes", async ({ page }) => {
  const markdown = page.locator(".markdown-preview");
  await expect(markdown.locator("ul").first()).toHaveCSS("list-style-type", "disc");
  await expect(markdown.locator("ul ul")).toHaveCSS("list-style-type", "circle");
  await expect(markdown.locator("ol")).toHaveCSS("list-style-type", "decimal");
  await expect(markdown.locator("ol")).toHaveAttribute("start", "3");
  await expect(markdown.locator(".task-list-item").first()).toHaveCSS("list-style-type", "none");
  await expect(markdown.getByRole("checkbox").last()).toBeChecked();
});

test("keeps text size across modes and reloads with working limits and reset", async ({ page }, testInfo) => {
  const larger = page.getByRole("button", { name: "Increase reading text size" });
  await larger.click();
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "18px");
  await mode(page, "Split");
  if ((page.viewportSize()?.width ?? 1280) <= 767) {
    await page.locator(".split-workspace").getByRole("tab", { name: "Preview", exact: true }).click();
  }
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "18px");
  await page.reload();
  await mode(page, "Read");
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "18px");
  for (let i = 0; i < 5; i++) await larger.click();
  await expect(larger).toBeDisabled();
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "28px");
  await page.screenshot({ path: testInfo.outputPath("reader-large-text.png"), fullPage: true });
  await page.getByRole("button", { name: "Reset reading settings" }).click();
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "16px");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Decrease reading text size" }).click();
  await expect(page.getByRole("button", { name: "Decrease reading text size" })).toBeDisabled();
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "12px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mode(page, "Shelf");
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill("# Another page\n\nThe same reading preferences.");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await mode(page, "Read");
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-size", "12px");
});

test("resizes Read with keyboard and drag while keeping Split independent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mobile uses the available screen width and compact Split tabs.");
  await page.setViewportSize({ width: 1600, height: 1000 });
  const handle = page.getByRole("separator", { name: "Resize reading width" });
  await handle.press("Home");
  await expect(handle).toHaveAttribute("aria-valuenow", "320");
  const before = await page.locator(".markdown-preview").boundingBox();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  expect((await page.locator(".markdown-preview").boundingBox())!.width).toBeGreaterThan(before!.width + 200);
  const savedWidth = await handle.getAttribute("aria-valuenow");
  await mode(page, "Split");
  const split = page.getByRole("separator", { name: "Resize editor and reader panes" });
  await split.press("ArrowLeft");
  await expect(split).toHaveAttribute("aria-valuenow", "45");
  const splitBox = (await split.boundingBox())!;
  await page.mouse.move(splitBox.x + splitBox.width / 2, splitBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(splitBox.x - 80, splitBox.y + 30, { steps: 8 });
  await page.mouse.up();
  const splitPosition = await split.getAttribute("aria-valuenow");
  expect(Number(splitPosition)).toBeLessThan(45);
  await page.screenshot({ path: testInfo.outputPath("reader-split.png"), fullPage: true });
  await page.reload();
  await mode(page, "Split");
  await expect(split).toHaveAttribute("aria-valuenow", splitPosition!);
  await mode(page, "Read");
  await expect(handle).toHaveAttribute("aria-valuenow", savedWidth!);
  await page.screenshot({ path: testInfo.outputPath("reader-desktop.png"), fullPage: true });
  await handle.press("Home");
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(handle).toBeHidden();
  await expect.poll(async () => (await page.locator(".reader-content-column").boundingBox())!.width).toBeGreaterThan(400);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(handle).toHaveAttribute("aria-valuenow", "320");
  await page.getByRole("button", { name: "Reset reading settings" }).click();
  await expect(handle).toHaveAttribute("aria-valuenow", "720");
  await mode(page, "Split");
  await expect(split).toHaveAttribute("aria-valuenow", "50");
});
