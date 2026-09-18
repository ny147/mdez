import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, name: "Light" | "Dark") {
  if (await page.locator("html").getAttribute("data-theme") !== name.toLowerCase()) {
    await page.getByRole("button", { name: `Switch to ${name.toLowerCase()} mode`, exact: true }).click();
  }
}

async function mode(page: Page, name: string) {
  const nav = page.locator((page.viewportSize()?.width ?? 1280) <= 767 ? ".mobile-mode-nav" : ".workspace-mode-nav");
  await nav.getByRole("tab", { name, exact: true }).click();
}

test("theme follows the device until an explicit choice is saved", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("initial theme is applied even before the application JavaScript loads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route("**/_next/**/*.js*", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 24, 39)");
});

test("saved choices synchronize across tabs", async ({ page, context }) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await choose(page, "Dark");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await choose(other, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("editing state survives theme changes and midnight layouts remain readable", async ({ page }, info) => {
  await page.goto("/");
  await choose(page, "Dark");
  await page.screenshot({ path: info.outputPath("dark-shelf.png"), fullPage: true });
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill("# Midnight notes\n\nA calm place to write.\n\n```js\nconst idea = 'hello';\n```\n\n> A remembered thought.\n\n| Book | Pages |\n| --- | --- |\n| Ideas | 3 |\n\n$E=mc^2$");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await mode(page, "Edit");
  const editor = page.locator(".cm-content");
  const headingContrast = await editor.locator(".cm-line").first().evaluate((node) => {
    const luminance = (colour: string) => {
      const values = colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((x) => x / 255)
        .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const background = luminance(getComputedStyle(node.closest(".cm-editor")!).backgroundColor);
    return Math.min(...Array.from(node.querySelectorAll("span")).map((span) => {
      const foreground = luminance(getComputedStyle(span).color);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    }));
  });
  expect(headingContrast, "editor heading contrast").toBeGreaterThanOrEqual(4.5);
  await editor.press("Control+End");
  await editor.press("Enter");
  await editor.pressSequentially("A new thought.");
  const content = await editor.innerText();
  const element = await editor.elementHandle();
  const offset = await page.evaluate(() => window.getSelection()?.anchorOffset);
  await choose(page, "Light");
  await choose(page, "Dark");
  expect(await element!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(editor).toHaveText(content, { useInnerText: true });
  await editor.focus();
  expect(await page.evaluate(() => window.getSelection()?.anchorOffset)).toBe(offset);
  await editor.press("Control+z");
  await expect(editor).not.toContainText("A new thought.");
  await page.screenshot({ path: info.outputPath("dark-editor.png"), fullPage: true });
  await mode(page, "Read");
  await expect(page.locator(".markdown-preview pre")).toHaveCSS("background-color", "rgb(13, 20, 34)");
  await page.screenshot({ path: info.outputPath("dark-reader.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await choose(page, "Light");
  await page.screenshot({ path: info.outputPath("light-reader.png"), fullPage: true });
});

test("dark text, accents, and muted covers retain readable contrast", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const pairs = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const luminance = (token: string) => {
      const hex = styles.getPropertyValue(`--color-${token}`).trim().slice(1);
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return [["ink", "paper"], ["muted", "canvas"], ["sidebar-muted", "panel"], ["sidebar-selected-ink", "sidebar-selected"],
      ["edit", "paper"], ["read", "paper"], ["shelf", "paper"], ["on-accent", "edit"], ["on-accent", "shelf"],
      ["code-foreground", "code-background"], ["code-comment", "code-background"], ["reader-muted", "paper"],
      ["resume-muted", "lavender"], ["cover-lilac-ink", "cover-lilac"], ["cover-pink-ink", "cover-pink"],
      ["cover-cyan-ink", "cover-cyan"], ["cover-blue-ink", "cover-blue"]].map(([fg, bg]) => {
        const a = luminance(fg), b = luminance(bg);
        return { pair: `${fg}/${bg}`, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
  });
  for (const pair of pairs) expect(pair.ratio, pair.pair).toBeGreaterThanOrEqual(4.5);
});

test("public shared pages and terminal states expose the same theme choice", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "dark" });
  let status = 200;
  await page.route("**/api/quick-shares/midnight", (route) => route.fulfill({ status, json: status === 200 ? {
    publicId: "midnight", title: "Shared midnight notes", markdown: "# A shared thought\n\nReadable in either theme.",
    createdAt: "2026-09-17T00:00:00Z", expiresAt: null
  } : { error: "Unavailable" } }));
  await page.goto("/share/midnight");
  await expect(page.getByRole("heading", { name: "Shared midnight notes", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: info.outputPath("dark-shared.png"), fullPage: true });
  for (status of [404, 410, 500]) {
    await page.reload();
    await expect(page.getByRole("link", { name: "Open Mdez" })).toBeVisible();
    await choose(page, "Light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await choose(page, "Dark");
  }
});

test("theme toggle supports keyboard activation without opening a menu", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const trigger = page.locator(".theme-trigger");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(trigger).toHaveAccessibleName("Switch to light mode");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("toggling theme dismisses the mobile library drawer", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "The library drawer is a compact-layout interaction.");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open library shelf" }).click();
  await expect(page.locator(".workspace-scrim")).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expect(page.locator(".workspace-scrim")).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
