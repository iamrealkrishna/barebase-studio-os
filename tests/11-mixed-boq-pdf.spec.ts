import { expect, test } from "@playwright/test";

import {
  PREFIX,
  addItem,
  closeEntryForm,
  createProject,
  describeLayoutProblems,
  downloadPdf,
  findOutsideMargins,
  findOverlaps,
  login,
  money,
  pdfLayout,
  pdfText,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * One BOQ carrying every shape of line at once, checked through both PDFs.
 *
 * Each shape is fine on its own — the point of mixing them is the combination:
 * a counted item next to an uncounted one, a piece-priced item with no count at
 * all, a bespoke item with no rate card behind it, and the long header values
 * that caused the original overlap, all on the same page.
 */

// Prefixed, like every other record this suite creates. These specs overwrite
// "Property / project", which renames the project — without the prefix here the
// row stops matching the cleanup sweep and survives it.
const LONG_PROPERTY =
  `${PREFIX} Renovation Project | Bedroom | A06, Almond Tree, Kenchanahalli Rd, ` +
  "Yelahanka, New Town, Bengaluru, Karnataka 560064";
const LONG_CLIENT = `${PREFIX} Dr. Pratham Bhatra & Mrs. Anuradha Bhatra-Venkataraman (Joint Owners)`;
const LONG_SCOPE =
  "Providing and installing a full-height wardrobe in 18mm BWP plywood with a " +
  "laminate outer finish and white inner laminate, including soft-close hinges, " +
  "telescopic drawer channels, a hanging rod, three adjustable shelves and a " +
  "lofted overhead storage unit. Site measurements to be reconfirmed before " +
  "fabrication; any deviation beyond 25mm on either axis will be raised as a " +
  "change order before work proceeds. Finish and edge banding as per the " +
  "approved sample board dated on site.";

let projectId = "";

test.describe("A BOQ with every kind of line, through both PDFs", () => {
  test.describe.configure({ mode: "serial" });

  test("build it: counted, piece-priced, plain dimension-driven, and custom", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, testName("Mixed"), LONG_CLIENT);

    await page.goto(`/projects/${projectId}`);
    await page.fill("#pd-name", LONG_PROPERTY);
    await page.fill("#pd-prepared", "Ananya Krishnamurthy");
    await page.click('button:has-text("Save project details")');
    await page.waitForTimeout(1500);

    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".sec-block");

    // 1. Dimension-driven, will get a count of 3.
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    // 2. Dimension-driven, deliberately left at a count of 1.
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 8, b: 9 });
    // 3. Piece-priced — no Count box exists for these at all.
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 7 });
    await waitForSaved(page);

    // 4. A custom item, typed in rather than picked off the rate card.
    await closeEntryForm(page);
    await page.locator(".sec-block").first().locator('button:has-text("Add item")').click();
    await page.waitForSelector(".entry-form");
    const firstRow = page.locator(".entry-form .item-row").first();
    await firstRow.locator("select").nth(0).selectOption({ label: "Other (custom item)" });
    await page.waitForTimeout(400);
    await firstRow.locator("input").nth(0).fill("PLAYWRIGHT Bespoke Niche");
    await firstRow.locator("input").nth(1).fill("Teak");
    await firstRow.locator("input").nth(2).fill("Polished");
    await firstRow.locator("input").nth(3).fill("Nos.");
    const dims = page.locator(".entry-form .item-field.dim input");
    await dims.nth(0).fill("2");
    await page.locator(".entry-form .item-field.dim input").nth(1).fill("4500");
    await page.locator('.entry-form button:has-text("Add item")').click();
    await page.waitForTimeout(1000);
    await closeEntryForm(page);
    await waitForSaved(page);

    expect(await page.locator(".compact-row").count(), "four lines were added").toBe(4);
  });

  test("set a count of 3 on the first line, and a long scope note", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".compact-row");

    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".inline-edit");
    await page.locator('.inline-edit .item-field:has(label:text-is("Count")) input').fill("3");
    await page.waitForTimeout(300);
    await page.locator('.inline-edit button:has-text("Scope & notes")').first().click();
    await page.waitForTimeout(300);
    await page.locator(".inline-edit-details textarea").first().fill(LONG_SCOPE);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(1000);
    await waitForSaved(page);

    // 10 × 12 = 120 each, three of them.
    const qty = await page.locator(".compact-row .cr-qty").first().innerText();
    expect(money(qty), "120 SQFT each, three times over").toBe(360);
    expect(await page.locator(".compact-row .sub-line").first().innerText()).toContain("3 nos.");
  });

  test("the on-screen subtotal is the sum of the four lines", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".compact-row");

    const amounts = (await page.locator(".compact-row .cr-amt").allInnerTexts()).map((t) => money(t)!);
    expect(amounts).toHaveLength(4);
    const summed = amounts.reduce((a, b) => a + b, 0);

    const subtotal = money(
      await page.locator(".sum-row", { hasText: "Subtotal" }).locator(".amt").first().innerText(),
    );
    expect(subtotal, "the summary disagrees with the rows above it").toBeCloseTo(summed, 1);
  });

  test("the Client PDF: nothing overlaps, nothing leaves the page", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".compact-row");

    const layout = pdfLayout(await downloadPdf(page, "Client PDF"));
    expect(layout.runs.length, "no text was read out of the PDF").toBeGreaterThan(30);
    expect(findOverlaps(layout), describeLayoutProblems(layout)).toEqual([]);
    expect(findOutsideMargins(layout), describeLayoutProblems(layout)).toEqual([]);
  });

  test("the Client PDF: counts, quantities and totals are all right", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".compact-row");

    const rowAmounts = (await page.locator(".compact-row .cr-amt").allInnerTexts()).map((t) => money(t)!);
    const expectedGrand = rowAmounts.reduce((a, b) => a + b, 0);

    const pdf = pdfText(await downloadPdf(page, "Client PDF"));

    // The counted line says so; the uncounted ones must not.
    expect(pdf, "the counted line should name its count").toContain("(3 nos.)");
    expect(pdf, "a count of 1 must never be printed").not.toContain("(1 nos.)");
    expect(pdf).toContain("360");

    // The custom item survives with its typed spec.
    expect(pdf).toContain("PLAYWRIGHT Bespoke Niche");
    expect(pdf).toContain("Teak");

    // The long scope note is carried in full, wrapping aside.
    const squashed = pdf.replace(/\s+/g, "");
    expect(squashed, "the long scope note was truncated").toContain(LONG_SCOPE.replace(/\s+/g, ""));
    expect(squashed, "the long property address was truncated").toContain(
      LONG_PROPERTY.replace(/\s+/g, ""),
    );

    const grand = money(pdf.match(/Grand total\s*₹?\s*([\d,.]+)/)?.[1] ?? "");
    expect(grand, "the PDF grand total disagrees with the rows").toBeCloseTo(expectedGrand, 0);

    // A client PDF never carries internal figures.
    expect(pdf).not.toContain("Margin");
    expect(pdf).not.toContain("Internal cost");
  });

  test("the Internal PDF: same layout guarantees, plus cost and margin", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".compact-row");

    const layout = pdfLayout(await downloadPdf(page, "Internal PDF"));
    expect(findOverlaps(layout), describeLayoutProblems(layout)).toEqual([]);
    expect(findOutsideMargins(layout), describeLayoutProblems(layout)).toEqual([]);

    const pdf = pdfText(await downloadPdf(page, "Internal PDF"));
    expect(pdf, "the internal sheet should carry a margin").toContain("Margin");
    expect(pdf, "the count belongs on both sheets").toContain("(3 nos.)");
  });

  test("the client's own view shows the count and the same total", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".compact-row");
    const rowAmounts = (await page.locator(".compact-row .cr-amt").allInnerTexts()).map((t) => money(t)!);
    const expectedSubtotal = rowAmounts.reduce((a, b) => a + b, 0);

    await page.goto(`/projects/${projectId}/client-view`);
    await page.waitForSelector(".cv-row");

    const shown = await page.locator(".cv-row").first().innerText();
    expect(shown, "the client should see how many they're getting").toContain("3 nos.");

    const subtotal = money(
      await page.locator(".cv-summary .row", { hasText: "Subtotal" }).locator("span").last().innerText(),
    );
    expect(subtotal).toBeCloseTo(expectedSubtotal, 1);
  });
});
