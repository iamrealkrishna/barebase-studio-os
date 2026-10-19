import { expect, test } from "@playwright/test";

import {
  addItem,
  createProject,
  downloadPdfText,
  login,
  money,
  moneyOf,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * Line-item count — two wardrobes of the same size on one line.
 *
 * The count multiplies the quantity the dimensions describe, so what's checked
 * here is arithmetic: the row, the section total and the PDF all have to agree
 * that a count of 2 doubles the line, and nothing else moves.
 */

/** Open the first row for editing and return its Count input. */
function countBox(page: import("@playwright/test").Page) {
  return page.locator('.inline-edit .item-field:has(label:text-is("Count")) input');
}

test.describe("Line item count", () => {
  test("a count of 2 doubles the quantity and the amount, and nothing else", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Count"));

    // 10 × 12 SQFT at the rate card's rate — one unit.
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);

    const qtyText = await page.locator(".compact-row .cr-qty").first().innerText();
    const single = await moneyOf(page.locator(".compact-row .cr-amt").first());
    expect(qtyText).toContain("120");
    expect(single).toBeGreaterThan(0);

    // Now say there are two of them.
    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".inline-edit");
    await expect(countBox(page), "a dimension-driven item offers a Count").toHaveValue("1");
    await countBox(page).fill("2");
    await page.waitForTimeout(400);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(800);
    await waitForSaved(page);

    const doubledQty = await page.locator(".compact-row .cr-qty").first().innerText();
    const doubled = await moneyOf(page.locator(".compact-row .cr-amt").first());
    expect(money(doubledQty), "120 SQFT each, twice over").toBe(240);
    expect(doubled).toBeCloseTo(single! * 2, 2);

    // The row says how many, so 240 SQFT isn't left looking like one huge wall.
    const sub = await page.locator(".compact-row .sub-line").first().innerText();
    expect(sub).toContain("2 nos.");
    expect(sub, "the dimensions are still one unit's").toContain("10 × 12 ft");

    // And it survives a reload — the count is stored, not just displayed.
    await page.reload();
    await page.waitForSelector(".compact-row");
    expect(money(await page.locator(".compact-row .cr-qty").first().innerText())).toBe(240);
    expect(await moneyOf(page.locator(".compact-row .cr-amt").first())).toBeCloseTo(single! * 2, 2);
  });

  test("the section and project totals follow the count", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Count Totals"));

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);
    const before = await moneyOf(page.locator(".sum-row", { hasText: "Subtotal" }).locator(".amt").first());

    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".inline-edit");
    await countBox(page).fill("3");
    await page.waitForTimeout(400);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(800);
    await waitForSaved(page);

    const after = await moneyOf(page.locator(".sum-row", { hasText: "Subtotal" }).locator(".amt").first());
    expect(after, "three of them costs three times as much").toBeCloseTo(before! * 3, 1);
  });

  test("the client's PDF bills the full quantity and says how many", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Count PDF"));

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);

    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".inline-edit");
    await countBox(page).fill("2");
    await page.waitForTimeout(400);
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(800);
    await waitForSaved(page);

    const expected = await moneyOf(page.locator(".compact-row .cr-amt").first());

    const pdf = await downloadPdfText(page, "Client PDF");
    expect(pdf, "the count is named beside the item, not left to be inferred").toContain("(2 nos.)");
    expect(pdf).toContain("240");
    expect(money(pdf.match(/Grand total\s*₹?\s*([\d,.]+)/)?.[1] ?? "")).toBeCloseTo(expected!, 0);
  });

  test("a count of 1 changes nothing about how a line reads", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Count One"));

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);

    // The default. No "1 nos." anywhere, on screen or in the PDF.
    const sub = await page.locator(".compact-row .sub-line").first().innerText();
    expect(sub).not.toContain("nos.");

    const pdf = await downloadPdfText(page, "Client PDF");
    expect(pdf).not.toContain("(1 nos.)");
  });

  test("items priced by the piece have no Count box, since Qty already is one", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Count Nos"));

    // Switches & Sockets is a Nos. item — its quantity is typed, not measured.
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 4 });
    await waitForSaved(page);

    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".inline-edit");
    await expect(
      countBox(page),
      "a second box meaning the same as Qty is how a line gets billed twice",
    ).toHaveCount(0);
  });
});
