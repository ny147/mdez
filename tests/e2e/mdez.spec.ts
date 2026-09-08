import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

async function showShelfIfAvailable(page: import("@playwright/test").Page) {
  const sidebar = page.locator('aside[aria-label="Library shelf"]');
  const closeDrawer = sidebar.getByRole("button", { name: "Close library shelf" });
  if (await closeDrawer.isVisible().catch(() => false)) {
    await closeDrawer.click();
    await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  }

  const shelfTabs = page.getByRole("tab", { name: "Shelf", exact: true });
  const shelfTabCount = await shelfTabs.count();

  for (let index = 0; index < shelfTabCount; index += 1) {
    const shelfTab = shelfTabs.nth(index);

    if (await shelfTab.isVisible().catch(() => false)) {
      if ((await shelfTab.getAttribute("aria-selected")) !== "true") {
        await shelfTab.evaluate((element) => (element as HTMLElement).click());
      }
      await expect(shelfTab).toHaveAttribute("aria-selected", "true");
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
async function clickViewportModeTab(page: import("@playwright/test").Page, name: string) {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  const navigation = page.locator(viewportWidth <= 767 ? ".mobile-mode-nav" : ".workspace-mode-nav");
  const control = navigation.getByRole("tab", { name, exact: true });

  if ((await control.getAttribute("aria-selected")) !== "true") {
    await control.click();
  }
  await expect(control).toHaveAttribute("aria-selected", "true");
}

async function expectModeReady(page: import("@playwright/test").Page, mode: "Shelf" | "Edit" | "Read" | "Split") {
  if (mode === "Edit") {
    await expect(page.getByTestId("screen-editor")).toBeVisible();
    await expect(page.locator(".cm-editor")).toBeVisible();
  }

  if (mode === "Read") {
    await expect(page.getByTestId("screen-reader")).toBeVisible();
    await expect(page.getByText("Reader", { exact: true })).toBeVisible();
  }

  if (mode === "Split") {
    const split = page.locator(".split-workspace");
    await expect(split).toBeVisible();
    await expect(page.locator(".cm-editor")).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) <= 767) {
      await expect(split.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
    } else {
      await expect(page.getByText("Reader", { exact: true })).toBeVisible();
    }
  }
}

async function expectInsideViewport(locator: Locator, viewportWidth: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
}

async function expectMinimumTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
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



test("uses the accepted spacious library shell and typography", async ({ page }) => {
  const shell = page.getByTestId("workspace-shell");

  await expect(shell).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Workspace modes" }).first()).toBeAttached();
  await expect(page.getByRole("contentinfo", { name: "Workspace status" })).toBeVisible();

  const colors = await shell.evaluate((node) => {
    const style = getComputedStyle(node);
    return ["--color-canvas", "--color-panel", "--color-ink", "--color-muted", "--color-edit", "--color-rule"].map((name) =>
      style.getPropertyValue(name).trim()
    );
  });

  expect(colors).toEqual(["#fbfafc", "#f3f0f8", "#292735", "#706c7c", "#7052b8", "#e9e6ee"]);

  const presentation = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
    topbarHeight: getComputedStyle(document.querySelector(".workspace-topbar")!).height,
    sidebarWidth: getComputedStyle(document.querySelector(".workspace-sidebar")!).width
  }));

  expect(presentation.body).toContain("DM Sans");
  expect(presentation.heading).toContain("Manrope");
  expect(presentation.topbarHeight).toBe("80px");
  if (await page.evaluate(() => window.innerWidth >= 1024)) {
    expect(presentation.sidebarWidth).toBe("238px");
  }
});

test("workspace polish distinguishes primary actions and active modes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const shelfCreate = page.getByRole("main").getByRole("button", { name: "Create page", exact: true });
  const sidebarCreate = page
    .getByRole("complementary", { name: "Library shelf" })
    .locator('button[data-visual-priority="secondary"]');

  await expect(shelfCreate).toHaveAttribute("data-visual-priority", "primary");
  await expect(sidebarCreate).toHaveAttribute("data-visual-priority", "secondary");

  const shelfTab = page.getByRole("tab", { name: "Shelf", exact: true }).first();
  await expect(shelfTab).toHaveAttribute("data-active-treatment", "filled");
  const style = await shelfTab.evaluate((node) => {
    const computed = getComputedStyle(node);
    return { background: computed.backgroundColor, border: computed.borderColor };
  });

  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.border).not.toBe("rgba(0, 0, 0, 0)");
});

