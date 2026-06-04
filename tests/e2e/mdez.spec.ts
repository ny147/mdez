import { expect, test } from "@playwright/test";

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
