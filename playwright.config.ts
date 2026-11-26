import { defineConfig, devices } from "@playwright/test";

/**
 * Kiểm thử trên bản build production (scripts/serve-static.ts phục vụ dist/ như host tĩnh), mô phỏng trình duyệt –
 * không thay thế kiểm thử trên thiết bị thật.
 *   npm run build && npm run build:fixture && npm run test:e2e
 * Kiểm tra site đã deploy: E2E_BASE_URL=https://novelverse-vn.vercel.app npx playwright test --project=chromium
 */
const REMOTE = process.env.E2E_BASE_URL?.trim();
const MAIN = REMOTE || "http://127.0.0.1:4322";
const FIXTURE = "http://127.0.0.1:4323";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: { baseURL: MAIN, trace: "off" },
  // Khi kiểm tra site đã deploy thì không khởi động server cục bộ.
  webServer: REMOTE
    ? undefined
    : [
        { command: "node scripts/serve-static.ts dist 4322", url: `${MAIN}/`, reuseExistingServer: true, timeout: 60_000 },
        { command: "node scripts/serve-static.ts dist-fixture 4323", url: `${FIXTURE}/`, reuseExistingServer: true, timeout: 60_000 },
      ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /fixture/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /fixture|layout/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /fixture|layout/ },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testMatch: /flow|reader/ },
    { name: "mobile-webkit", use: { ...devices["iPhone 14"] }, testMatch: /flow|reader/ },
    { name: "fixture", use: { ...devices["Desktop Chrome"], baseURL: FIXTURE }, testMatch: /fixture/ },
  ],
});