test("workspace mode tabs expose their panel and support roving keyboard focus", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });

    const tablist = page.locator(width <= 767 ? ".mobile-mode-nav" : ".workspace-mode-nav");
    const shelfTab = tablist.getByRole("tab", { name: "Shelf", exact: true });
    const editTab = tablist.getByRole("tab", { name: "Edit", exact: true });
    const readTab = tablist.getByRole("tab", { name: "Read", exact: true });

    await expect(tablist).toHaveRole("tablist");
    await expect(tablist).toHaveAccessibleName("Workspace modes");
    await expect(shelfTab).toHaveAttribute("tabindex", "0");
    await expect(editTab).toHaveAttribute("tabindex", "-1");

    const panelId = await shelfTab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    await expect(page.locator(`#${panelId}`)).toHaveRole("tabpanel");
    await expect(page.locator(`#${panelId}`)).toHaveAttribute("aria-labelledby", await shelfTab.getAttribute("id") as string);

    await shelfTab.focus();
    await shelfTab.press("ArrowRight");
    await expect(editTab).toBeFocused();
    await expect(editTab).toHaveAttribute("aria-selected", "true");
    await expect(editTab).toHaveAttribute("tabindex", "0");

    await editTab.press("End");
    const lastTab = tablist.getByRole("tab").last();
    await expect(lastTab).toBeFocused();
    await expect(lastTab).toHaveAttribute("aria-selected", "true");

    await lastTab.press("Home");
    await expect(shelfTab).toBeFocused();
    await expect(shelfTab).toHaveAttribute("aria-selected", "true");
    await expect(readTab).toHaveAttribute("tabindex", "-1");
  }
});

test("book hierarchy uses nested lists with explicit selection and expansion states", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const books = sidebar.getByRole("list", { name: "Books and pages" });

  await expect(books).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Unsorted pages, \d+ pages, closed/ })).toHaveAttribute("aria-pressed", "false");

  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await sidebar.getByRole("button", { name: "Create book", exact: true }).click();
  const projects = books.getByTitle("Open Projects book");
  await expect(projects).toHaveAttribute("aria-pressed", "true");

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await sidebar.getByRole("button", { name: "Create book inside Projects" }).click();

  await expect(projects).toHaveAttribute("aria-pressed", "false");
  const expandProjects = books.getByRole("button", { name: "Collapse Projects" });
  await expect(expandProjects).toHaveAttribute("aria-expanded", "true");
  const childListId = await expandProjects.getAttribute("aria-controls");
  expect(childListId).toBeTruthy();
  await expect(books.locator(`#${childListId}`)).toHaveRole("list");
  await expect(books.getByRole("button", { name: "Launch book, 0 pages, open", exact: true })).toBeVisible();
});

test("reduced motion stops looping loading and refresh animations without hiding status", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/quick-shares/reduced-motion", async () => new Promise(() => {}));
  await page.goto("/share/reduced-motion");

  const sharedLoading = page.locator('[role="status"]', { hasText: "Loading shared page..." });
  await expect(sharedLoading).toBeVisible();
  await expect(sharedLoading).toHaveCSS("animation-name", "none");

  let archiveRequests = 0;
  const archive = await makeGitHubArchive({ "codex-main/readme.md": "# Motion" });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/github/archive", async (route) => {
    archiveRequests += 1;
    if (archiveRequests > 1) return new Promise(() => {});
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
  await page.goto("/");
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await dialog.getByRole("tab", { name: "GitHub repository" }).click();
  await dialog.getByRole("textbox", { name: "Public repository URL" }).fill("https://github.com/openai/codex");
  await dialog.getByRole("button", { name: "Preview repository" }).click();
  await dialog.getByRole("button", { name: "Import repository" }).click();
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Refresh from GitHub" }).click();

  const refreshButton = page.getByRole("button", { name: "Refreshing from GitHub..." });
  await expect(refreshButton).toBeVisible();
  await expect(refreshButton.locator("svg")).toHaveCSS("animation-name", "none");
});

test("markdown syntax colors use readable Mdez semantic tokens", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill([
    "# Token sample",
    "",
    "```javascript",
    "function greet() {",
    "  const count = 2;",
    "  return \"hello\"; // note",
    "}",
    "```"
  ].join("\n"));
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await clickViewportModeTab(page, "Read");

  const preview = page.locator(".markdown-preview");
  const result = await preview.evaluate((element) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const background = getComputedStyle(element.querySelector("pre")!).backgroundColor;
    const pairs = [
      ["--color-code-keyword", ".hljs-keyword"],
      ["--color-code-string", ".hljs-string"],
      ["--color-code-number", ".hljs-number"],
      ["--color-code-title", ".hljs-title"],
      ["--color-code-comment", ".hljs-comment"]
    ] as const;
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const backgroundLuminance = luminance(background);

    return pairs.map(([token, selector]) => {
      const tokenColor = rootStyle.getPropertyValue(token).trim();
      const renderedColor = getComputedStyle(element.querySelector(selector)!).color;
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      element.append(probe);
      const resolvedTokenColor = getComputedStyle(probe).color;
      probe.remove();
      const foregroundLuminance = luminance(renderedColor);
      const contrast = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      return { token, tokenColor, resolvedTokenColor, renderedColor, contrast };
    });
  });

  for (const item of result) {
    expect(item.tokenColor, `${item.token} should be defined`).not.toBe("");
    expect(item.renderedColor).toBe(item.resolvedTokenColor);
    expect(item.contrast).toBeGreaterThanOrEqual(4.5);
  }
});

