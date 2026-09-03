import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against whatever `E2E_BASE_URL` points at — a local
 * `npm run start`, a preview deployment, or production. Nothing is stubbed:
 * every test drives the real app and checks the real database through the UI.
 *
 * See tests/README.md for how to run it, and for the cleanup script that
 * removes what a run creates.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  /**
   * Serial, one worker, on purpose.
   *
   * The rate card is a single shared record and the app guards concurrent BOQ
   * edits with an optimistic-concurrency check — two workers would fight each
   * other and produce flakes that say nothing about the app. Running against
   * production, serial also keeps the blast radius to one thing at a time.
   */
  workers: 1,
  fullyParallel: false,

  // A failed assertion against production is worth stopping for, not retrying
  // until it passes by luck.
  retries: 0,
  forbidOnly: Boolean(process.env.CI),

  timeout: 120_000,
  expect: { timeout: 15_000 },

  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
