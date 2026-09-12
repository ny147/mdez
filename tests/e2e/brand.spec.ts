import { expect, test } from "@playwright/test";

test("sidebar book names retain readable space beside their management controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your library starts here." })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("Creative writing"));
  await page.getByRole("main").getByRole("button", { name: "New book", exact: true }).click();
  const title = page.getByRole("button", { name: "Open Creative writing book", exact: true });
  await expect(title).toBeVisible();
  expect((await title.boundingBox())!.width).toBeGreaterThanOrEqual(80);
});

test("brand reveal does not replay when the sidebar is collapsed or the app reloads", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    document.addEventListener("animationstart", (event) => {
      if (event.animationName === "brand-peek") {
        document.documentElement.dataset.brandStarts = String(Number(document.documentElement.dataset.brandStarts ?? 0) + 1);
      }
    });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-brand-starts", "1");
  // Wait for the authored animation, not an arbitrary page delay.
  await page.locator(".brand-logo-sparkle").evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished));
  });
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator("html")).toHaveAttribute("data-brand-starts", "1");
  await page.reload();
  await expect(page.locator(".brand-reveal")).toHaveAttribute("data-reveal", "false");
  await expect(page.locator("html")).not.toHaveAttribute("data-brand-starts");
});

test("reduced motion keeps the logo still and mascot image failure preserves the welcome layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/brand/mascot-*.png", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".brand-reveal")).toHaveAttribute("data-reveal", "false");
  expect(await page.locator(".brand-logo-mascot").evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await expect(page.getByRole("heading", { name: "Your library starts here." })).toBeVisible();
  const mascot = page.locator(".library-welcome .library-mascot");
  expect((await mascot.boundingBox())!.height).toBeGreaterThan(0);
  await expect(mascot.locator("img")).toHaveCSS("visibility", "hidden");
  await expect(page.getByRole("main").getByRole("button", { name: "Create page", exact: true })).toBeEnabled();
});
