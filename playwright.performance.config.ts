import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) throw new Error("Performance tests require a loopback app");
if (process.env.PERF_MODE && !["mock", "server"].includes(process.env.PERF_MODE)) throw new Error("Invalid PERF_MODE");
if (process.env.PLAYWRIGHT_WEB_SERVER_COMMAND && process.env.PLAYWRIGHT_WEB_SERVER_COMMAND !== "npm run start -- --port 3100") throw new Error("Performance tests require the production start command");

export default defineConfig({
  testDir: "./tests/performance", fullyParallel: false, workers: 1, retries: 0,
  timeout: 0, reporter: "list", outputDir: "playwright-report/performance",
  use: { baseURL, trace: "off", video: "off", screenshot: "off", actionTimeout: 5000, navigationTimeout: 15000 },
  webServer: process.env.PERF_MODE === "server" ? undefined : {
    command: "npm run start -- --port 3100", url: baseURL, reuseExistingServer: false, timeout: 120000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
