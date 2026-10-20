import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against whatever `E2E_BASE_URL` points at: a local
 * `npm run start` or the staging deployment, never production. Nothing is
 * stubbed: every test drives the real app and checks the real database through
 * the UI.
 *
 * See tests/README.md for how to run it, and for the cleanup script that
 * removes what a run creates.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Tests create projects, team members and client links, so they never run
// against production (decisions.md, decision 3). A remote URL must be declared
// as staging, and the production address is refused outright.
const host = new URL(baseURL).hostname;
const isLocal = host === "localhost" || host === "127.0.0.1";
const productionUrl = process.env.PRODUCTION_APP_URL;
if (productionUrl && new URL(productionUrl).hostname === host) {
  throw new Error(`E2E_BASE_URL points at production (${host}). Run the tests against staging.`);
}
if (!isLocal && process.env.E2E_TARGET !== "staging") {
  throw new Error(`E2E_BASE_URL is remote (${host}). Set E2E_TARGET=staging to confirm it is the staging deployment.`);
}

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  /**
   * Serial, one worker, on purpose.
   *
   * The rate card is a single shared record and the app guards concurrent BOQ
   * edits with an optimistic-concurrency check — two workers would fight each
   * other and produce flakes that say nothing about the app.
   */
  workers: 1,
  fullyParallel: false,

  // A failed assertion is worth stopping for, not retrying until it passes by luck.
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