test("workspace polish keeps localized titles and icon actions discoverable", async ({ page }) => {
  const title = "เฉลย EGAT Aptitude Test สำหรับเตรียมสอบฉบับสมบูรณ์";

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Page title" }).fill(title);
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });
  await showShelfIfAvailable(page);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const sidebarTitle = sidebar.locator(".page-title-clamp").filter({ hasText: title });
  await expect(sidebarTitle).toHaveCSS("white-space", "nowrap");
  await expect(sidebarTitle).toHaveCSS("text-overflow", "ellipsis");
  await expect(sidebarTitle).toHaveAttribute("title", title);

  for (const name of ["Toggle sidebar", "Shared links", "Open library shelf"]) {
    await expect(page.locator(`button[aria-label="${name}"]`)).toHaveAttribute("title", name);
  }

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const viewport = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(viewport.scroll).toBe(viewport.client);
  }
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
  await expect(page.locator(".mobile-mode-nav")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  await expect(trigger).toBeFocused();
});

test("very narrow library drawer keeps its content inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 240, height: 844 });
  await page.getByRole("button", { name: "Open library shelf" }).click();

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const scrollArea = sidebar.locator(".sidebar-library-scroll");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");

  page.once("dialog", async (dialog) => dialog.accept("memory"));
  await sidebar.getByRole("button", { name: "Create book", exact: true }).click();
  await expect(sidebar.getByRole("button", { name: "memory book, 0 pages, open", exact: true })).toBeVisible();

  const overflow = await scrollArea.evaluate((element) => {
    const boundary = element.getBoundingClientRect();
    const row = element.querySelector<HTMLElement>(".folder-tree-row");
    const rowStyle = row ? getComputedStyle(row) : null;
    const wideDescendants = Array.from(element.querySelectorAll<HTMLElement>("*"))
      .map((node) => {
        const box = node.getBoundingClientRect();
        return {
          target: node.getAttribute("aria-label") ?? node.className ?? node.tagName,
          width: Math.round(box.width),
          right: Math.round(box.right)
        };
      })
      .filter((node) => node.right > Math.ceil(boundary.right));

    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      boundary: { left: Math.round(boundary.left), right: Math.round(boundary.right), width: Math.round(boundary.width) },
      row: row ? {
        left: Math.round(row.getBoundingClientRect().left),
        right: Math.round(row.getBoundingClientRect().right),
        width: Math.round(row.getBoundingClientRect().width),
        display: rowStyle?.display,
        columns: rowStyle?.gridTemplateColumns,
        paddingLeft: rowStyle?.paddingLeft
      } : null,
      wideDescendants
    };
  });

  expect(overflow.scrollWidth, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(overflow.clientWidth);
});
test("library copy explains page and book scope", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "A little space for big ideas." })).toBeVisible();
  await openShelfDrawerIfAvailable(page);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar.getByRole("button", { name: /Unsorted pages, \d+ pages, closed/ })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /My library/ })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Recent pages/ })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Bookmarks/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Recent pages" })).toBeVisible();
  await expect(page.getByText("No books yet. Create a book to group related pages.").last()).toBeVisible();
  await expect(page.getByText("Shelf root", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bookmarked pages", { exact: true })).toHaveCount(0);
});

test("no-document editor and reader states expose recovery actions", async ({ page }) => {
  await clickVisibleButtonIfAvailable(page, "Edit");

  const editor = page.locator("article").filter({ hasText: "Editor" });

  await expect(editor).toBeVisible();
  await expect(editor.getByText("No page selected", { exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Create page", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Import Markdown", exact: true })).toBeVisible();

  await clickVisibleButtonIfAvailable(page, "Read");

  const reader = page.locator("article").filter({ hasText: "Reader" });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("button", { name: "Create page", exact: true })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Import Markdown", exact: true })).toBeVisible();
});

test("missing routes use the quiet Library recovery surface", async ({ page }) => {
  await page.goto("/missing-page");

  await expect(page.getByRole("heading", { name: "This page is not in your Library" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Library" })).toHaveAttribute("href", "/");
  await expect(page.locator(".recovery-content")).toHaveCSS("box-shadow", "none");
  await expect(page.locator(".recovery-content")).toHaveCSS("border-top-width", "1px");
});

test("root selection keeps book ZIP export with selected-book actions", async ({ page }) => {
  await expect(page.getByRole("button", { name: /Export .*\.zip|Book ZIP/ })).toHaveCount(0);
});

test("global actions have one visible home", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^Import markdown$/i })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^(Export book \(.zip\)|Book ZIP for open book in Shelf)$/ })).toHaveCount(0);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar.getByRole("button", { name: /^Import markdown$/i })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: /Export .*\.zip|Book ZIP/ })).toHaveCount(0);
});

