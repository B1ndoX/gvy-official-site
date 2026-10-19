import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // First-frame/rebuffer measurements must not compete with another test's
  // browser, video decoder or local media downloads on the same machine.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:8001",
    browserName: process.env.GVY_BROWSER_NAME || "chromium",
    ...(process.env.GVY_BROWSER_CHANNEL ? { channel: process.env.GVY_BROWSER_CHANNEL } : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/preview-server.mjs --port 8001",
    url: "http://127.0.0.1:8001/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
