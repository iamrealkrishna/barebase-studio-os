import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  addClientContact,
  addItem,
  addSection,
  closeEntryForm,
  createProject,
  downloadPdfText,
  login,
  money,
  openClientLink,
  pdfText,
  sendToClient,
  testEmail,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * One journey through everything BOQ Studio does, inside the Studio OS shell.
 *
 * The numbered spec files each prove one feature in depth. This file proves
 * they still join up after the move into the new shell and routes: a person
 * can go from signing in to a client-approved BOQ with change orders and an
 * audit export, using only the screens a real user would click through.
 */

const MEMBER_NAME = testName("Journey Member");
const MEMBER_EMAIL = testEmail("journey-member");
const MEMBER_START_PASSWORD = "journey-start-pw-1";
const MEMBER_RESET_PASSWORD = "journey-reset-pw-2";
const MEMBER_OWN_PASSWORD = "journey-own-pw-3";

const CONTACT_NAME = testName("Journey Client");
const CONTACT_EMAIL = testEmail("journey-client");

const SCOPE_TEXT = "Two coats of emulsion over one coat of primer.";
const INTERNAL_NOTE = "PLAYWRIGHT internal note: supplier quoted 5% under list";
const CUSTOM_ITEM = "PLAYWRIGHT Journey Bespoke Niche";

