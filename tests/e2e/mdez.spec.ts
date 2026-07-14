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
        await control.click();
        if (role === "tab") {
          await expect(control).toHaveAttribute("aria-selected", "true");
        }
        return;
      }
    }
  }
}
async function makeGitHubArchive(entries: Record<string, string>) {
  const zip = new JSZip();

  for (const [path, body] of Object.entries(entries)) {
    zip.file(path, body);
  }

  return zip.generateAsync({ type: "nodebuffer" });
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

test("desktop sidebar can reopen and restores its state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });
  const sidebar = page.locator('aside[aria-label="Library shelf"]');

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "Toggle sidebar" })).toHaveAttribute("aria-expanded", "false");
});

test("mobile drawer makes the workspace inert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Open library shelf" });
  const sidebar = page.locator('aside[aria-label="Library shelf"]');

  await expect(trigger).toHaveAttribute("aria-controls", "library-shelf");
  await expect(sidebar).toHaveAttribute("id", "library-shelf");
  await trigger.click();

  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await expect(page.getByTestId("workspace-main")).toHaveAttribute("inert", "");
  await expect(page.locator('footer[aria-label="Workspace status"]')).toHaveAttribute("inert", "");
  await expect(page.locator("nav.mobile-mode-nav")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  await expect(trigger).toBeFocused();
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

test("import source tabs expose only the active input", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Bring notes into Mdez" });

  await expect(dialog.getByRole("textbox", { name: "Paste markdown" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Public repository URL" })).toBeHidden();

  await dialog.getByRole("tab", { name: "Public GitHub" }).click();

  await expect(dialog.getByRole("textbox", { name: "Paste markdown" })).toBeHidden();
  await expect(dialog.getByRole("textbox", { name: "Public repository URL" })).toBeVisible();
});

test("import source tabs support arrows and the dialog restores focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Import markdown", exact: true }).last();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Bring notes into Mdez" });
  const pasteTab = dialog.getByRole("tab", { name: "Paste" });
  const filesTab = dialog.getByRole("tab", { name: "Markdown files" });
  const githubTab = dialog.getByRole("tab", { name: "Public GitHub" });

  await pasteTab.press("ArrowRight");
  await expect(filesTab).toHaveAttribute("aria-selected", "true");
  await expect(filesTab).toBeFocused();

  await filesTab.press("End");
  await expect(githubTab).toHaveAttribute("aria-selected", "true");
  await expect(githubTab).toBeFocused();

  await dialog.getByRole("button", { name: "Close import dialog" }).click();
  await expect(trigger).toBeFocused();
  const workspaceShell = page.getByTestId("workspace-shell");
  await expect(workspaceShell.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
  await expect(workspaceShell.locator('[role="alert"]')).toHaveCount(0);
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

test("imports a public GitHub repository through preview and persists its source", async ({ page }) => {
  const archive = await makeGitHubArchive({
    "codex-main/readme.md": "# Read me",
    "codex-main/docs/guide.md": "# Guide",
    "codex-main/.obsidian/workspace.json": "{}"
  });
  let requestedUrl = "";

  await page.route("**/api/github/archive", async (route) => {
    requestedUrl = (route.request().postDataJSON() as { url: string }).url;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/zip",
        "x-mdez-default-branch": "main",
        "x-mdez-repository-url": "https://github.com/openai/codex"
      },
      body: archive
    });
  });

  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Bring notes into Mdez" });
  await dialog.getByRole("tab", { name: "Public GitHub" }).click();
  await dialog.getByRole("textbox", { name: "Public repository URL" }).fill("https://github.com/openai/codex");
  await dialog.getByRole("button", { name: "Preview repository" }).click();

  await expect(dialog.getByRole("heading", { name: "codex", exact: true })).toBeVisible();
  await expect(dialog.getByText("main", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2 Markdown files", { exact: true })).toBeVisible();
  await expect(dialog.getByText("1 ignored file", { exact: true })).toBeVisible();
  await expect(dialog.getByText("docs", { exact: true })).toBeVisible();
  expect(requestedUrl).toBe("https://github.com/openai/codex");

  await dialog.getByRole("button", { name: "Import repository" }).click();

  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("guide");
  await openShelfDrawerIfAvailable(page);
  await expect(page.getByText("Public GitHub \u00b7 main", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh from GitHub" })).toBeVisible();

  await page.reload();
  await openShelfDrawerIfAvailable(page);
  await expect(page.getByRole("treeitem", { name: /docs book/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh from GitHub" })).toBeVisible();
});

test("shows a typed GitHub error and lets the preview retry", async ({ page }) => {
  const archive = await makeGitHubArchive({ "codex-main/readme.md": "# Read me" });
  let requestCount = 0;

  await page.route("**/api/github/archive", async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "rate_limited", message: "GitHub is busy. Try again shortly." }
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/zip",
        "x-mdez-default-branch": "main",
        "x-mdez-repository-url": "https://github.com/openai/codex"
      },
      body: archive
    });
  });

  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Bring notes into Mdez" });
  await dialog.getByRole("tab", { name: "Public GitHub" }).click();
  await dialog.getByRole("textbox", { name: "Public repository URL" }).fill("https://github.com/openai/codex");
  await dialog.getByRole("button", { name: "Preview repository" }).click();

  await expect(dialog.getByText("GitHub is busy. Try again shortly.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Preview repository" }).click();
  await expect(dialog.getByRole("button", { name: "Import repository" })).toBeEnabled();
  expect(requestCount).toBe(2);
});

test("confirms manual GitHub refresh before replacing source-owned pages", async ({ page }) => {
  let archive = await makeGitHubArchive({ "codex-main/readme.md": "# Before refresh" });
  let requestCount = 0;

  let failRefresh = false;
  await page.route("**/api/github/archive", async (route) => {
    requestCount += 1;
    if (failRefresh) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "upstream_error", message: "GitHub could not refresh right now." }
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/zip",
        "x-mdez-default-branch": "main",
        "x-mdez-repository-url": "https://github.com/openai/codex"
      },
      body: archive
    });
  });

  await page.getByRole("button", { name: "Import markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Bring notes into Mdez" });
  await dialog.getByRole("tab", { name: "Public GitHub" }).click();
  await dialog.getByRole("textbox", { name: "Public repository URL" }).fill("https://github.com/openai/codex");
  await dialog.getByRole("button", { name: "Preview repository" }).click();
  await dialog.getByRole("button", { name: "Import repository" }).click();

  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await page.getByRole("button", { name: "Refresh from GitHub" }).click();
  expect(requestCount).toBe(1);

  archive = await makeGitHubArchive({ "codex-main/readme.md": "# After refresh" });
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Refresh from GitHub" }).click();

  await expect(page.locator(".cm-content")).toContainText("After refresh");
  await expect(page.getByRole("status").filter({ hasText: "Refreshed openai/codex from GitHub" })).toBeVisible();
  expect(requestCount).toBe(2);

  failRefresh = true;
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Refresh from GitHub" }).click();
  await expect(page.getByRole("status").filter({ hasText: "GitHub could not refresh right now." })).toBeVisible();

  await page.reload();
  await clickVisibleButtonIfAvailable(page, "Edit");
  await expect(page.locator(".cm-content")).toContainText("After refresh");
  expect(requestCount).toBe(3);
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
  await expect(
    page.getByRole("complementary", { name: "Library shelf" }).getByText("Move or delete nested books and pages", { exact: false })
  ).toBeVisible();
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
