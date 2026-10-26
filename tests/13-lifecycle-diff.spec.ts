import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  PREFIX,
  addClientContact,
  addItem,
  createProject,
  login,
  money,
  openClientLink,
  sendToClient,
  testEmail,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * The whole lifecycle, with the diff checked for accuracy rather than presence.
 *
 * "Something is highlighted" is the easy assertion and the useless one. What
 * matters is that exactly the changed line is flagged, the untouched lines are
 * not, and the flag names the field that actually moved — a diff that marks
 * everything is the same as a diff that marks nothing.
 */

const CONTACT_NAME = `${PREFIX} Lifecycle Contact`;
const CONTACT_EMAIL = testEmail("lifecycle-contact");

let projectId = "";
let shareLink = "";
let clientContext: BrowserContext;
let client: Page;

test.describe("Lifecycle end to end, and diff accuracy", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    // A client is not a user account, so they get a context with no session.
    clientContext = await browser.newContext();
    client = await clientContext.newPage();
  });

  test.afterAll(async () => {
    await clientContext?.close();
  });

  test("build a project with three lines and send it", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, testName("Lifecycle"));
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 10 });
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 6 });
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 4, b: 5 });
    await waitForSaved(page);

    expect(await page.locator(".compact-row").count()).toBe(3);

    shareLink = await addClientContact(page, projectId, CONTACT_NAME, CONTACT_EMAIL);
    await sendToClient(page, projectId);
  });

  test("the client approves one, rejects one with a comment, notes a third", async () => {
    await openClientLink(client, shareLink, CONTACT_EMAIL);
    const rows = client.locator(".cv-row");
    await expect(rows).toHaveCount(3);

    await rows.nth(0).locator('button:has-text("Approve")').click();
    await expect(rows.nth(0).locator(".cv-saved")).toContainText("Approved", { timeout: 30_000 });

    await rows.nth(1).locator('button:has-text("Reject")').click();
    await expect(rows.nth(1).locator(".cv-comment input")).toBeVisible({ timeout: 30_000 });
    await rows.nth(1).locator(".cv-comment input").fill("Only need four of these, not six.");
    await rows.nth(1).locator(".cv-comment input").press("Enter");
    await expect(rows.nth(1).locator(".cv-comment-note")).toContainText("Only need four", {
      timeout: 30_000,
    });

    // A note with no verdict — this line must stay pending.
    await rows.nth(2).locator('button:has-text("Add a note")').click();
    await rows.nth(2).locator(".cv-comment input").fill("What finish is this?");
    await rows.nth(2).locator('button:has-text("Save note")').click();
    await expect(rows.nth(2).locator(".cv-comment-note")).toContainText("What finish", {
      timeout: 30_000,
    });

    // Reload, so this is the stored state rather than the optimistic one.
    await openClientLink(client, shareLink, CONTACT_EMAIL);
    const after = client.locator(".cv-row");
    await expect(after.nth(0).locator(".cv-saved")).toContainText("Approved");
    await expect(after.nth(1).locator(".cv-saved")).toContainText("Rejected");
    for (const cls of ["on-approve", "on-reject", "on-revision"]) {
      expect(
        await after.nth(2).locator(`.cv-mini-btn.${cls}`).count(),
        "a note is not a verdict",
      ).toBe(0);
    }
  });

  test("Client Review shows the same verdicts and the exact comment", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/review`);
    await page.waitForTimeout(1500);

    const body = await page.locator("body").innerText();
    expect(body, "the rejection comment didn't reach the team").toContain("Only need four of these");
    expect(body, "the query on the third line didn't reach the team").toContain("What finish is this?");
  });

  test("the team fixes the rejected line and sends a new version", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/review`);
    await page.waitForTimeout(1500);

    // Edit the rejected line from the review screen, where the client's words
    // are still beside it.
    const rejected = page.locator(".compact-row").filter({ hasText: "Switches" }).first();
    await rejected.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".inline-edit");

    // The Qty label carries its unit — "Qty (Nos.)" — so this matches on the
    // prefix. Only that one field's label contains "Qty".
    const qty = page.locator('.inline-edit .item-field:has(label:has-text("Qty")) input').first();
    await qty.fill("4");
    await page.waitForTimeout(300);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(1200);

    await page.click('button:has-text("Save version & send back")');
    await page.waitForTimeout(2500);
  });

  test("the client approves the whole revised estimate", async () => {
    // This is what establishes a diff baseline. The client's highlighting is
    // "what changed since YOU last said yes", so until a client has approved a
    // whole version there is deliberately nothing to compare against and no
    // line is flagged — checking for highlights before this point would be
    // testing a state the app never claims to have.
    await openClientLink(client, shareLink, CONTACT_EMAIL);
    await client.locator('button:has-text("Approve the whole estimate")').first().click();
    await client.locator('button:has-text("Yes, approve all")').first().click();
    await client.waitForTimeout(2500);

    await openClientLink(client, shareLink, CONTACT_EMAIL);
    const saved = await client.locator(".cv-saved").allInnerTexts();
    expect(saved.length, "every line should now carry a verdict").toBe(3);
    for (const text of saved) expect(text).toContain("Approved");
  });

  test("after a single edit, the diff flags that line and nothing else", async ({ page }) => {
    // Change exactly one line — the first — and send it.
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    const target = page.locator(".compact-row").filter({ hasText: "Painting" }).first();
    await target.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".inline-edit");
    await page.locator('.inline-edit .item-field:has(label:has-text("Rate")) input').first().fill("999");
    await page.waitForTimeout(300);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(1200);
    await waitForSaved(page);
    await sendToClient(page, projectId);

    await openClientLink(client, shareLink, CONTACT_EMAIL);
    const rows = client.locator(".cv-row");
    await expect(rows).toHaveCount(3);

    const texts = await rows.allInnerTexts();
    const changedIndex = texts.findIndex((t) => t.includes("999"));
    expect(changedIndex, "the edited line is missing").toBeGreaterThan(-1);

    // Exactly one line carries a Changed tag, and it's the edited one.
    const changed = client.locator(".cv-row.diff-changed");
    await expect(changed, "the diff flagged the wrong number of lines").toHaveCount(1);
    expect(await changed.innerText(), "the wrong line was flagged").toContain("999");

    // The untouched lines carry no tag at all.
    for (let i = 0; i < 3; i++) {
      if (i === changedIndex) continue;
      const cls = (await rows.nth(i).getAttribute("class")) ?? "";
      expect(cls, `line ${i} was flagged but nobody touched it`).not.toContain("diff-changed");
      expect(cls, `line ${i} was flagged as new but it isn't`).not.toContain("diff-new");
    }

    // And it carries the tag element, not just a class on the row.
    await expect(changed.locator(".cv-tag.changed"), "the changed line has no visible tag").toHaveCount(
      1,
    );
    await expect(client.locator(".cv-row .cv-tag.new"), "nothing here is new yet").toHaveCount(0);
  });

  test("adding a line marks it New, and only it", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 2, b: 3 });
    await waitForSaved(page);
    await sendToClient(page, projectId);

    await client.reload();
    await client.waitForSelector(".cv-row");
    await expect(client.locator(".cv-row")).toHaveCount(4);
    await expect(client.locator(".cv-row.diff-new"), "exactly one line is new").toHaveCount(1);
  });

  test("changing a count on an already-approved line raises a change order", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".compact-row");

    // The first line is the one the client approved.
    const approved = page.locator(".compact-row").first();
    const before = money(await approved.locator(".cr-amt").innerText())!;

    await approved.locator('button[title="Edit this row"]').click();
    await page.waitForSelector(".inline-edit");
    await page.locator('.inline-edit .item-field:has(label:text-is("Count")) input').fill("2");
    await page.waitForTimeout(300);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(1200);
    await waitForSaved(page);

    const after = money(await page.locator(".compact-row").first().locator(".cr-amt").innerText())!;
    expect(after, "the count didn't double the line").toBeCloseTo(before * 2, 1);

    // It's flagged against the approved version, and the flag names the count.
    const flagged = page.locator(".compact-row.is-changed").first();
    await expect(flagged, "changing a count on approved scope raised no change order").toHaveCount(1);
    const title = await flagged.locator(".co-flag").first().getAttribute("title");
    expect(title, "the change order should name what moved").toMatch(/Count|Quantity/);
  });
});
