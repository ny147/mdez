import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

async function showFilesIfAvailable(page: import("@playwright/test").Page) {
  const filesTab = page.getByRole("button", { name: "Files" });

  if (await filesTab.isVisible().catch(() => false)) {
    await filesTab.click();
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

test("imports markdown by paste and previews it", async ({ page }) => {
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByLabel("Paste markdown").fill("# Hello Mdez\n\n- [x] local");
  await page.getByRole("button", { name: "Import Paste" }).click();

  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Hello Mdez");
  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.locator(".markdown-preview").getByRole("heading", { name: "Hello Mdez" })).toBeVisible();
});

test("imports markdown from a file", async ({ page }) => {
  await page.getByRole("button", { name: "Import" }).click();
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
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByLabel("Paste markdown").fill("# Export Me\n\nSaved as markdown.");
  await page.getByRole("button", { name: "Import Paste" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Document", exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("export-me.md");
  await expect(readFile((await download.path())!, "utf8")).resolves.toBe("# Export Me\n\nSaved as markdown.");
});

test("creates nested folders and blocks deleting non-empty folder", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await page.getByRole("button", { name: "Create root folder" }).click();
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
  await page.getByRole("button", { name: "Create root folder" }).click();
  await expect(page.getByRole("button", { name: "Projects", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create folder inside Projects" }).click();
  await expect(page.getByRole("button", { name: "Launch", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Import" }).click();
  await page.getByLabel("Choose markdown files").setInputFiles({
    name: "Checklist.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Checklist\n\n- [ ] Ship")
  });
  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Checklist");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Folder ZIP" }).click();
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
