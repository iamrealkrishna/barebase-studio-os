import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  addClientContact,
  addItem,
  createProject,
  downloadPdfText,
  login,
  openClientLink,
  sendToClient,
  testEmail,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * Client View, end to end, from the client's side.
 *
 * A client is not a user account. They reach the estimate through a per-contact
 * share link, and opening it asks for the email address the link was issued to
 * before any of the BOQ is fetched. So every test here drives that real path in
 * its own browser context with no Barebase session — never the admin's preview
 * of the same page, which would prove nothing about what a client can see.
 */
test.describe("Client View", () => {
  test.describe.configure({ mode: "serial" });

  const CONTACT_NAME = testName("Client Contact");
  const CONTACT_EMAIL = testEmail("client");

  let projectId = "";
  let shareUrl = "";
  /** Descriptions of the three lines, in the order they appear to the client. */
  let itemNames: string[] = [];

  let clientContext: BrowserContext;
  let client: Page;

  test.beforeAll(async ({ browser }) => {
    clientContext = await browser.newContext();
    client = await clientContext.newPage();
  });

  test.afterAll(async () => {
    await clientContext?.close();
  });

  test("set up a project and send it to a client", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, testName("Client View"));

    // Three lines: one to approve, one to reject, one to leave alone.
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 6 });
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 8, b: 8 });
    await waitForSaved(page);

    itemNames = await page.locator(".compact-row .main-line").allInnerTexts();
    expect(itemNames).toHaveLength(3);

    shareUrl = await addClientContact(page, projectId, CONTACT_NAME, CONTACT_EMAIL);
    expect(shareUrl).toContain("/c/");

    await sendToClient(page, projectId);
  });

  // ------------------------------------------------------------------ access

  test("the link is gated: no estimate reaches an unverified visitor", async () => {
    await client.goto(shareUrl);
    await client.waitForTimeout(2000);

    await expect(client.locator("#gate-email")).toBeVisible();

    // Not merely hidden — the BOQ isn't in the payload at all.
    const html = await client.content();
    for (const name of itemNames) expect(html).not.toContain(name);
    expect(html).not.toContain("cv-row");
  });

  test("a wrong email is refused, without confirming the link exists", async () => {
    await client.fill("#gate-email", "someone-else@example.invalid");
    await client.click('button:has-text("Open my estimate")');
    await expect(client.locator(".auth-error")).toContainText("isn't valid for that email");
    await expect(client.locator("#gate-email")).toBeVisible();
  });

  test("the right email opens the estimate", async () => {
    await client.fill("#gate-email", CONTACT_EMAIL);
    await client.click('button:has-text("Open my estimate")');
    await client.waitForSelector(".cv-row", { timeout: 45_000 });
    await expect(client.locator(".cv-row")).toHaveCount(3);
    await expect(client.locator(".cv-banner")).toContainText(CONTACT_NAME.split(" ").slice(-1)[0]);
  });

  // -------------------------------------------------------- read-only bounds

  test("the client cannot edit anything — no inputs on the line items", async () => {
    // The only writable controls are the comment box and the action buttons.
    const rows = client.locator(".cv-row");
    for (const row of await rows.all()) {
      expect(await row.locator('input[type="number"]').count()).toBe(0);
      expect(await row.locator("select").count()).toBe(0);
      expect(await row.locator("textarea").count()).toBe(0);
    }
    expect(await client.locator('button[title="Edit this row"]').count()).toBe(0);
    expect(await client.locator(".compact-row").count()).toBe(0);
  });

  test("internal cost, margin and the rate card are unreachable for the client", async () => {
    const html = await client.content();
    for (const word of ["Cost & margin", "Internal cost", "Margin", "Internal PDF"]) {
      expect(html, `"${word}" must never appear on a client's page`).not.toContain(word);
    }

    // The client's browser has no Barebase session, so internal routes bounce.
    for (const route of ["/settings", "/projects", "/team", `/projects/${projectId}/boq`]) {
      const response = await client.goto(route);
      expect(new URL(client.url()).pathname, `${route} should not open for a client`).toBe("/login");
      expect(response?.status()).toBeLessThan(400);
    }
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
  });

  // ---------------------------------------------------- column visibility

  test("column toggles genuinely remove values, not just hide them", async ({ page }) => {
    await login(page);

    // What the client currently sees, so we know the values we're switching off.
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const before = await client.locator(".cv-row .d2").first().innerText();
    const material = before.split("·")[0].trim();
    expect(material.length).toBeGreaterThan(0);

    // Turn all four off from Client View's own controls.
    await page.goto(`/projects/${projectId}/client-view`);
    await page.waitForSelector(".cv-controls");
    for (const label of ["Material", "Finish", "Qty", "Rate per unit"]) {
      const box = page.locator(".cv-controls .col-toggle-row", { hasText: label }).locator("input");
      if (await box.isChecked()) await box.uncheck();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);

    // The client's page, reloaded, must not contain those strings anywhere in
    // the DOM — a CSS-hidden value would still be in the HTML.
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const html = await client.content();
    expect(html, "material must be absent, not hidden").not.toContain(material);
    expect(html).not.toContain("Rate ₹");
    expect(html).not.toContain("SQFT");

    // And nothing is merely invisible.
    expect(await client.locator(".cv-row .d2").first().innerText()).not.toContain(material);

    // Both PDFs honour the same setting.
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");
    const clientPdf = await downloadPdfText(page, "Client PDF");
    expect(clientPdf).not.toContain(material);
    expect(clientPdf).not.toContain("SQFT");

    await page.locator(".cost-toggle input").check();
    await page.waitForTimeout(500);
    const internalPdf = await downloadPdfText(page, "Internal PDF");
    expect(internalPdf).not.toContain(material);
    expect(internalPdf).not.toContain("SQFT");
    // The Internal PDF still carries the internal columns it exists for.
    expect(internalPdf).toContain("Margin");

    // Put them back for the rest of the suite.
    await page.goto(`/projects/${projectId}/client-view`);
    await page.waitForSelector(".cv-controls");
    for (const label of ["Material", "Finish", "Qty", "Rate per unit"]) {
      const box = page.locator(".cv-controls .col-toggle-row", { hasText: label }).locator("input");
      if (!(await box.isChecked())) await box.check();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
  });

  test("no cost or margin figure appears on the client's page", async ({ page }) => {
    // Read the real internal cost off the admin's Internal PDF...
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");
    await page.locator(".cost-toggle input").check();
    await page.waitForTimeout(600);

    const costBlock = await page.locator(".cost-summary-block").innerText();
    const internalCost = costBlock.match(/Internal cost\s*₹?([\d,]+)/)?.[1]?.replace(/,/g, "");

    // ...and confirm it is nowhere in what the client received.
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const html = await client.content();
    if (internalCost && Number(internalCost) > 0) {
      expect(html).not.toContain(internalCost);
    }
    expect(html, "no cost field in the payload").not.toContain('"cost"');
    // Case-sensitive on purpose: the CSS `margin` property is everywhere in
    // inline styles, so only the app's own capitalised labels mean anything.
    for (const label of ["Margin", "Internal cost", "Cost ₹"]) {
      expect(html, `"${label}" must never reach a client`).not.toContain(label);
    }
  });

  // ------------------------------------------------- approve / reject / note

  test("the client approves one line, rejects another with a comment, notes a third", async () => {
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const rows = client.locator(".cv-row");

    // 1. Approve.
    await rows.nth(0).locator('button:has-text("Approve")').click();
    await expect(rows.nth(0).locator(".cv-saved")).toContainText("Approved", { timeout: 30_000 });

    // 2. Reject with a reason — the comment box opens by itself.
    await rows.nth(1).locator('button:has-text("Reject")').click();
    await expect(rows.nth(1).locator(".cv-comment input")).toBeVisible({ timeout: 30_000 });
    await rows.nth(1).locator(".cv-comment input").fill("Too many points — we only need four.");
    await rows.nth(1).locator(".cv-comment input").press("Enter");
    await expect(rows.nth(1).locator(".cv-comment-note")).toContainText("only need four", { timeout: 30_000 });
    await expect(rows.nth(1).locator(".cv-saved")).toContainText("Rejected");

    // 3. A note with no verdict — must stay Pending.
    await rows.nth(2).locator('button:has-text("Add a note")').click();
    await rows.nth(2).locator(".cv-comment input").fill("Can we see a sample first?");
    await rows.nth(2).locator('button:has-text("Save note")').click();
    await expect(rows.nth(2).locator(".cv-comment-note")).toContainText("sample first", { timeout: 30_000 });

    // Reload: the client's own answers persisted.
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    await expect(client.locator(".cv-row").nth(0).locator(".cv-saved")).toContainText("Approved");
    await expect(client.locator(".cv-row").nth(1).locator(".cv-saved")).toContainText("Rejected");
    await expect(client.locator(".cv-row").nth(2).locator(".cv-comment-note")).toContainText("sample first");
  });

  test("the third line is still pending — a note is not a verdict", async () => {
    const third = client.locator(".cv-row").nth(2);
    // No verdict button is in its "on" state.
    for (const cls of ["on-approve", "on-reject", "on-revision"]) {
      expect(await third.locator(`.cv-mini-btn.${cls}`).count(), `third line should not be ${cls}`).toBe(0);
    }
    await expect(client.locator(".topbar-actions span").first()).toContainText("1 of 3 approved");
  });

  // -------------------------------------------------------------- state sync

  test("the internal Client Review screen shows the same statuses and comments", async ({ browser }) => {
    // A brand-new context: this is a reload of the internal view from cold, not
    // the same session that happened to watch the client act.
    const context = await browser.newContext();
    const admin = await context.newPage();
    await login(admin);
    await admin.goto(`/projects/${projectId}/review`);
    await admin.waitForSelector(".review-head");

    await expect(admin.locator(".review-counts")).toContainText("1 approved");
    await expect(admin.locator(".review-counts")).toContainText("1 rejected");

    await admin.locator('button:has-text("Every line")').click();
    await admin.waitForTimeout(800);

    const approved = admin.locator(".compact-row", { hasText: itemNames[0] }).first();
    await expect(approved.locator(".review-verdicts")).toContainText("Approved");
    await expect(approved.locator(".review-verdicts")).toContainText(CONTACT_NAME);

    const rejected = admin.locator(".compact-row.review-rejected").first();
    await expect(rejected.locator(".review-verdicts")).toContainText("Rejected");
    await expect(rejected.locator(".review-verdicts")).toContainText("only need four");

    // The commented-but-undecided line reads as not decided, with the note.
    const noted = admin.locator(".compact-row.review-noted").first();
    await expect(noted.locator(".review-verdicts")).toContainText("sample first");

    await context.close();
  });

  test("every client action left an audit entry naming the item", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq/versions`);
    await page.waitForSelector(".audit-row");

    const entries = await page.locator(".audit-row").allInnerTexts();
    const joined = entries.join("\n");

    expect(joined, "the approval is on the record").toMatch(/Approved\s+—/);
    expect(joined, "the rejection is on the record").toMatch(/Rejected\s+—/);
    expect(joined, "the comment is on the record").toContain("sample first");
    expect(joined, "attributed to the client contact").toContain(CONTACT_NAME);

    // Each row carries a date and a time, and is tagged as a client action.
    const clientRows = page.locator(".audit-row", { hasText: CONTACT_NAME });
    expect(await clientRows.count()).toBeGreaterThanOrEqual(3);
    const first = await clientRows.first().innerText();
    // en-IN abbreviates some months to four letters ("3 Sept 2026").
    expect(first, "timestamped").toMatch(/\d{1,2}\s+\w{3,}\s+\d{4}/);
    expect(first).toMatch(/\d{1,2}:\d{2}/);
    await expect(clientRows.first().locator(".actor-tag")).toHaveText("CLIENT");
  });

  // ------------------------------------------------------ internal response

  test("the team edits the rejected line, and the client sees the change", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/review`);
    await page.waitForSelector(".review-head");

    // Act on the rejection from this screen, with their comment on show.
    const rejected = page.locator(".compact-row.review-rejected").first();
    const rejectedName = (await rejected.locator(".main-line").innerText()).trim();
    await rejected.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".compact-row.editing-row");

    const editing = page.locator(".compact-row.editing-row").first();
    await expect(editing.locator(".inline-edit-annotation")).toContainText("only need four");

    // The client asked for four instead of six.
    const qtyBox = editing.locator(".item-field.dim input").first();
    await qtyBox.fill("4");
    await page.waitForTimeout(400);
    await editing.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1500);
    await expect(page.locator(".saving-chip")).toHaveText("All changes saved", { timeout: 30_000 });

    // Send the reworked BOQ back.
    await page.click('button:has-text("Save version & send back")');
    await page.waitForURL("**/client-view", { timeout: 45_000 });

    // The client's next load shows the new quantity.
    await openClientLink(client, shareUrl, CONTACT_EMAIL);
    const row = client.locator(".cv-row", { hasText: rejectedName }).first();
    await expect(row.locator(".d2")).toContainText("4 Nos.");
  });

  test("lines the client never touched are still neutral after all that", async () => {
    await openClientLink(client, shareUrl, CONTACT_EMAIL);

    // A new version resets the review, so nothing should be marked at all now.
    const rows = client.locator(".cv-row");
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      for (const cls of ["on-approve", "on-reject", "on-revision"]) {
        expect(
          await rows.nth(i).locator(`.cv-mini-btn.${cls}`).count(),
          `line ${i + 1} should carry no verdict against the new version`,
        ).toBe(0);
      }
    }
    await expect(client.locator(".topbar-actions span").first()).toContainText("0 of 3");
  });
});
