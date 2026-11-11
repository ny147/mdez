import { expect, test } from "@playwright/test";
import { measureAction } from "../performance/support/browser";

test("measurement starts at the accepted keyboard event", async ({ page }) => {
  test.setTimeout(7000);
  await page.route("**/measurement-test", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  await page.goto("/measurement-test");
  await page.setContent('<input aria-label="Synthetic action"><output></output><script>document.querySelector("input").addEventListener("keydown", e => { if(e.key === "Enter") document.querySelector("output").textContent="Complete"; });</script>');
  await page.getByRole("textbox").fill("Prepared outside measurement");
  const result = await measureAction(page, { action: "rename-book", initiator: "mutation" },
    () => page.getByRole("textbox").press("Enter"),
    () => expect(page.locator("output")).toHaveText("Complete"));
  expect(result.paintMs).toBeGreaterThanOrEqual(0);
});

test("measurement retains unfinished request attempts", async ({ page }) => {
  await page.route("**/measurement-test", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  await page.goto("/measurement-test");
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/key-groups/g1/changes", async (route) => { await blocked; await route.fulfill({ json: {} }); });
  await page.setContent('<button>Measure</button><output></output><script>document.querySelector("button").onclick=()=>{ fetch("/api/key-groups/g1/changes"); document.querySelector("output").textContent="Complete"; };</script>');
  try {
    const result = await measureAction(page, { action: "switch", initiator: "navigation" },
      async () => { await Promise.all([page.waitForRequest("**/api/key-groups/g1/changes"), page.getByRole("button").click()]); },
      () => expect(page.locator("output")).toHaveText("Complete"));
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({ status: null, endMs: null, initiator: "unknown" });
  } finally { release(); }
});

