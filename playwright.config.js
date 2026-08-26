import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
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
    command: "python3 -m http.server 8001 --bind 127.0.0.1 --directory dist",
    url: "http://127.0.0.1:8001/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
