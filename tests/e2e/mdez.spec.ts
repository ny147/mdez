import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

async function showFilesIfAvailable(page: import("@playwright/test").Page) {
  const filesTab = page.getByRole("button", { name: "Files" });

  if (await filesTab.isVisible().catch(() => false)) {
    await filesTab.click();
  }
}

async function clickVisibleButtonIfAvailable(page: import("@playwright/test").Page, name: string) {
  const buttons = page.getByRole("button", { name, exact: true });
  const buttonCount = await buttons.count();

  for (let index = 0; index < buttonCount; index += 1) {
    const button = buttons.nth(index);

    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/favicon.ico");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("mdez");

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Timed out deleting the mdez IndexedDB database."));
    });
  });
  await page.goto("/");
});

test("fresh workspace exposes visible create and import actions", async ({ page }) => {
  const filesArea = page.locator("aside");

  await expect(filesArea).toBeVisible();
  await expect(filesArea.getByRole("button", { name: "New document", exact: true })).toBeVisible();
  await expect(filesArea.getByRole("button", { name: "Create document", exact: true })).toBeVisible();
  await expect(filesArea.getByRole("button", { name: "Import markdown", exact: true })).toBeVisible();
  await expect(filesArea.getByText("Create folders when this library grows.")).toBeVisible();
  await expect(filesArea.getByText("New folder", { exact: true })).toBeVisible();

  await filesArea.getByRole("button", { name: "New document", exact: true }).click();

  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Untitled Document");
});

test("no-document editor and reader states expose recovery actions", async ({ page }) => {
  await clickVisibleButtonIfAvailable(page, "Edit");

  const editor = page.locator("article").filter({ hasText: "Editor" });

  await expect(editor).toBeVisible();
  await expect(editor.getByText("No document selected", { exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Create document", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Import markdown", exact: true })).toBeVisible();

  await clickVisibleButtonIfAvailable(page, "Read");

  const reader = page.locator("article").filter({ hasText: "Reader" });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("button", { name: "Create document", exact: true })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Import markdown", exact: true })).toBeVisible();
});

test("root selection labels folder ZIP export but keeps it disabled", async ({ page }) => {
  const filesArea = page.locator("aside");
  const sidebarZipButton = filesArea.getByRole("button", { name: "Folder ZIP for selected folder in Files", exact: true });

  await expect(filesArea).toBeVisible();
  await expect(sidebarZipButton).toBeVisible();
  await expect(sidebarZipButton).toBeDisabled();
});

test("imports markdown by paste and previews it", async ({ page }) => {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Paste markdown").fill("# Hello Mdez\n\n- [x] local");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();

  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Hello Mdez");
  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.locator(".markdown-preview").getByRole("heading", { name: "Hello Mdez" })).toBeVisible();
});

test("preview prose uses reader typography while markdown code stays monospaced", async ({ page }) => {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Paste markdown").fill("# Typography\n\nReadable prose with `inlineCode`.\n\n```ts\nconst value = 1;\n```");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();
  await page.getByRole("button", { name: "Read" }).click();

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

test("imports markdown from a file", async ({ page }) => {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Choose markdown files").setInputFiles({
    name: "Release Notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# File Import\n\nLoaded from disk.")
  });

  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Release Notes");
  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.locator(".markdown-preview").getByRole("heading", { name: "File Import" })).toBeVisible();
});

test("exports the selected document as markdown", async ({ page }) => {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Paste markdown").fill("# Export Me\n\nSaved as markdown.");
  await page.getByRole("button", { name: "Import Paste", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Document", exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("export-me.md");
  await expect(readFile((await download.path())!, "utf8")).resolves.toBe("# Export Me\n\nSaved as markdown.");
});

test("creates nested folders and blocks deleting non-empty folder", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await page.getByRole("button", { name: "New folder - create root folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Projects", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create folder inside Projects" }).click();
  await expect(page.getByRole("button", { name: "Launch", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create document" }).click();
  await showFilesIfAvailable(page);
  await page.getByRole("button", { name: "Delete Projects" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Move or delete nested folders" })).toBeVisible();
});

test("exports a nested folder ZIP rooted at the selected folder", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await page.getByRole("button", { name: "New folder - create root folder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Projects", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create folder inside Projects" }).click();
  await expect(page.getByRole("button", { name: "Launch", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Choose markdown files").setInputFiles({
    name: "Checklist.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Checklist\n\n- [ ] Ship")
  });
  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Checklist");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("aside").getByRole("button", { name: "Folder ZIP for selected folder in Files", exact: true }).click();
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
  await page.getByRole("button", { name: "Create document" }).click();
  await page.locator(".cm-content").fill("# Persisted\n\nSaved locally.");
  await expect(page.locator(".cm-content")).toContainText("Persisted");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 3000 });

  await page.reload();
  await expect(page.locator(".cm-content")).toContainText("Persisted");
});

test("switches editor, split, and preview modes", async ({ page }) => {
  await page.getByRole("button", { name: "Create document" }).click();
  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.getByText("Reader", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  const splitButton = page.getByRole("button", { name: "Split" });

  if (await splitButton.isVisible().catch(() => false)) {
    await splitButton.click();
    await expect(page.locator(".cm-editor")).toBeVisible();
    await expect(page.getByText("Reader", { exact: true })).toBeVisible();
  }
});
