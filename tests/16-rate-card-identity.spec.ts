import { expect, test, type Page } from "@playwright/test";

import { PREFIX, RUN_ID, login } from "./helpers";

/**
 * Rate card: typo-proof fields, duplicating a row, and the duplicate guard.
 *
 * Category + Description + Material + Finish together identify an item, and
 * `findRateRow` takes the first match — so a second row under the same four
 * columns can never be picked in a BOQ, and whatever it charges is quietly
 * unreachable. These tests cover the three things that keep that from
 * happening: existing spellings offered as you type, a copy action so a
 * variant doesn't mean retyping three fields, and a guard on save.
 *
 * Writes to the shared rate card, so it is opt-in and restores what it
 * touches. Don't set the flag against production.
 */

const allowed = process.env.E2E_ALLOW_RATE_WRITES === "1";

const banner = (page: Page) => page.locator(".flash.err", { hasText: "describe the same item" });
const dupRows = (page: Page) => page.locator("tr.dup-row");
const saveBtn = (page: Page) => page.locator('button:has-text("Save rate card")');

async function openRateCard(page: Page) {
  await login(page);
  await page.goto("/settings/rate-card");
  await page.waitForSelector("table.ratecard");
}

/** The cells of one visible row, by column. */
function cell(page: Page, row: number, column: number) {
  return page.locator("table.ratecard tbody tr").nth(row).locator("td").nth(column).locator("input");
}

