import { expect, test } from "@playwright/test";

import { ADMIN, login } from "./helpers";

/**
 * Every internal route is behind `requireUser`, which redirects rather than
 * rendering an empty shell. These check the redirect actually happens on the
 * server — a signed-out browser should never receive project data at all.
 */
const PROTECTED = [
  { path: "/projects", what: "the projects list" },
  { path: "/settings", what: "Org Settings" },
  { path: "/settings/rate-card", what: "the rate card" },
  { path: "/team", what: "the Team admin page" },
  { path: "/account", what: "your account page" },
  { path: "/", what: "the root" },
];

test.describe("Auth", () => {
  test("signed-out visitors are redirected to login from every route", async ({ page }) => {
    for (const route of PROTECTED) {
      await page.context().clearCookies();
      await page.goto(route.path);
      await expect(page, `${route.what} (${route.path}) should redirect to /login`).toHaveURL(/\/login/);
      await expect(page.locator("#email")).toBeVisible();
    }
  });

  test("a signed-out visitor gets no project data, only the login form", async ({ page }) => {
    await page.context().clearCookies();
    // A real project id is unnecessary — a signed-out user must not even learn
    // whether one exists.
    await page.goto("/projects/some-project-id/build");
    await expect(page).toHaveURL(/\/login/);

    const html = await page.content();
    expect(html).not.toContain("Build BOQ");
    expect(html).not.toContain("compact-row");
  });

  test("the seeded admin can sign in", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator(`aside a[href="/account"]`)).toBeVisible();
  });

  test("a wrong password is refused", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", ADMIN.email);
    await page.fill("#password", "definitely-not-the-password");
    await page.click('button[type="submit"]');
    await expect(page.locator(".auth-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the session survives a refresh and a fresh navigation", async ({ page }) => {
    await login(page);

    await page.reload();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator(`aside a[href="/account"]`)).toBeVisible();

    // A cold navigation, not a client-side route change.
    await page.goto("/settings/rate-card");
    await expect(page).toHaveURL(/\/settings\/rate-card/);
    await expect(page.locator("table.ratecard")).toBeVisible();
  });

  test("signing out ends the session", async ({ page }) => {
    await login(page);
    await page.click('button:has-text("Sign out")');
    await page.waitForURL("**/login", { timeout: 30_000 });

    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });
});
