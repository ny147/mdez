import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const PREVIEW_MESSAGE = "Sharing is unavailable in this preview. Your local library still works.";
const VALID_GROUP_KEY = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";

test.skip(process.env.VERCEL_ENV !== "preview", "Preview-only boundary test");

async function expectPreviewDenial(
  request: APIRequestContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string
) {
  const response = await request.fetch(path, {
    method,
    data: method === "GET" ? undefined : { synthetic: true }
  });

  expect(response.status(), `${method} ${path}`).toBe(503);
  expect(response.headers()["cache-control"], `${method} ${path}`).toBe("no-store");
  expect(await response.json(), `${method} ${path}`).toEqual({ error: PREVIEW_MESSAGE });
}

async function openShelfDrawerIfAvailable(page: Page) {
  const trigger = page.getByRole("button", { name: "Open library shelf" });
  if (await trigger.isVisible().catch(() => false)) await trigger.click();
}

async function openEditMode(page: Page) {
  const tabs = page.getByRole("tab", { name: "Edit", exact: true });
  for (let index = 0; index < await tabs.count(); index += 1) {
    const tab = tabs.nth(index);
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      return;
    }
  }
  throw new Error("No visible Edit tab was available");
}

test("blocks every sharing and cleanup API family without database configuration", async ({ request }) => {
  const requests = [
    ["POST", "/api/quick-shares"],
    ["GET", "/api/quick-shares/synthetic-share"],
    ["DELETE", "/api/quick-shares/synthetic-share"],
    ["POST", "/api/key-groups"],
    ["POST", "/api/key-groups/join"],
    ["GET", "/api/key-groups/synthetic-group"],
    ["PATCH", "/api/key-groups/synthetic-group"],
    ["DELETE", "/api/key-groups/synthetic-group"],
    ["GET", "/api/key-groups/synthetic-group/changes?after=0"],
    ["PATCH", "/api/key-groups/synthetic-group/documents/synthetic-document"],
    ["GET", "/api/cron/quick-shares"],
    ["GET", "/api/cron/key-groups"]
  ] as const;

  for (const [method, path] of requests) {
    await expectPreviewDenial(request, method, path);
  }
});

test("keeps the local workspace usable while sharing dialogs explain the boundary", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.locator(".cm-content").fill("# Preview local page\n\nA unique local-only marker.");
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3_000 });

  await page.reload();
  await openEditMode(page);
  await expect(page.locator(".cm-content")).toContainText("A unique local-only marker.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .md", exact: true }).click();
  const download = await downloadPromise;
  await expect(readFile((await download.path())!, "utf8")).resolves.toContain("A unique local-only marker.");

  await page.getByRole("button", { name: "Quick Share", exact: true }).click();
  await page.getByRole("button", { name: "Create view-only link" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(PREVIEW_MESSAGE);
  await page.getByRole("button", { name: "Close Quick Share dialog" }).click();

  await openShelfDrawerIfAvailable(page);
  await page.getByRole("button", { name: /Current workspace:/ }).click();
  await page.getByRole("button", { name: "Create group" }).click();
  await page.getByRole("textbox", { name: "Group name" }).fill("Preview audit");
  await page.getByRole("button", { name: "Create and copy Local Library" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(PREVIEW_MESSAGE);
  await page.getByRole("button", { name: "Close group creation" }).click();

  await openShelfDrawerIfAvailable(page);
  await page.getByRole("button", { name: /Current workspace:/ }).click();
  await page.getByRole("button", { name: "Join group" }).click();
  await page.getByLabel("Group key").fill(VALID_GROUP_KEY);
  await page.getByRole("button", { name: "Join group", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(PREVIEW_MESSAGE);

  await page.goto("/share/synthetic-share");
  await expect(page.getByRole("heading", { name: "Sharing unavailable" })).toBeVisible();
  await expect(page.getByText("Sharing is unavailable on this deployment. Your local library still works.")).toBeVisible();
});