test("import dialog uses specific labels and recovery copy", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });

  await expect(dialog.getByRole("tab", { name: "Paste text" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Choose files" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "GitHub repository" })).toBeVisible();
  await expect(dialog.getByLabel("Add pages to")).toHaveValue("");
  await expect(dialog.getByRole("option", { name: "No book" })).toHaveCount(1);

  await dialog.getByRole("button", { name: "Import pasted text" }).click();
  await expect(dialog.getByText("Paste Markdown before importing.")).toBeVisible();
});

test("sidebar page rows reveal management actions on demand", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toBeVisible();
  await showShelfIfAvailable(page);
  await openShelfDrawerIfAvailable(page);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const pageRow = sidebar.getByRole("article").filter({ hasText: "untitled.md" });
  await expect(pageRow.getByText(/minute ago|Recently updated/)).toBeVisible();
  await expect(pageRow.getByText("Manage page", { exact: true })).toHaveCount(0);
  const compactRow = await pageRow.boundingBox();
  expect(compactRow?.height).toBeLessThanOrEqual(72);
  await expect(pageRow.getByRole("button", { name: "Rename untitled.md" })).toBeHidden();

  const manageButton = pageRow.getByRole("button", { name: "Manage untitled.md" });
  const manageBox = await manageButton.boundingBox();
  expect(manageBox?.width).toBeLessThanOrEqual(44);
  await manageButton.click();
  await expect(pageRow.getByRole("button", { name: "Rename untitled.md" })).toBeVisible();
  await expect(pageRow.getByRole("combobox", { name: "Move untitled.md page" })).toBeVisible();
  await expect(pageRow.getByRole("button", { name: "Delete untitled.md" })).toBeVisible();
});

test("an open book explains filtering and export scope", async ({ page }) => {
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (dialog) => dialog.accept("Writing"));
  await page.getByRole("button", { name: "Create book" }).first().click();
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await sidebar.getByRole("button", { name: "Create page in Writing", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toBeVisible();
  await showShelfIfAvailable(page);

  await expect(page.getByText("A collection of thoughts inside Writing.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export Writing (.zip)" })).toBeEnabled();
});

test("search, bookmarks, and resume preserve an edited page across reload", async ({ page }) => {
  const title = "Searchable field note";
  const body = "# Searchable field note\n\nA durable spark from the library redesign.";

  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Page title" }).fill(title);
  await page.locator(".cm-content").fill(body);

  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox", { name: "Search pages and books" });
  await expect(search).toBeFocused();
  await expect(page.locator(".cm-content")).not.toContainText("(url)");
  await search.fill("durable spark");
  await search.press("Enter");

  const result = page.getByRole("list", { name: "Library pages" }).getByRole("listitem").filter({ hasText: title });
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: `Bookmark ${title}` }).click();
  await expect(result.getByRole("button", { name: `Remove bookmark from ${title}` })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });

  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "Continue writing" })).toBeVisible();
  await expect(page.locator(".library-resume").getByText(title, { exact: true })).toBeVisible();
  await page.locator(".library-resume").getByRole("button", { name: "Open page" }).click();
  await expect(page.locator(".cm-content")).toContainText("A durable spark from the library redesign.");

  await showShelfIfAvailable(page);
  await openShelfDrawerIfAvailable(page);
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await sidebar.getByRole("button", { name: /Bookmarks/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your favorite ideas." })).toBeVisible();
  await expect(page.getByRole("list", { name: "Library pages" }).getByText(title, { exact: true })).toBeVisible();
});

test("editor and reader use the accepted quiet writing chrome", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const title = page.getByRole("textbox", { name: "Page title" });

  await expect(title).toHaveClass(/editor-page-title/);
  const titleChrome = await title.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      borderTop: styles.borderTopWidth,
      fontSize: Number.parseFloat(styles.fontSize)
    };
  });
  expect(titleChrome.background).toBe("rgba(0, 0, 0, 0)");
  expect(titleChrome.borderTop).toBe("0px");
  expect(titleChrome.fontSize).toBeGreaterThanOrEqual(28);
  await expect(page.locator(".editor-frame")).toHaveCSS("box-shadow", "none");

  await clickVisibleButtonIfAvailable(page, "Read");
  await expect(page.locator(".reader-pane-body")).toBeVisible();
  await expect(page.locator(".markdown-preview")).toHaveCSS("font-family", /Georgia/);
});



test("editor exposes formatting in one row without a disclosure", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });

  for (const name of [
    "Bold", "Italic", "Insert link", "Insert image", "Inline code",
    "Code block", "Math", "Heading 1", "Heading 2", "Divider", "Export .md"
  ]) {
    await expect(toolbar.getByRole("button", { name })).toBeVisible();
  }
  await expect(toolbar.getByRole("button", { name: "More formatting" })).toHaveCount(0);
});

test("editor toolbar inserts inline math and fenced code", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const editor = page.locator(".cm-content");
  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });

  await editor.click();
  await editor.press("Control+A");
  await page.keyboard.insertText("x + y");
  await editor.press("Control+A");
  await toolbar.getByRole("button", { name: "Math" }).click();
  await expect(editor).toContainText("$x + y$");

  await editor.click();
  await editor.press("Control+A");
  await page.keyboard.insertText("const value = 1;");
  await editor.press("Control+A");
  await toolbar.getByRole("button", { name: "Code block" }).click();
  await expect(editor).toContainText("```text");
  await expect(editor).toContainText("const value = 1;");
});

