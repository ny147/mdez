import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

async function showShelfIfAvailable(page: import("@playwright/test").Page) {
  const shelfTabs = page.getByRole("tab", { name: "Shelf", exact: true });
  const shelfTabCount = await shelfTabs.count();

  for (let index = 0; index < shelfTabCount; index += 1) {
    const shelfTab = shelfTabs.nth(index);

    if (await shelfTab.isVisible().catch(() => false)) {
      await shelfTab.evaluate((element) => (element as HTMLElement).click());
      return;
    }
  }
}


async function openShelfDrawerIfAvailable(page: import("@playwright/test").Page) {
  const trigger = page.getByRole("button", { name: "Open library shelf" });
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
  }
}
async function clickVisibleButtonIfAvailable(page: import("@playwright/test").Page, name: string) {
  for (const role of ["tab", "button"] as const) {
    const controls = page.getByRole(role, { name, exact: true });
    const controlCount = await controls.count();

    for (let index = 0; index < controlCount; index += 1) {
      const control = controls.nth(index);

      if (await control.isVisible().catch(() => false)) {
        await control.evaluate((element) => (element as HTMLElement).click());
        return;
      }
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/favicon.ico");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("mdez");
      const timeout = window.setTimeout(() => {
        reject(new Error("Timed out deleting the mdez IndexedDB database."));
      }, 5000);

      request.onsuccess = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      request.onerror = () => {
        window.clearTimeout(timeout);
        reject(request.error);
      };
      request.onblocked = () => {
        window.clearTimeout(timeout);
        reject(new Error("Blocked deleting the mdez IndexedDB database."));
      };
    });
  });
  await page.goto("/");
});



test("uses the renewed light library shell and mode accents", async ({ page }) => {
  const shell = page.getByTestId("workspace-shell");

  await expect(shell).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace modes" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workspace status" })).toBeVisible();

  const colors = await shell.evaluate((node) => {
    const style = getComputedStyle(node);
    return ["--bg", "--accent", "--accent-read", "--accent-files"].map((name) => style.getPropertyValue(name).trim());
  });

  expect(colors).toEqual(["#fff7fc", "#8053c8", "#177f71", "#b8487a"]);

  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector("h1")!).fontFamily
  }));

  expect(fonts.body).toContain("Inter");
  expect(fonts.heading).toContain("Space Grotesk");
});

test("desktop sidebar state is restored", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "Toggle sidebar" })).toHaveAttribute("aria-expanded", "false");
});

test("mobile drawer makes the workspace inert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open library shelf" }).click();

  await expect(page.getByRole("complementary", { name: "Library shelf" })).toHaveAttribute("aria-hidden", "false");
  await expect(page.getByTestId("workspace-main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator('aside[aria-label="Library shelf"]')).toHaveAttribute("aria-hidden", "true");
});
test("fresh workspace exposes visible create and import actions", async ({ page }) => {
  const createPage = page.getByRole("button", { name: "Create page", exact: true }).last();
  const importMarkdown = page.getByRole("button", { name: "Import markdown", exact: true }).last();
  const newBook = page.getByRole("button", { name: "New book", exact: true }).last();

  await expect(createPage).toBeVisible();
  await expect(importMarkdown).toBeVisible();
  await expect(page.getByText("Create books when this shelf grows.").last()).toBeVisible();
  await expect(newBook).toBeVisible();

  await createPage.click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("untitled.md");
});

test("no-document editor and reader states expose recovery actions", async ({ page }) => {
  await clickVisibleButtonIfAvailable(page, "Edit");

  const editor = page.locator("article").filter({ hasText: "Editor" });

  await expect(editor).toBeVisible();
  await expect(editor.getByText("No page selected", { exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Create page", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Import markdown", exact: true })).toBeVisible();

  await clickVisibleButtonIfAvailable(page, "Read");

  const reader = page.locator("article").filter({ hasText: "Reader" });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("button", { name: "Create page", exact: true })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Import markdown", exact: true })).toBeVisible();
});