test.describe("Rate card: suggestions, duplicate, and the duplicate guard", () => {
  test.describe.configure({ mode: "serial" });

  test("the four identity fields are typable, not locked dropdowns", async ({ page }) => {
    await openRateCard(page);
    const row = page.locator("table.ratecard tbody tr").first();

    for (const [column, label] of [
      [0, "Category"],
      [1, "Description"],
      [2, "Material"],
      [3, "Finish"],
    ] as const) {
      const field = row.locator("td").nth(column).locator("input");
      await expect(field, `${label} should be a text box`).toHaveCount(1);
      expect(
        await field.evaluate((el) => (el as HTMLInputElement).tagName),
        `${label} must stay typable`,
      ).toBe("INPUT");
      expect(
        await field.getAttribute("list"),
        `${label} should offer the existing values`,
      ).toBeTruthy();
    }
  });

  test("the suggestions hold the spellings already on the card", async ({ page }) => {
    await openRateCard(page);

    const listId = await cell(page, 0, 2).getAttribute("list");
    const options = await page.locator(`datalist#${listId} option`).evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLOptionElement).value),
    );
    expect(options.length, "the material field offered nothing").toBeGreaterThan(0);

    // The False Ceiling rows use Gypsum Board — the exact string a designer
    // would otherwise retype, and mistype.
    await page.locator(".cat-filter select").first().selectOption({ value: "False Ceiling" });
    await page.waitForTimeout(400);
    const ceilingList = await cell(page, 0, 2).getAttribute("list");
    const ceilingOptions = await page.locator(`datalist#${ceilingList} option`).evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLOptionElement).value),
    );
    expect(ceilingOptions).toContain("Gypsum Board");
  });

  test("a value the card has never seen is flagged as new", async ({ page }) => {
    await openRateCard(page);
    const material = cell(page, 0, 2);
    const original = await material.inputValue();

    // The classic near-miss: one letter out from an existing material.
    await material.fill("Gypsom Board");
    await page.waitForTimeout(400);
    await expect(
      page.locator("table.ratecard tbody tr").first().locator(".new-value-flag"),
      "a misspelling should be marked as a new value, not accepted silently",
    ).toHaveCount(1);

    await material.fill(original);
    await page.waitForTimeout(300);
    await expect(page.locator("table.ratecard tbody tr").first().locator(".new-value-flag")).toHaveCount(
      0,
    );
  });

  test("duplicating a row copies it in place and flags the clash", async ({ page }) => {
    await openRateCard(page);
    await page.locator(".cat-filter select").first().selectOption({ value: "False Ceiling" });
    await page.waitForTimeout(400);

    const before = await page.locator("table.ratecard tbody tr").count();
    const sourceName = await cell(page, 0, 1).inputValue();

    await page
      .locator("table.ratecard tbody tr")
      .first()
      .locator("button.dup-btn")
      .click();
    await page.waitForTimeout(500);

    await expect(page.locator("table.ratecard tbody tr")).toHaveCount(before + 1);
    expect(await cell(page, 1, 1).inputValue(), "the copy should sit right below its source").toBe(
      sourceName,
    );

    // An exact copy is a clash until something is changed, and it says so.
    await expect(dupRows(page), "both the row and its copy should be flagged").toHaveCount(2);
    await expect(banner(page)).toHaveCount(1);

    // Changing the finish resolves it — the whole point of duplicating.
    await cell(page, 1, 3).fill(`${PREFIX} Variant ${RUN_ID}`);
    await page.waitForTimeout(500);
    await expect(dupRows(page), "a different finish makes them different items").toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
  });

  test("a clash introduced here blocks the save", async ({ page }) => {
    test.skip(!allowed, "needs E2E_ALLOW_RATE_WRITES=1");
    await openRateCard(page);
    await page.locator(".cat-filter select").first().selectOption({ value: "False Ceiling" });
    await page.waitForTimeout(400);

    await page
      .locator("table.ratecard tbody tr")
      .first()
      .locator("button.dup-btn")
      .click();
    await page.waitForTimeout(500);
    await expect(banner(page)).toHaveCount(1);

    // Save is offered but refuses, and says which item clashes.
    await saveBtn(page).click();
    await page.waitForTimeout(1500);
    // The editor and the bulk-edit panel each render a toast, so target the
    // one that is actually showing.
    await expect(page.locator("#toast.show")).toContainText(/same item|more than one row/i, {
      timeout: 15_000,
    });

    // Nothing was written.
    await page.reload();
    await page.waitForSelector("table.ratecard");
    await expect(dupRows(page), "the clash was saved despite the guard").toHaveCount(0);
  });

  test("pre-existing clashes are surfaced but do not block an unrelated save", async ({ page }) => {
    test.skip(!allowed, "needs E2E_ALLOW_RATE_WRITES=1");
    await openRateCard(page);

    // The seeded card ships with clashes. They must be visible...
    await page.locator(".cat-filter select").first().selectOption({ value: "__duplicates__" });
    await page.waitForTimeout(500);
    const existing = await page.locator("table.ratecard tbody tr").count();
    expect(existing, "the duplicates filter found nothing to review").toBeGreaterThan(0);

    // ...and must not stop someone editing something else.
    await page.locator(".cat-filter select").first().selectOption({ value: "False Ceiling" });
    await page.waitForTimeout(400);
    const rate = page
      .locator("table.ratecard tbody tr")
      .first()
      .locator("input.r-num")
      .first();
    const original = await rate.inputValue();

    try {
      await rate.fill(String(Number(original) + 1));
      await page.waitForTimeout(400);
      await expect(banner(page), "an unrelated edit should not be blocked").toHaveCount(0);
      await saveBtn(page).click();
      await page.waitForTimeout(2500);

      await page.reload();
      await page.waitForSelector("table.ratecard");
      await page.locator(".cat-filter select").first().selectOption({ value: "False Ceiling" });
      await page.waitForTimeout(400);
      await expect(
        page.locator("table.ratecard tbody tr").first().locator("input.r-num").first(),
      ).toHaveValue(String(Number(original) + 1));
    } finally {
      await page.goto("/settings/rate-card");
      await page.waitForSelector("table.ratecard");
      await page.locator(".cat-filter select").first().selectOption({ value: "False Ceiling" });
      await page.waitForTimeout(400);
      await page
        .locator("table.ratecard tbody tr")
        .first()
        .locator("input.r-num")
        .first()
        .fill(original);
      await page.waitForTimeout(300);
      await saveBtn(page).click();
      await page.waitForTimeout(2500);
    }
  });
});