test("editor formatting shortcuts apply Markdown", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.press("Control+A");
  await page.keyboard.insertText("Shortcut text");
  await expect(editor).toHaveText("Shortcut text");
  await expect(page.getByRole("status").filter({ hasText: /^Unsaved changes$/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });
  await editor.press("Control+A");
  await editor.press("Control+B");
  await expect(editor).toContainText("**Shortcut text**");
});

test("mobile editor follows visual toolbar focus order and keeps actions visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Edit");

  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });
  const formatNames = [
    "Bold", "Italic", "Insert link", "Insert image", "Inline code",
    "Code block", "Math", "Heading 1", "Heading 2", "Divider"
  ];
  for (const name of formatNames) {
    await expectMinimumTouchTarget(toolbar.getByRole("button", { name }));
  }

  const documentActionNames = ["Quick Share", "Export .md"];
  for (const name of documentActionNames) {
    const action = toolbar.getByRole("button", { name });
    await expectInsideViewport(action, 390);
    await expectMinimumTouchTarget(action);
  }

  const formatBox = await toolbar.locator(".editor-format-actions").boundingBox();
  const documentBox = await toolbar.locator(".editor-document-actions").boundingBox();
  expect(formatBox).not.toBeNull();
  expect(documentBox).not.toBeNull();
  expect(formatBox!.y).toBeLessThan(documentBox!.y);

  const geometry = await page.evaluate(() => {
    const formatStrip = document.querySelector<HTMLElement>(".editor-format-actions");
    return {
      formatScrolls: formatStrip ? formatStrip.scrollWidth > formatStrip.clientWidth : false,
      pageClientWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth
    };
  });
  expect(geometry.formatScrolls).toBe(true);
  expect(geometry.pageScrollWidth).toBe(geometry.pageClientWidth);

  const focusOrder = [...formatNames, ...documentActionNames];
  const visualPositions = await Promise.all(
    focusOrder.map(async (name) => {
      const box = await toolbar.getByRole("button", { name }).boundingBox();
      expect(box).not.toBeNull();
      return { name, x: box!.x, y: box!.y };
    })
  );
  const visualOrder = visualPositions
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .map(({ name }) => name);
  expect(visualOrder).toEqual(focusOrder);

  await page.getByLabel("Page title").focus();
  for (const name of focusOrder) {
    await page.keyboard.press("Tab");
    await expect(toolbar.getByRole("button", { name })).toBeFocused();
  }
});

test("read mode exposes one workspace-level document heading", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Read");

  const main = page.getByRole("main");
  const identity = main.getByRole("heading", { name: "Untitled Document", exact: true });
  await expect(identity).toHaveCount(1);
  await expect(identity).toHaveJSProperty("tagName", "H1");
});

test("each workspace mode exposes the intended h1 hierarchy", async ({ page }) => {
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1, name: "A little space for big ideas." })).toBeVisible();
  await expect(main.locator(".library-intro h1, .workspace-title, .reader-document-title")).toHaveCount(1);

  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Edit");
  await expect(main.getByRole("heading", { level: 1, name: "Edit untitled.md", includeHidden: true })).toHaveClass(/sr-only/);
  await expect(main.locator(".workspace-title, .reader-document-title")).toHaveCount(0);

  await clickViewportModeTab(page, "Read");
  await expect(main.getByRole("heading", { level: 1, name: "Untitled Document" })).toBeVisible();
  await expect(main.locator(".workspace-title, .reader-document-title")).toHaveCount(1);

  await clickViewportModeTab(page, "Split");
  await expect(main.getByRole("heading", { level: 1, name: "Edit untitled.md", includeHidden: true })).toHaveClass(/sr-only/);
  if ((page.viewportSize()?.width ?? 1280) <= 767) {
    await page.locator(".split-workspace").getByRole("tab", { name: "Preview" }).click();
  }
  await expect(main.getByRole("heading", { level: 1, name: "Untitled Document" })).toBeVisible();
  await expect(main.locator(".workspace-title, .reader-document-title")).toHaveCount(1);
});
test("reader prose uses the reader token and only overlays receive elevation", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Read");

  await expect(page.locator(".markdown-preview")).toBeVisible();
  const evidence = await page.evaluate(() => {
    const prose = document.querySelector(".markdown-preview");
    const surface = document.querySelector(".workspace-surface");
    const panel = document.querySelector("main article");
    return {
      readerFamily: prose ? getComputedStyle(prose).fontFamily : "",
      surfaceShadow: surface ? getComputedStyle(surface).boxShadow : "",
      panelShadow: panel ? getComputedStyle(panel).boxShadow : ""
    };
  });

  expect(evidence.readerFamily).toContain("Shippori");
  expect(evidence.surfaceShadow).toBe("none");
  expect(evidence.panelShadow).toBe("none");
});

