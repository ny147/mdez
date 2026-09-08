import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function resetBrowserStorage(page: Page) {
  await page.goto("/favicon.ico");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("mdez");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB deletion was blocked"));
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little space for big ideas." })).toBeVisible();
}

async function createLocalPage(page: Page) {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Quick Share", exact: true })).toBeEnabled();
}

async function openEditMode(page: Page) {
  const editTabs = page.getByRole("tab", { name: "Edit", exact: true });
  for (let index = 0; index < await editTabs.count(); index += 1) {
    const tab = editTabs.nth(index);
    if (await tab.isVisible()) {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      return;
    }
  }
  throw new Error("No visible Edit tab was available");
}

async function openSharedLinks(page: Page) {
  const sharedLinks = page.getByRole("button", { name: "Shared links" });
  if (!await sharedLinks.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Open library shelf" }).click();
  }
  await sharedLinks.click();
}

async function mockShareApi(context: BrowserContext, deleteStatus = 204) {
  await context.route("**/api/quick-shares", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON() as { title: string; markdown: string; expiry: string };
    await route.fulfill({
      status: 201,
      json: {
        publicId: "share-1",
        url: `${new URL(route.request().url()).origin}/share/share-1`,
        managementToken: "owner-token",
        title: body.title,
        markdown: body.markdown,
        createdAt: "2026-08-09T00:00:00.000Z",
        expiresAt: body.expiry === "never" ? null : "2026-08-16T00:00:00.000Z"
      }
    });
  });
  await context.route("**/api/quick-shares/share-1", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        json: {
          publicId: "share-1",
          title: "Welcome",
          markdown: [
            "# Shared snapshot",
            ...Array.from(
              { length: 120 },
              (_, index) => `Paragraph ${index + 1}: a long shared page must keep normal browser scrolling.`
            )
          ].join("\n\n"),
          createdAt: "2026-08-09T00:00:00.000Z",
          expiresAt: null
        }
      });
    }
    await route.fulfill({
      status: deleteStatus,
      ...(deleteStatus === 204 ? {} : { json: { error: "Could not delete shared page" } })
    });
  });
}

test.beforeEach(async ({ page }) => {
  await resetBrowserStorage(page);
});

test("creates, opens, and deletes a view-only snapshot", async ({ page, context }) => {
  await mockShareApi(context);
  await createLocalPage(page);
  await page.getByRole("button", { name: "Quick Share", exact: true }).click();
  await page.getByRole("combobox", { name: "Link expiration" }).selectOption("never");
  await page.getByRole("button", { name: "Create view-only link" }).click();
  await expect(page.getByLabel("Public URL")).toHaveValue(/\/share\/share-1$/);

  const shared = await context.newPage();
  await shared.goto("/share/share-1");
  await expect(shared.getByRole("heading", { name: "Shared snapshot" })).toBeVisible();
  await expect(shared.getByRole("textbox")).toHaveCount(0);
  expect(await shared.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(
    await shared.evaluate(() => document.documentElement.clientHeight)
  );
  await shared.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => shared.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await shared.close();

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await openSharedLinks(page);
  await page.getByRole("button", { name: "Delete untitled.md shared link" }).click();
  await page.getByRole("button", { name: "Delete link" }).click();
  await expect(page.getByText("No shared links yet")).toBeVisible();
});

test("defaults new links to seven days", async ({ page }) => {
  await createLocalPage(page);
  await page.getByRole("button", { name: "Quick Share", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Link expiration" })).toHaveValue("7d");
});

for (const [status, message] of [
  [410, "This shared page has expired"],
  [404, "Shared page not found"]
] as const) {
  test(`shows the public terminal state for ${status}`, async ({ page }) => {
    await page.route("**/api/quick-shares/missing", (route) => route.fulfill({ status, json: {} }));
    await page.goto("/share/missing");
    await expect(page.getByRole("heading", { name: message })).toBeVisible();
  });
}

test("failed deletion keeps its creator-owned local row", async ({ page, context }) => {
  await mockShareApi(context, 500);
  await createLocalPage(page);
  await page.getByRole("button", { name: "Quick Share", exact: true }).click();
  await page.getByRole("button", { name: "Create view-only link" }).click();
  await expect(page.getByLabel("Public URL")).toHaveValue(/\/share\/share-1$/);
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await openSharedLinks(page);
  await page.getByRole("button", { name: "Delete untitled.md shared link" }).click();
  await page.getByRole("button", { name: "Delete link" }).click();
  await expect(page.getByRole("dialog").getByRole("alert"))
    .toHaveText("Could not delete shared page");
  await expect(page.getByRole("dialog").getByRole("heading", {
    name: "untitled.md",
    exact: true
  })).toBeVisible();
});

test("shows the five MiB rejection without storing a link", async ({ page, context }) => {
  await createLocalPage(page);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mdez");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("documents", "readwrite");
    const store = transaction.objectStore("documents");
    const documents = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        ...documents[0],
        body: "x".repeat(5 * 1024 * 1024 + 1)
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    database.close();
  });
  await page.reload();
  await openEditMode(page);
  await expect(page.getByRole("button", { name: "Quick Share", exact: true })).toBeEnabled();

  await context.route("**/api/quick-shares", async (route) => {
    const body = route.request().postDataJSON() as { markdown: string };
    expect(new TextEncoder().encode(body.markdown).byteLength).toBeGreaterThan(5 * 1024 * 1024);
    await route.fulfill({
      status: 413,
      json: { error: "Markdown must be 5 MiB or smaller" }
    });
  });
  await page.getByRole("button", { name: "Quick Share", exact: true }).click();
  await page.getByRole("button", { name: "Create view-only link" }).click();
  await expect(page.getByRole("dialog").getByRole("alert"))
    .toHaveText("Markdown must be 5 MiB or smaller");
});
