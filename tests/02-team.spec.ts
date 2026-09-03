import { expect, test, type Page } from "@playwright/test";

import { login, loginExpectingFailure, testEmail, testName } from "./helpers";

const MEMBER_NAME = testName("Member");
const MEMBER_EMAIL = testEmail("member");
const MEMBER_PASSWORD = "playwright-test-pw-1";

/** The Team page row for our test member. */
function memberRow(page: Page) {
  return page.locator("tbody tr", { hasText: MEMBER_EMAIL }).first();
}

/**
 * Each state change is asserted twice: once on the page that made it, and once
 * after a reload. A role badge that only updates optimistically would pass the
 * first and fail the second.
 */
test.describe("Team admin", () => {
  test.describe.configure({ mode: "serial" });

  test("only admins can reach the Team page", async ({ page }) => {
    await login(page);
    await page.goto("/team");
    await expect(page).toHaveURL(/\/team/);
    await expect(page.locator("text=Team members")).toBeVisible();
  });

  test("add a team member", async ({ page }) => {
    await login(page);
    await page.goto("/team");

    await page.click("text=＋ Add team member");
    await page.waitForSelector("#tm-name");
    await page.fill("#tm-name", MEMBER_NAME);
    await page.fill("#tm-email", MEMBER_EMAIL);
    await page.fill("#tm-password", MEMBER_PASSWORD);
    await page.selectOption("#tm-role", "MEMBER");
    await page.click('button:has-text("Add member")');

    await expect(page.locator(".flash.ok")).toContainText(MEMBER_EMAIL, { timeout: 30_000 });

    await page.reload();
    await expect(memberRow(page)).toContainText(MEMBER_NAME);
    await expect(memberRow(page)).toContainText("Team Member");
  });

  test("the new member can sign in, and is not an admin", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await expect(page).toHaveURL(/\/projects/);

    // The Team link is admin-only in the nav...
    await expect(page.locator('.page-toggle a:has-text("Team")')).toHaveCount(0);
    // ...and the page itself refuses them server-side, not just cosmetically.
    await page.goto("/team");
    await expect(page).toHaveURL(/\/projects/);
  });

  test("promote to Admin", async ({ page }) => {
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Promote")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(memberRow(page)).toContainText("Admin");
    await expect(memberRow(page).locator('button:has-text("Demote")')).toBeVisible();
  });

  test("the promotion actually took effect for that user", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await expect(page.locator('.page-toggle a:has-text("Team")')).toBeVisible();
    await page.goto("/team");
    await expect(page).toHaveURL(/\/team/);
    await expect(page.locator("text=Team members")).toBeVisible();
  });

  test("demote back to Team Member", async ({ page }) => {
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Demote")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(memberRow(page)).toContainText("Team Member");
  });

  test("the demotion actually took effect for that user", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto("/team");
    await expect(page).toHaveURL(/\/projects/);
  });

  test("deactivate, and the deactivated user can no longer sign in", async ({ page, browser }) => {
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Deactivate")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(memberRow(page)).toContainText("Deactivated");

    // The real assertion: a clean browser, correct password, refused.
    const context = await browser.newContext();
    const fresh = await context.newPage();
    const result = await loginExpectingFailure(fresh, MEMBER_EMAIL, MEMBER_PASSWORD);
    expect(result.url).toBe("/login");
    expect(result.error.length).toBeGreaterThan(0);
    await context.close();
  });

  test("restore access, and they can sign in again", async ({ page, browser }) => {
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Restore access")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    const context = await browser.newContext();
    const fresh = await context.newPage();
    await login(fresh, MEMBER_EMAIL, MEMBER_PASSWORD);
    await expect(fresh).toHaveURL(/\/projects/);
    await context.close();

    // Leave them deactivated — the cleanup script removes them, but a run that
    // is interrupted shouldn't leave a live login behind on production.
    await page.reload();
    await memberRow(page).locator('button:has-text("Deactivate")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });
  });
});