test("drawer, table of contents, and dialog share floating elevation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Read");

  await page.getByRole("button", { name: "Open table of contents" }).click();
  const toc = page.locator('nav[aria-label="Table of contents"]');
  const tocShadow = await toc.evaluate((node) => getComputedStyle(node).boxShadow);
  expect(tocShadow).not.toBe("none");
  await page.getByRole("button", { name: "Close table of contents" }).click();

  await showShelfIfAvailable(page);
  await clickVisibleButtonIfAvailable(page, "Import Markdown");
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  const dialogShadow = await dialog.evaluate((node) => getComputedStyle(node).boxShadow);
  expect(dialogShadow).toBe(tocShadow);
  await dialog.getByRole("button", { name: "Close import dialog" }).click();

  await page.setViewportSize({ width: 768, height: 900 });
  await page.getByRole("button", { name: "Open library shelf" }).click();
  const drawer = page.locator('aside[aria-label="Library shelf"]');
  await expect(drawer).toHaveClass(/floating-surface/);
  const drawerShadow = await drawer.evaluate((node) => getComputedStyle(node).boxShadow);
  expect(drawerShadow).toBe(tocShadow);

  const nonOverlayShadows = await page.evaluate(() => [
    document.querySelector(".workspace-surface"),
    document.querySelector("main article"),
    document.querySelector(".editor-frame")
  ].filter(Boolean).map((node) => getComputedStyle(node!).boxShadow));
  expect(nonOverlayShadows.every((shadow) => shadow === "none")).toBe(true);
});
test("mobile workspace interactive targets are at least 44 by 44 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const violations: Array<{ state: string; target: string; width: number; height: number }> = [];

  async function auditVisibleTargets(state: string) {
    const targets = await page.getByTestId("workspace-shell")
      .locator('button, a[href], input:not([type="hidden"]):not([type="file"]), select, textarea, summary, [role="button"], [role="tab"]')
      .evaluateAll((nodes) => nodes.flatMap((node) => {
        const element = node as HTMLElement;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          box.width === 0 ||
          box.height === 0 ||
          element.closest('[inert], [aria-hidden="true"]')
        ) return [];

        const label = element.getAttribute("aria-label")
          ?? element.getAttribute("title")
          ?? (element as HTMLInputElement).placeholder
          ?? element.textContent?.trim().replace(/\s+/g, " ")
          ?? element.tagName.toLowerCase();
        return [{
          target: `${element.tagName.toLowerCase()} "${label.slice(0, 80)}"`,
          width: Math.round(box.width * 10) / 10,
          height: Math.round(box.height * 10) / 10
        }];
      }));

    for (const target of targets) {
      if (target.width < 44 || target.height < 44) violations.push({ state, ...target });
    }
  }

  // CodeMirror's contenteditable surface is an editing canvas rather than a compact activation target,
  // so it is intentionally outside this button/link/form-control target audit.
  await auditVisibleTargets("Shelf");

  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  for (const mode of ["Edit", "Read", "Split"] as const) {
    await clickViewportModeTab(page, mode);
    await expectModeReady(page, mode);
    await auditVisibleTargets(mode);
  }

  const drawerTrigger = page.getByRole("button", { name: "Open library shelf" });
  await drawerTrigger.click();
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await auditVisibleTargets("Open drawer");

  await sidebar.getByRole("button", { name: "Close library shelf" }).click();
  await showShelfIfAvailable(page);
  await page.getByRole("button", { name: "Import Markdown", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add Markdown to your library" })).toBeVisible();
  await auditVisibleTargets("Import dialog");

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});
test("import source tabs expose only the active input", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });

  await expect(dialog.getByRole("textbox", { name: "Paste Markdown" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Public repository URL" })).toBeHidden();

  await dialog.getByRole("tab", { name: "GitHub repository" }).click();

  await expect(dialog.getByRole("textbox", { name: "Paste Markdown" })).toBeHidden();
  await expect(dialog.getByRole("textbox", { name: "Public repository URL" })).toBeVisible();
});

test("import source tabs support arrows and the dialog restores focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Import Markdown", exact: true }).last();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  const pasteTab = dialog.getByRole("tab", { name: "Paste text" });
  const filesTab = dialog.getByRole("tab", { name: "Choose files" });
  const githubTab = dialog.getByRole("tab", { name: "GitHub repository" });

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

test("import dialog traps focus and returns it to its trigger", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Import Markdown", exact: true }).last();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Close import dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Import pasted text" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("imports markdown by paste and previews it", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();

  await page.getByLabel("Paste Markdown").fill("# Hello Mdez\n\n- [x] local");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 1 page" })).toBeVisible();

  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Hello Mdez");
  await clickViewportModeTab(page, "Read");
  await expect(page.locator(".markdown-preview").getByRole("heading", { name: "Hello Mdez" })).toBeVisible();
});