/** A 1×1 PNG, so the photo upload goes through the real file input. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let projectId = "";
let shareUrl = "";
let clientContext: BrowserContext;
let client: Page;

function memberRow(page: Page) {
  return page.locator("tbody tr", { hasText: MEMBER_EMAIL }).first();
}

async function sumRow(page: Page, label: string) {
  return money(await page.locator(".sum-row", { hasText: label }).locator(".amt").first().innerText())!;
}

test.describe("Studio journey: everything BOQ Studio does, end to end", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    // The client has no account, so they get a browser with no staff session.
    clientContext = await browser.newContext();
    client = await clientContext.newPage();
  });

  test.afterAll(async () => {
    await clientContext?.close();
  });

  // ------------------------------------------------------------- sign in

  test("sign in lands inside the Studio OS shell", async ({ page }) => {
    await login(page);
    await expect(page.locator("aside nav")).toBeVisible();
    await expect(page.locator('aside nav a:has-text("Projects")')).toBeVisible();
    await expect(page.locator('aside nav a:has-text("Team")')).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
  });

  // ---------------------------------------------------------------- team

  test("Team: an admin adds a member", async ({ page }) => {
    await login(page);
    await page.goto("/team");
    await page.click("text=＋ Add team member");
    await page.waitForSelector("#tm-name");
    await page.fill("#tm-name", MEMBER_NAME);
    await page.fill("#tm-email", MEMBER_EMAIL);
    await page.fill("#tm-password", MEMBER_START_PASSWORD);
    await page.selectOption("#tm-role", "MEMBER");
    await page.click('button:has-text("Add member")');
    await expect(page.locator(".flash.ok")).toContainText(MEMBER_EMAIL, { timeout: 30_000 });
    await expect(memberRow(page)).toBeVisible();
  });

  test("forgot password: an admin resets it, and the old one stops working", async ({ page, browser }) => {
    // BOQ Studio has no emailed reset link yet (Phase 0, P0-7). A person who
    // forgets their password asks an Admin, who sets a new one from Team.
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Reset password")').click();
    await memberRow(page).locator(".pw-reset-input").fill(MEMBER_RESET_PASSWORD);
    await memberRow(page).getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    const other = await browser.newContext();
    const memberPage = await other.newPage();
    await memberPage.goto("/login");
    await memberPage.fill("#email", MEMBER_EMAIL);
    await memberPage.fill("#password", MEMBER_START_PASSWORD);
    await memberPage.click('button[type="submit"]');
    await expect(memberPage.locator(".auth-error")).toBeVisible({ timeout: 30_000 });

    await login(memberPage, MEMBER_EMAIL, MEMBER_RESET_PASSWORD);
    await other.close();
  });

  test("change password: the member changes their own at /account", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_RESET_PASSWORD);
    await page.goto("/account");
    await page.fill("#pw-current", MEMBER_RESET_PASSWORD);
    await page.fill("#pw-next", MEMBER_OWN_PASSWORD);
    await page.fill("#pw-confirm", MEMBER_OWN_PASSWORD);
    await page.click('button:has-text("Change password")');
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });

    await page.context().clearCookies();
    await login(page, MEMBER_EMAIL, MEMBER_OWN_PASSWORD);
    // A member has no Team link.
    await expect(page.locator('aside nav a:has-text("Team")')).toHaveCount(0);
  });

  // ------------------------------------------------------------ rate card

  test("rate card: edit and save, export CSV, preview an import", async ({ page }, testInfo) => {
    await login(page);
    await page.goto("/settings/rate-card");
    await page.waitForSelector("table.ratecard");

    const save = page.locator('button:has-text("Save rate card")');
    const field = page.locator("table.ratecard input").nth(1);
    const original = await field.inputValue();
    try {
      await field.fill(`${original} JOURNEY`);
      await page.waitForTimeout(300);
      await save.click();
      await expect(save).toBeDisabled({ timeout: 30_000 });
      await page.reload();
      await page.waitForSelector("table.ratecard");
      await expect(page.locator("table.ratecard input").nth(1)).toHaveValue(`${original} JOURNEY`);
    } finally {
      // The rate card is shared, so put it back exactly as it was.
      await page.locator("table.ratecard input").nth(1).fill(original);
      await page.waitForTimeout(300);
      await save.click();
      await expect(save).toBeDisabled({ timeout: 30_000 });
    }

    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.click('button:has-text("Download Rate Card")');
    const csvPath = testInfo.outputPath("rates.csv");
    await (await download).saveAs(csvPath);

    // Re-importing the card unchanged previews the rows and writes nothing.
    await page.setInputFiles('input[type="file"]', csvPath);
    const summary = page.locator(".hint-text", { hasText: "data row" });
    await expect(summary).toBeVisible({ timeout: 60_000 });
    await expect(summary).toContainText("data rows read");
    await expect(page.locator('button:has-text("Confirm")')).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button:has-text("Confirm")')).toHaveCount(0);
  });

  // ----------------------------------------------------------- build a BOQ

  test("create a project and build its BOQ: rooms, items, custom item", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, testName("Journey"));

    // The builder sits inside the project shell, on the BOQ tab.
    await expect(page.locator("aside")).toContainText(testName("Journey"));

    const before = await page.locator(".sec-block").count();
    await addSection(page, "Kitchen");
    await expect(page.locator(".sec-block")).toHaveCount(before + 1);
    await expect(page.locator(".sec-block", { hasText: "Kitchen" })).toHaveCount(1);

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await addItem(page, { section: "Kitchen", category: "Electrical Works", desc: "Switches & Sockets", l: 6 });
    await waitForSaved(page);

    // A custom item, typed in rather than picked from the rate card.
    await closeEntryForm(page);
    await page.locator(".sec-block", { hasText: "Kitchen" }).first().locator('button:has-text("Add item")').click();
    await page.waitForSelector(".entry-form");
    const row = page.locator(".entry-form .item-row").first();
    await row.locator("select").nth(0).selectOption({ label: "Other (custom item)" });
    await page.waitForTimeout(400);
    await row.locator("input").nth(0).fill(CUSTOM_ITEM);
    await row.locator("input").nth(1).fill("Teak");
    await row.locator("input").nth(2).fill("Polished");
    await row.locator("input").nth(3).fill("Nos.");
    const dims = page.locator(".entry-form .item-field.dim input");
    await dims.nth(0).fill("2");
    await dims.nth(1).fill("4500");
    await page.locator('.entry-form button:has-text("Add item")').click();
    await page.waitForTimeout(1000);
    await closeEntryForm(page);
    await waitForSaved(page);

    await expect(page.locator(".compact-row")).toHaveCount(3);
    await expect(page.locator(".compact-row", { hasText: CUSTOM_ITEM })).toHaveCount(1);
  });

  test("count, scope, internal note and a photo on a line", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");

    const painting = page.locator(".compact-row", { hasText: "Painting" }).first();
    await painting.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".inline-edit");
    await page.locator('.inline-edit .item-field:has(label:text-is("Count")) input').fill("2");
    await page.locator('.inline-edit button:has-text("Scope & notes")').first().click();
    await page.waitForTimeout(300);
    const details = page.locator(".inline-edit-details textarea");
    await details.nth(0).fill(SCOPE_TEXT);
    await details.nth(1).fill(INTERNAL_NOTE);
    await page.locator('.inline-edit .img-add input[type="file"]').setInputFiles({
      name: "reference.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.locator(".inline-edit .img-thumb")).toBeVisible({ timeout: 15_000 });
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(1000);
    await waitForSaved(page);

    // 10 × 12 = 120 SQFT each, two of them.
    const qty = await page.locator(".compact-row", { hasText: "Painting" }).locator(".cr-qty").first().innerText();
    expect(money(qty)).toBe(240);

    // It all survives a reload.
    await page.reload();
    await page.waitForSelector(".compact-row");
    const reopened = page.locator(".compact-row", { hasText: "Painting" }).first();
    await reopened.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".inline-edit");
    await page.locator('.inline-edit button:has-text("Scope & notes")').first().click();
    await expect(page.locator(".inline-edit .img-thumb")).toBeVisible();
    await expect(page.locator(".inline-edit-details textarea").nth(0)).toHaveValue(SCOPE_TEXT);
    await expect(page.locator(".inline-edit-details textarea").nth(1)).toHaveValue(INTERNAL_NOTE);
  });

  test("discount and GST give the right totals", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");

    const amounts = (await page.locator(".compact-row .cr-amt").allInnerTexts()).map((t) => money(t)!);
    expect(amounts).toHaveLength(3);
    const subtotal = amounts.reduce((a, b) => a + b, 0);
    expect(await sumRow(page, "Subtotal")).toBeCloseTo(subtotal, 1);

    await page.locator(".discount-row input").fill("10");
    await page.locator(".discount-row select").selectOption("pct");
    await page.waitForTimeout(600);
    await page.locator("#gstToggle").check();
    await page.selectOption(".gst-toggle select", "18");
    await page.waitForTimeout(800);
    await waitForSaved(page);

    const taxBase = subtotal * 0.9;
    const cgst = await sumRow(page, "CGST");
    const sgst = await sumRow(page, "SGST");
    expect(cgst).toBeCloseTo(taxBase * 0.09, 1);
    expect(sgst).toBeCloseTo(taxBase * 0.09, 1);
    const grand = money(await page.locator(".sum-row.total .amt").first().innerText())!;
    expect(grand).toBeCloseTo(taxBase + cgst + sgst, 1);
  });

  test("cost, margin and internal notes never reach a member's browser", async ({ page }) => {
    await login(page, MEMBER_EMAIL, MEMBER_OWN_PASSWORD);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");

    await expect(page.locator(".cost-toggle")).toHaveCount(0);
    await expect(page.locator('button:has-text("Internal PDF")')).toHaveCount(0);

    // Checked against the HTML the server sent, not what is visible. Internal
    // notes are cost-private too (decision 25).
    const html = await page.content();
    for (const word of ["Internal cost", "Cost ₹", INTERNAL_NOTE]) {
      expect(html, `"${word}" reached a member's browser`).not.toContain(word);
    }
  });

  // ------------------------------------------------- versions and PDFs

  test("save a version; client and internal PDFs", async ({ page }) => {
    await login(page);
    shareUrl = await addClientContact(page, projectId, CONTACT_NAME, CONTACT_EMAIL);
    expect(shareUrl).toContain("/c/");

    await sendToClient(page, projectId);
    expect(new URL(page.url()).pathname).toBe(`/projects/${projectId}/boq/client-view`);

    await page.goto(`/projects/${projectId}/boq/versions`);
    await expect(page.locator("body")).toContainText(/V1\s*Sent to Client/);

    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    const clientPdf = await downloadPdfText(page, "Client PDF");
    expect(clientPdf).toContain("Painting");
    expect(clientPdf).toContain(CUSTOM_ITEM);
    expect(clientPdf, "the client PDF shows no margin").not.toContain("Margin");
    expect(clientPdf, "the client PDF shows no internal note").not.toContain("supplier quoted");

    const internalPdf = await downloadPdfText(page, "Internal PDF");
    expect(internalPdf).toContain("Margin");
  });

  // -------------------------------------------------------- client link

  test("client link: the email check, then line-by-line answers", async () => {
    await client.goto(shareUrl);
    await client.waitForTimeout(1500);
    await expect(client.locator("#gate-email")).toBeVisible();
    // Nothing of the estimate is in the page before the check.
    expect(await client.content()).not.toContain(CUSTOM_ITEM);

    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const rows = client.locator(".cv-row");
    await expect(rows).toHaveCount(3);

    const html = await client.content();
    for (const word of ["Margin", "Internal cost", "supplier quoted"]) {
      expect(html, `"${word}" reached the client`).not.toContain(word);
    }

    await rows.nth(0).locator('button:has-text("Approve")').click();
    await expect(rows.nth(0).locator(".cv-saved")).toContainText("Approved", { timeout: 30_000 });

    await rows.nth(1).locator('button:has-text("Request change")').click();
    await expect(rows.nth(1).locator(".cv-comment input")).toBeVisible({ timeout: 30_000 });
    await rows.nth(1).locator(".cv-comment input").fill("Journey: please move these to the island.");
    await rows.nth(1).locator(".cv-comment input").press("Enter");
    await expect(rows.nth(1).locator(".cv-comment-note")).toContainText("move these to the island", {
      timeout: 30_000,
    });
  });

  test("Client Review shows the client's answers to the team", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq/review`);
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toContainText("move these to the island");
  });

  test("the client approves the whole estimate", async () => {
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    await client.locator('button:has-text("Approve the whole estimate")').first().click();
    await client.locator('button:has-text("Yes, approve all")').first().click();
    await client.waitForTimeout(2500);

    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const saved = await client.locator(".cv-saved").allInnerTexts();
    expect(saved).toHaveLength(3);
    for (const text of saved) expect(text).toContain("Approved");
  });

  test("editing an approved line and saving a version raises a change order", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    const custom = page.locator(".compact-row", { hasText: CUSTOM_ITEM }).first();
    await custom.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".inline-edit");
    await page.locator('.inline-edit .item-field:has(label:has-text("Rate")) input').first().fill("5200");
    await page.waitForTimeout(300);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(1000);
    await waitForSaved(page);
    await sendToClient(page, projectId);

    await page.goto(`/projects/${projectId}/boq/versions`);
    const order = page.locator(".co-row", { hasText: CUSTOM_ITEM }).first();
    await expect(order).toBeVisible({ timeout: 30_000 });
    await expect(order.locator(".co-kind")).toBeVisible();
  });

  // ------------------------------------------------------------- history

  test("the audit log exports as a PDF", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq/versions`);
    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.click('button:has-text("Export audit log PDF")');
    const stream = await (await download).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = pdfText(Buffer.concat(chunks));
    expect(text.length).toBeGreaterThan(50);
    expect(text).toContain(testName("Journey"));
  });

  test("deactivating the member locks them out", async ({ page, browser }) => {
    await login(page);
    await page.goto("/team");
    await memberRow(page).locator('button:has-text("Deactivate")').click();
    await expect(page.locator(".flash.ok")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(memberRow(page)).toContainText("Deactivated");

    const other = await browser.newContext();
    const memberPage = await other.newPage();
    await memberPage.goto("/login");
    await memberPage.fill("#email", MEMBER_EMAIL);
    await memberPage.fill("#password", MEMBER_OWN_PASSWORD);
    await memberPage.click('button[type="submit"]');
    await expect(memberPage.locator(".auth-error")).toBeVisible({ timeout: 30_000 });
    await other.close();
  });
});