test("root selection labels folder ZIP export but keeps it disabled", async ({ page }) => {
  const bookZipButton = page.getByRole("button", { name: "Book ZIP for open book in Shelf", exact: true }).last();

  await expect(bookZipButton).toBeVisible();
  await expect(bookZipButton).toBeDisabled();
});

test("one open book controls shelf context", async ({ page }) => {
  await openShelfDrawerIfAvailable(page);

  page.once("dialog", (dialog) => dialog.accept("Writing"));
  await page.getByRole("button", { name: "New book - create shelf book", exact: true }).click();
  await page.getByRole("complementary", { name: "Library shelf" }).getByRole("button", { name: "Create page in Writing", exact: true }).click();
  await showShelfIfAvailable(page);

  await expect(page.getByRole("button", { name: "Writing book, 1 page, open", exact: true }).first())
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "New book on shelf", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book ZIP for open book in Shelf", exact: true }).first()).toBeEnabled();
  await expect(page.getByRole("list", { name: "Bookmarked pages" }).getByRole("listitem")).toHaveCount(1);
});



test("editor exposes the renewed markdown toolbar", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });

  for (const name of ["Bold", "Italic", "Insert link", "Insert image", "Code", "Heading 1", "Heading 2", "Divider", "Export .md"]) {
    await expect(toolbar.getByRole("button", { name })).toBeVisible();
  }
});
test("imports markdown by paste and previews it", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  await page.getByLabel("Paste markdown").fill("# Hello Mdez\n\n- [x] local");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();

  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Hello Mdez");
  await page.getByRole("tab", { name: "Read" }).click();
  await expect(page.locator(".markdown-preview").getByRole("heading", { name: "Hello Mdez" })).toBeVisible();
});

test("preview prose uses reader typography while markdown code stays monospaced", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  await page.getByLabel("Paste markdown").fill("# Typography\n\nReadable prose with `inlineCode`.\n\n```ts\nconst value = 1;\n```");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();
  await page.getByRole("tab", { name: "Read" }).click();

  const preview = page.locator(".markdown-preview");
  const paragraph = preview.getByText("Readable prose with", { exact: false });
  const inlineCode = preview.locator("p code");
  const blockCode = preview.locator("pre code");

  await expect(preview).toBeVisible();
  await expect(paragraph).toBeVisible();
  await expect(inlineCode).toBeVisible();
  await expect(blockCode).toBeVisible();

  const paragraphFamily = await paragraph.evaluate((node) => getComputedStyle(node).fontFamily);
  const inlineCodeFamily = await inlineCode.evaluate((node) => getComputedStyle(node).fontFamily);
  const blockCodeFamily = await blockCode.evaluate((node) => getComputedStyle(node).fontFamily);
  const previewMaxWidth = await preview.evaluate((node) => getComputedStyle(node).maxWidth);

  expect(paragraphFamily).not.toMatch(/JetBrains|Consolas|monospace/i);
  expect(inlineCodeFamily).toMatch(/JetBrains|Consolas|monospace/i);
  expect(blockCodeFamily).toMatch(/JetBrains|Consolas|monospace/i);
  expect(previewMaxWidth).not.toBe("none");
  expect(previewMaxWidth).not.toBe("");
});



test("reader table of contents is inert when closed and keyboard safe when open", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  await page.getByLabel("Paste markdown").fill("# Quiet shell\n\n## Mode behavior\n\nReader copy.");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();
  await clickVisibleButtonIfAvailable(page, "Read");

  const toc = page.locator('nav[aria-label="Table of contents"]');
  await expect(toc).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Open table of contents" }).click();
  await expect(toc).not.toHaveAttribute("inert", "");
  await expect(toc.getByRole("link", { name: "Quiet shell" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toc).toHaveAttribute("inert", "");
});
test("imports markdown from a file", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  await page.getByLabel("Choose markdown files").setInputFiles({
    name: "Release Notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# File Import\n\nLoaded from disk.")
  });

  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Release Notes");
  await page.getByRole("tab", { name: "Read" }).click();
  await expect(page.locator(".markdown-preview").getByRole("heading", { name: "File Import" })).toBeVisible();
});

