import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They run against a local server by default.
 *
 * Tests never run against production (decisions.md, decision 3): any remote
 * E2E_BASE_URL also needs E2E_TARGET=staging, and a URL equal to
 * PRODUCTION_APP_URL is refused outright.
 */
const PORT = Number(process.env.PORT ?? 3100);
const remote = process.env.E2E_BASE_URL;

if (remote) {
  const production = process.env.PRODUCTION_APP_URL;
  if (production && new URL(remote).origin === new URL(production).origin) {
    throw new Error("E2E_BASE_URL points at production. Tests run against local or staging only.");
  }
  if (process.env.E2E_TARGET !== "staging") {
    throw new Error("A remote E2E_BASE_URL also needs E2E_TARGET=staging. Tests never run against production.");
  }
}

const baseURL = remote ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: false } },
  ],
  webServer: remote
    ? undefined
    : {
        // CI builds first and runs the production server; locally this reuses `npm run dev` if it's already up.
        command: process.env.CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