test("preview prose uses reader typography while markdown code stays monospaced", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill("# Typography\n\nReadable prose with `inlineCode`.\n\n```ts\nconst value = 1;\n```");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
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

test("reader renders compatibility math and enhanced code blocks", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill(
    "# Technical notes\n\n\\[\n\\frac{8!}{6!}=56\n\\]\n\n```ts\nconst value = 1;\n```"
  );
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await page.getByRole("tab", { name: "Read" }).click();

  const preview = page.locator(".markdown-preview");
  await expect(preview.locator(".katex-display")).toBeVisible();
  await expect(preview.getByText("ts", { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Copy code" })).toBeVisible();
  await expect(preview.locator("pre code")).toContainText("const value = 1;");
});

test("reader lets long code language identifiers yield to the Copy control", async ({ page }) => {
  const language = "a-very-long-language-identifier-that-must-not-displace-copy";
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill(`\`\`\`${language}\nconst value = 1;\n\`\`\``);
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
  await page.getByRole("tab", { name: "Read" }).click();

  const preview = page.locator(".markdown-preview");
  const languageLabel = preview.getByText(language, { exact: true });
  await expect(preview.getByRole("button", { name: "Copy code" })).toBeVisible();
  await expect(languageLabel).toHaveCSS("min-width", "0px");
});



test("reader table of contents is inert when closed and keyboard safe when open", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill("# Quiet shell\n\n## Mode behavior\n\nReader copy.");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();
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
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Choose Markdown files").setInputFiles({
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

  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await dialog.getByRole("tab", { name: "GitHub repository" }).click();
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
  await expect(page.getByRole("complementary", { name: "Library shelf" }).getByTitle("Open docs book")).toBeVisible();
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

  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await dialog.getByRole("tab", { name: "GitHub repository" }).click();
  await dialog.getByRole("textbox", { name: "Public repository URL" }).fill("https://github.com/openai/codex");
  await dialog.getByRole("button", { name: "Preview repository" }).click();

  const errorMessage = dialog.getByText("GitHub is busy. Try again shortly.", { exact: true });
  await expect(errorMessage).toHaveCount(1);
  await expect(errorMessage).toBeVisible();
  await dialog.getByRole("button", { name: "Preview repository" }).click();
  await expect(dialog.getByRole("button", { name: "Import repository" })).toBeEnabled();
  expect(requestCount).toBe(2);
});

test("routes malformed GitHub URLs through app validation", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await dialog.getByRole("tab", { name: "GitHub repository" }).click();
  await dialog.getByRole("textbox", { name: "Public repository URL" }).fill("not a repository");
  await dialog.getByRole("button", { name: "Preview repository" }).click();

  const message = dialog.getByText(
    "Enter a public GitHub repository URL in the form https://github.com/owner/repository.",
    { exact: true }
  );
  await expect(message).toHaveCount(1);
  await expect(message).toBeVisible();
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

  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });
  await dialog.getByRole("tab", { name: "GitHub repository" }).click();
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
  await page.getByRole("button", { name: "Import Markdown", exact: true }).last().click();
  await page.getByLabel("Paste Markdown").fill("# Export Me\n\nSaved as markdown.");
  await page.getByRole("button", { name: "Import pasted text", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .md", exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("export-me.md");
  await expect(readFile((await download.path())!, "utf8")).resolves.toBe("# Export Me\n\nSaved as markdown.");
  await expect(page.getByRole("status").filter({ hasText: "Downloaded export-me.md" })).toBeVisible();
});

test("creates nested folders and blocks deleting non-empty folder", async ({ page }) => {
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (dialog) => dialog.accept("Projects"));
  await page.getByRole("button", { name: "Create book", exact: true }).first().click();
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar.getByRole("button", { name: "Projects book, 0 pages, open", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create book inside Projects" }).click();
  await expect(sidebar.getByRole("button", { name: "Launch book, 0 pages, open", exact: true })).toBeVisible();

  await page.getByRole("complementary", { name: "Library shelf" }).getByRole("button", { name: "Create page in Launch", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page title" })).toBeVisible();
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
  await page.getByRole("button", { name: "Create book", exact: true }).first().click();
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar.getByRole("button", { name: "Projects book, 0 pages, open", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Launch"));
  await page.getByRole("button", { name: "Create book inside Projects" }).click();
  await expect(sidebar.getByRole("button", { name: "Launch book, 0 pages, open", exact: true })).toBeVisible();

  await showShelfIfAvailable(page);
  await page.getByRole("button", { name: "Import Markdown", exact: true }).click();
  await page.getByLabel("Choose Markdown files").setInputFiles({
    name: "Checklist.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Checklist\n\n- [ ] Ship")
  });
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Checklist");
  await showShelfIfAvailable(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Launch (.zip)", exact: true }).click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));

  expect(download.suggestedFilename()).toBe("launch.zip");
  await expect(page.getByRole("status").filter({ hasText: "Downloaded launch.zip" })).toBeVisible();
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
  await expect(page.getByRole("status").filter({ hasText: /^Unsaved changes$/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });

  await page.reload();
  await clickVisibleButtonIfAvailable(page, "Edit");
  await expect(page.locator(".cm-content")).toContainText("Persisted");
});



test("content refresh keeps the selected page when it still exists", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const title = page.getByRole("textbox", { name: "Page title" });
  await title.fill("Selection survives refresh");
  await expect(page.getByRole("status").filter({ hasText: /^Unsaved changes$/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });

  await page.reload();
  await clickVisibleButtonIfAvailable(page, "Edit");
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Selection survives refresh");
});

test("split separator resizes from 30 to 70 percent", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
test("mobile Split switches between editor and preview without a separator", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Split");

  const split = page.locator(".split-workspace");
  const editorPanel = split.locator("#compact-split-editor-panel");
  const previewPanel = split.locator("#compact-split-reader-panel");
  await expect(split.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
  await expect(editorPanel).toBeVisible();
  await expect(previewPanel).toBeHidden();
  await expect(split.getByRole("separator", { name: "Resize editor and reader panes" })).toHaveCount(0);

  await split.getByRole("tab", { name: "Preview" }).click();
  await expect(split.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
  await expect(previewPanel).toBeVisible();
  await expect(editorPanel).toBeHidden();
  await expect(page.locator(".markdown-preview")).toBeVisible();
});
test("tablet drawer keeps its close control below the desktop breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1024 });

  const openShelf = page.getByRole("button", { name: "Open library shelf" });
  await expect(openShelf).toBeVisible();
  await openShelf.click();

  const closeShelf = page
    .getByRole("complementary", { name: "Library shelf" })
    .getByRole("button", { name: "Close library shelf" });
  await expect(closeShelf).toBeVisible();
  await closeShelf.click();

  await expect(page.locator('aside[aria-label="Library shelf"]')).toHaveAttribute("aria-hidden", "true");
});
test("tablet split stacks full-width panes and keeps the shelf in a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Split");

  const openShelf = page.getByRole("button", { name: "Open library shelf" });
  await expect(openShelf).toBeVisible();
  const separator = page.getByRole("separator", { name: "Resize editor and reader panes" });
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");

  const articles = page.locator("main article");
  await expect(articles).toHaveCount(2);
  for (const article of await articles.all()) {
    const box = await article.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(680);
  }
});
test("responsive layout switches exactly between 1023 and 1024 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 900 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await clickViewportModeTab(page, "Split");
  await expectModeReady(page, "Split");

  const drawerTrigger = page.getByRole("button", { name: "Open library shelf" });
  const sidebar = page.locator('aside[aria-label="Library shelf"]');
  const split = page.locator(".split-workspace");
  const separator = page.getByRole("separator", { name: "Resize editor and reader panes" });
  const editorPane = split.locator(":scope > div").nth(0);
  const readerPane = split.locator(":scope > div").nth(1);

  await expect(drawerTrigger).toBeVisible();
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");

  const tabletEditorBox = await editorPane.boundingBox();
  const tabletReaderBox = await readerPane.boundingBox();
  expect(tabletEditorBox).not.toBeNull();
  expect(tabletReaderBox).not.toBeNull();
  expect(Math.abs(tabletEditorBox!.x - tabletReaderBox!.x)).toBeLessThan(2);
  expect(tabletReaderBox!.y).toBeGreaterThan(tabletEditorBox!.y + tabletEditorBox!.height);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expectModeReady(page, "Split");
  await expect(drawerTrigger).toBeHidden();
  await expect(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible();
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await expect(separator).toHaveAttribute("aria-orientation", "vertical");

  const desktopEditorBox = await editorPane.boundingBox();
  const desktopReaderBox = await readerPane.boundingBox();
  expect(desktopEditorBox).not.toBeNull();
  expect(desktopReaderBox).not.toBeNull();
  expect(Math.abs(desktopEditorBox!.y - desktopReaderBox!.y)).toBeLessThan(2);
  expect(desktopReaderBox!.x).toBeGreaterThan(desktopEditorBox!.x + desktopEditorBox!.width);
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
    if ((page.viewportSize()?.width ?? 1280) <= 767) {
      await page.locator(".split-workspace").getByRole("tab", { name: "Preview" }).click();
    }
    await expect(page.getByText("Reader", { exact: true })).toBeVisible();
  }
});


















for (const width of [390, 430, 768, 1024, 1440]) {
  for (const mode of ["Shelf", "Edit", "Read", "Split"] as const) {
    test(`${mode} remains usable without document overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      if (mode !== "Shelf") {
        await page.getByRole("button", { name: "Create page", exact: true }).last().click();
      }
      await clickViewportModeTab(page, mode);
      await expectModeReady(page, mode);

      const size = await page.evaluate(() => [
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth
      ]);
      expect(size[1]).toBe(size[0]);
      await expect(page.getByRole("main")).toBeVisible();
    });
  }
}

test("inactive workspace surfaces are removed from interaction", async ({ page }) => {
  await clickVisibleButtonIfAvailable(page, "Read");
  await expect(page.getByTestId("screen-editor")).toHaveCount(0);
  await expect(page.getByTestId("screen-reader")).toBeVisible();
});
