import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  ADMIN,
  addClientContact,
  addItem,
  createProject,
  login,
  loginExpectingFailure,
  openClientLink,
  sendToClient,
  testEmail,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * Decisions 25 and 27.
 *
 * Internal notes are cost-private: they are removed on the server for anyone
 * who can't see cost, and from every client response, exactly like cost price.
 * Checked against the HTML the server sent, which carries the page's data,
 * never against what happens to be visible.
 *
 * Passwords: new and changed passwords need at least 10 characters, checked by
 * the server, and passwords set before the rule keep working.
 */

const NOTE = `PLAYWRIGHT private note ${Date.now()}: supplier gave 7% off`;
const SCOPE = "Two coats of emulsion, one of primer.";

const MEMBER_NAME = testName("Notes Member");
const MEMBER_EMAIL = testEmail("notes-member");
const MEMBER_PASSWORD = "notes-member-pw-1";

const CONTACT_EMAIL = testEmail("notes-client");

const hasDb = Boolean(process.env.DATABASE_URL);

let projectId = "";
let shareUrl = "";
let clientContext: BrowserContext;
let client: Page;

function memberRow(page: Page) {
  return page.locator("tbody tr", { hasText: MEMBER_EMAIL }).first();
}

/** Open the first line's editor and its scope and notes. */
async function openFirstLineDetails(page: Page) {
  await page.locator('.compact-row button[title="Edit this row"]').first().click();
  await page.waitForSelector(".inline-edit");
  await page.locator('.inline-edit button:has-text("Scope & notes")').first().click();
  await page.waitForSelector(".inline-edit-details");
}

test.describe("Internal notes are private, and passwords need 10 characters", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    clientContext = await browser.newContext();
    client = await clientContext.newPage();
  });

  test.afterAll(async () => {
    await clientContext?.close();
  });

  test("set up: an admin writes a note on a line, and adds a member", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, testName("Private Notes"));
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);

    await openFirstLineDetails(page);
    const boxes = page.locator(".inline-edit-details textarea");
    await expect(boxes, "an admin gets both the scope and the note box").toHaveCount(2);
    await boxes.nth(1).fill(NOTE);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await waitForSaved(page);

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

  test("the note never reaches a member's browser, on any BOQ page", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    for (const path of ["boq", "boq/review", "boq/client-view", "boq/versions"]) {
      await page.goto(`/projects/${projectId}/${path}`);
      await page.waitForLoadState("networkidle");
      expect(await page.content(), `the note reached a member on /${path}`).not.toContain(NOTE);
    }

    // And they aren't offered a note box whose text would be thrown away.
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    await openFirstLineDetails(page);
    await expect(page.locator(".inline-edit-details textarea")).toHaveCount(1);
  });

  test("a member's edit to the line keeps the note they never saw", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    await openFirstLineDetails(page);
    await page.locator(".inline-edit-details textarea").first().fill(SCOPE);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await waitForSaved(page);

    await page.context().clearCookies();
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    await openFirstLineDetails(page);
    await expect(page.locator(".inline-edit-details textarea").nth(0)).toHaveValue(SCOPE);
    await expect(page.locator(".inline-edit-details textarea").nth(1), "the member's save erased the note").toHaveValue(
      NOTE,
    );
  });

  test("the note never reaches a client", async ({ page }) => {
    await login(page);
    shareUrl = await addClientContact(page, projectId, testName("Notes Client"), CONTACT_EMAIL);
    await sendToClient(page, projectId);

    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    expect(await client.content()).not.toContain(NOTE);
    expect(await client.content()).not.toContain("supplier gave");
  });

  // ------------------------------------------------------------ passwords

  test("a new member's password needs 10 characters, checked on the server", async ({ page }) => {
    await login(page);
    await page.goto("/team");
    await page.click("text=＋ Add team member");
    await page.waitForSelector("#tm-name");
    await page.fill("#tm-name", testName("Short Password"));
    await page.fill("#tm-email", testEmail("short-pw"));
    // Take the browser's own check off, so this proves the server's.
    await page.locator("#tm-password").evaluate((el) => el.removeAttribute("minlength"));
    await page.fill("#tm-password", "nine-char");
    await page.selectOption("#tm-role", "MEMBER");
    await page.click('button:has-text("Add member")');
    await expect(page.locator(".flash.err")).toContainText("at least 10 characters", { timeout: 30_000 });
    await expect(page.locator("tbody tr", { hasText: testEmail("short-pw") })).toHaveCount(0);
  });

  test("changing your own password needs 10 characters too", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
    await page.goto("/account");
    for (const id of ["#pw-next", "#pw-confirm"]) {
      await page.locator(id).evaluate((el) => el.removeAttribute("minlength"));
    }
    await page.fill("#pw-current", MEMBER_PASSWORD);
    await page.fill("#pw-next", "short-pw9");
    await page.fill("#pw-confirm", "short-pw9");
    await page.click('button:has-text("Change password")');
    await expect(page.locator(".flash.err")).toContainText("at least 10 characters", { timeout: 30_000 });

    // The old password still works.
    await page.context().clearCookies();
    await login(page, MEMBER_EMAIL, MEMBER_PASSWORD);
  });

  test("a password set before the rule still signs in", async ({ page }) => {
    test.skip(!hasDb, "needs DATABASE_URL to store a password set under the old 8-character rule");
    const email = testEmail("old-password");
    const oldPassword = "eight-ch";
    const prisma = new PrismaClient();
    try {
      const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email.toLowerCase() } });
      await prisma.user.upsert({
        where: { email },
        update: { passwordHash: await bcrypt.hash(oldPassword, 10), active: true },
        create: {
          orgId: admin.orgId,
          email,
          name: testName("Old Password"),
          role: "MEMBER",
          passwordHash: await bcrypt.hash(oldPassword, 10),
        },
      });
    } finally {
      await prisma.$disconnect();
    }

    await login(page, email, oldPassword);
    await expect(page).toHaveURL(/\/projects/);
  });

  test("clean up: the member is deactivated", async ({ page, browser }) => {
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Deactivate")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    const context = await browser.newContext();
    const fresh = await context.newPage();
    const result = await loginExpectingFailure(fresh, MEMBER_EMAIL, MEMBER_PASSWORD);
    expect(result.url).toBe("/login");
    await context.close();
  });
});
