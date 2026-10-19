import { expect, test, type Page } from "@playwright/test";

import { createProject, login, testEmail, testName } from "./helpers";

/**
 * Role restrictions across every page, as both an Admin and a Team Member.
 *
 * The point isn't that a Team Member sees no cost toggle — a hidden control is
 * a UI preference someone can un-hide. It's that the numbers never reach their
 * browser at all. Where that's the claim, the assertion is against
 * `page.content()`, not against what happens to be visible.
 */

const MEMBER_NAME = testName("Role Member");
const MEMBER_EMAIL = testEmail("role-member");
const MEMBER_PASSWORD = "playwright-test-pw-role-1";

function memberRow(page: Page) {
  return page.locator("tbody tr", { hasText: MEMBER_EMAIL }).first();
}

let projectId = "";

test.describe("Roles across every page", () => {
  test.describe.configure({ mode: "serial" });

  test("set up: a project and a team member", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, testName("Roles"));

    await page.goto("/team");
    await page.click("text=＋ Add team member");
    await page.waitForSelector("#tm-name");
    await page.fill("#tm-name", MEMBER_NAME);
    await page.fill("#tm-email", MEMBER_EMAIL);
    await page.fill("#tm-password", MEMBER_PASSWORD);
    await page.selectOption("#tm-role", "MEMBER");
    await page.click('button:has-text("Add member")');
    await expect(page.locator(".flash.ok")).toContainText(MEMBER_EMAIL, { timeout: 30_000 });
  });

  test("an admin reaches every page in the app", async ({ page }) => {
    await login(page);

    for (const path of ["/projects", "/settings", "/account", "/team"]) {
      await page.goto(path);
      expect(new URL(page.url()).pathname, `an admin should stay on ${path}`).toBe(path);
    }
    for (const suffix of ["", "/build", "/client-view", "/review"]) {
      await page.goto(`/projects/${projectId}${suffix}`);
      expect(
        new URL(page.url()).pathname,
        `an admin should stay on the project's ${suffix || "versions"} page`,
      ).toContain(projectId);
    }
  });

  test("an admin gets the cost toggle and the Internal PDF on Build BOQ", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".sec-block");
    await expect(page.locator(".cost-toggle")).toHaveCount(1);
    // Two of each: the top bar and the summary panel both carry PDF buttons.
    // Both Internal ones are gated, which is the part that matters.
    await expect(page.locator('button:has-text("Internal PDF")')).toHaveCount(2);
    await expect(page.locator('button:has-text("Client PDF")')).toHaveCount(2);
  });

  test("an admin can actually edit the rate card", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");
    await expect(page.locator(".flash.err")).toHaveCount(0);
    expect(
      await page.locator("table.ratecard input:not([disabled])").count(),
      "an admin should have editable rate card fields",
    ).toBeGreaterThan(0);
  });

  test("a team member is bounced off Team but keeps every other page", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);

    await page.goto("/team");
    expect(new URL(page.url()).pathname, "/team is admin-only").not.toBe("/team");

    for (const path of ["/projects", "/settings", "/account"]) {
      await page.goto(path);
      expect(new URL(page.url()).pathname, `a member should keep ${path}`).toBe(path);
    }
    for (const suffix of ["", "/build", "/client-view", "/review"]) {
      await page.goto(`/projects/${projectId}${suffix}`);
      expect(
        new URL(page.url()).pathname,
        `a member should keep the project's ${suffix || "versions"} page`,
      ).toContain(projectId);
    }
  });

  test("a team member has no Team link in the nav", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto("/projects");
    await expect(page.locator('a[href="/team"]')).toHaveCount(0);
  });

  test("a team member gets no cost controls, and no cost figure in the page at all", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".sec-block");

    await expect(page.locator(".cost-toggle")).toHaveCount(0);
    // Both render sites must be gated, not just the one in the top bar.
    await expect(page.locator('button:has-text("Internal PDF")')).toHaveCount(0);
    // The Client PDF is still theirs to export, from both places.
    await expect(page.locator('button:has-text("Client PDF")')).toHaveCount(2);

    // Case-sensitive and specific: CSS carries the word "margin" everywhere, so
    // a loose match would pass on any page and mean nothing.
    const html = await page.content();
    for (const word of ["Internal cost", "Cost ₹"]) {
      expect(html, `"${word}" reached a team member's browser`).not.toContain(word);
    }
  });

  test("a team member sees the rate card read-only, with a banner saying why", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    await expect(page.locator(".flash.err")).toContainText("admin-only");
    expect(
      await page.locator("table.ratecard input:not([disabled])").count(),
      "no rate card field should be editable by a member",
    ).toBe(0);
    expect(await page.content(), "the internal cost column reached a member").not.toContain("Internal cost");
  });

  test("a team member's Client Review and Versions pages still work", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);

    await page.goto(`/projects/${projectId}/review`);
    expect(new URL(page.url()).pathname).toContain("/review");

    await page.goto(`/projects/${projectId}`);
    await expect(page.locator("text=Version history")).toBeVisible();
    expect(await page.content(), "a margin figure appeared on a member's versions page").not.toContain(
      "Margin",
    );
  });

  test("the role test member is left deactivated", async ({ page }) => {
    // Deliberate: an interrupted run must not leave a working login behind.
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Deactivate")').click();
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(memberRow(page)).toContainText("Deactivated");
  });
});
