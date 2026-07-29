import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PW_PORT || 5183;
const BASE_URL = `http://localhost:${PORT}`;

// This app has no test-mode backend — Playwright drives the real Vite dev
// server against the real IMS_LIVE/IMS_PGLIVE backend (122.179.135.100:8095).
// There is no seed/reset step: tests must be read-mostly and tolerant of
// whatever live data currently exists (see fixtures/session.js for the
// localStorage auth-bypass all specs rely on).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared live backend — avoid concurrent writes/races across workers
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Single desktop project by default — specs that specifically need mobile
  // coverage (e.g. the DMS overlap regression) call page.setViewportSize()
  // internally rather than doubling every test's runtime via a second project.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