test("exports the selected document as markdown", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  await page.getByLabel("Paste markdown").fill("# Export Me\n\nSaved as markdown.");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .md", exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("export-me.md");
  await expect(readFile((await download.path())!, "utf8")).resolves.toBe("# Export Me\n\nSaved as markdown.");
});

test("creates nested folders and blocks deleting non-empty folder", async ({ page }) => {
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await page.getByRole("button", { name: "New book - create shelf book", exact: true }).click();
  await expect(page.getByRole("treeitem", { name: "Projects book, 0 pages, open", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create book inside Projects" }).click();
  await expect(page.getByRole("treeitem", { name: "Launch book, 0 pages, open", exact: true })).toBeVisible();

  await page.getByRole("complementary", { name: "Library shelf" }).getByRole("button", { name: "Create page in Launch", exact: true }).click();
  await showShelfIfAvailable(page);
  await openShelfDrawerIfAvailable(page);
  await page.getByRole("button", { name: "Delete Projects" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Move or delete nested books and pages" })).toBeVisible();
});

test("exports a nested folder ZIP rooted at the selected folder", async ({ page }) => {
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await page.getByRole("button", { name: "New book - create shelf book", exact: true }).click();
  await expect(page.getByRole("treeitem", { name: "Projects book, 0 pages, open", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create book inside Projects" }).click();
  await expect(page.getByRole("treeitem", { name: "Launch book, 0 pages, open", exact: true })).toBeVisible();

  await page.getByRole("complementary", { name: "Library shelf" }).getByRole("button", { name: "Import markdown", exact: true }).click();
  await page.getByLabel("Choose markdown files").setInputFiles({
    name: "Checklist.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Checklist\n\n- [ ] Ship")
  });
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Checklist");
  await showShelfIfAvailable(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Book ZIP for open book in Shelf", exact: true }).last().click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));

  expect(download.suggestedFilename()).toBe("launch.zip");
  await expect(zip.file("launch/checklist.md")?.async("string")).resolves.toBe("# Checklist\n\n- [ ] Ship");
  expect(zip.file("projects/launch/checklist.md")).toBeNull();

  const manifest = JSON.parse(await zip.file("launch/manifest.json")!.async("string"));
  expect(manifest.exportedFolderId).toBeTruthy();
  expect(manifest.folders).toHaveLength(1);
  expect(manifest.folders[0].name).toBe("Launch");
  expect(manifest.documents).toHaveLength(1);
  expect(manifest.documents[0].title).toBe("Checklist");
});

test("edits a document and reloads with local persistence", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.locator(".cm-content").fill("# Persisted\n\nSaved locally.");
  await expect(page.locator(".cm-content")).toContainText("Persisted");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 3000 });

  await page.reload();
  await clickVisibleButtonIfAvailable(page, "Edit");
  await expect(page.locator(".cm-content")).toContainText("Persisted");
});



test("split separator resizes from 30 to 70 percent", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickVisibleButtonIfAvailable(page, "Split");

  const separator = page.getByRole("separator", { name: "Resize editor and reader panes" });
  await expect(separator).toHaveAttribute("aria-valuenow", "50");
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "55");
  await page.keyboard.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", "70");
  await page.keyboard.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", "30");
});
test("switches editor, split, and preview modes", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("tab", { name: "Read" }).click();
  await expect(page.getByText("Reader", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Edit" }).click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  const splitButton = page.getByRole("tab", { name: "Split" });

  if (await splitButton.isVisible().catch(() => false)) {
    await splitButton.click();
    await expect(page.locator(".cm-editor")).toBeVisible();
    await expect(page.getByText("Reader", { exact: true })).toBeVisible();
  }
});


















for (const width of [390, 430, 768, 1024, 1440]) {
  test(`workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await showShelfIfAvailable(page);
    const size = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth
    ]);
    expect(size[1]).toBe(size[0]);
  });
}

test("inactive workspace surfaces are removed from interaction", async ({ page }) => {
  await clickVisibleButtonIfAvailable(page, "Read");
  await expect(page.getByTestId("screen-editor")).toHaveCount(0);
  await expect(page.getByTestId("screen-reader")).toBeVisible();
});
