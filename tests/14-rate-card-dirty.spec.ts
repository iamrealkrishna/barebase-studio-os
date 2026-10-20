import { expect, test, type Page } from "@playwright/test";

import { PREFIX, RUN_ID, login } from "./helpers";

/**
 * The "unsaved changes" warning on the rate card.
 *
 * It is measured by comparing the table against what the server last sent, not
 * latched by the act of typing. A latch can't tell an edit from an edit that
 * was undone, so adding a row and deleting it again — or typing a character
 * and removing it — left the warning showing over a table identical to the
 * database. That matters beyond tidiness: the warning tells people not to
 * upload a CSV, so a false one blocks real work.
 *
 * Both directions are checked here. A warning that never appears would pass
 * half these tests and be worse than the bug.
 */

const banner = (page: Page) => page.locator(".flash.err", { hasText: "unsaved changes" });
const saveButton = (page: Page) => page.locator('button:has-text("Save rate card")');

async function openRateCard(page: Page) {
  await login(page);
  await page.goto("/settings/rate-card");
  await page.waitForSelector("table.ratecard");
}

test.describe("Rate card unsaved-changes warning", () => {
  test("a fresh page has no warning and a disabled Save", async ({ page }) => {
    await openRateCard(page);
    await expect(banner(page)).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    // .first(): the Bulk edit heading also contains the words "rate card".
    await expect(page.locator("h3", { hasText: "Rate card" }).first()).not.toContainText(
      "unsaved changes",
    );
  });

  test("clicking around, filtering and searching change nothing", async ({ page }) => {
    await openRateCard(page);

    await page.locator("table.ratecard input").first().click();
    await page.locator("table.ratecard textarea.scope-cell").first().click();
    await page.keyboard.press("Tab");

    const categories = page.locator(".cat-filter select").first();
    if ((await categories.locator("option").count()) > 1) {
      await categories.selectOption({ index: 1 });
      await page.waitForTimeout(400);
    }
    await page.locator('.cat-filter input[type="search"]').fill("ply");
    await page.waitForTimeout(500);

    await expect(banner(page)).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
  });

  test("a real edit does raise the warning", async ({ page }) => {
    await openRateCard(page);
    const field = page.locator("table.ratecard input").nth(1);
    const original = await field.inputValue();

    await field.fill(`${original} ${PREFIX}`);
    await page.waitForTimeout(400);

    await expect(banner(page), "a genuine edit must still warn").toHaveCount(1);
    await expect(saveButton(page)).toBeEnabled();
  });

  test("undoing that edit clears the warning again", async ({ page }) => {
    await openRateCard(page);
    const field = page.locator("table.ratecard input").nth(1);
    const original = await field.inputValue();

    await field.fill(`${original}X`);
    await page.waitForTimeout(300);
    await expect(banner(page)).toHaveCount(1);

    await field.fill(original);
    await page.waitForTimeout(400);
    await expect(banner(page), "the table matches the database again").toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
  });

  test("adding a row warns, and deleting it again clears the warning", async ({ page }) => {
    await openRateCard(page);
    const before = await page.locator("table.ratecard tbody tr").count();

    await page.locator('button:has-text("Add rate item")').click();
    await page.waitForTimeout(400);
    await expect(page.locator("table.ratecard tbody tr")).toHaveCount(before + 1);
    await expect(banner(page), "a new row is a real change").toHaveCount(1);

    await page.locator("table.ratecard tbody tr").last().locator("button.rm-btn").click();
    await page.waitForTimeout(400);
    await expect(page.locator("table.ratecard tbody tr")).toHaveCount(before);
    await expect(banner(page), "the row was removed again — nothing differs").toHaveCount(0);
  });

  test("saving a real edit clears the warning and sticks", async ({ page }) => {
    await openRateCard(page);
    const field = page.locator("table.ratecard input").nth(1);
    const original = await field.inputValue();
    const edited = `${PREFIX} ${RUN_ID}`;

    try {
      await field.fill(edited);
      await page.waitForTimeout(300);
      await expect(banner(page)).toHaveCount(1);

      await saveButton(page).click();
      await expect(banner(page), "a saved card has no unsaved changes").toHaveCount(0, {
        timeout: 30_000,
      });
      await expect(saveButton(page)).toBeDisabled();

      // And it really was written, not just visually cleared.
      await page.reload();
      await page.waitForSelector("table.ratecard");
      await expect(page.locator("table.ratecard input").nth(1)).toHaveValue(edited);
      await expect(banner(page)).toHaveCount(0);
    } finally {
      // Put the rate card back exactly as it was — this is a shared record.
      await page.goto("/settings/rate-card");
      await page.waitForSelector("table.ratecard");
      await page.locator("table.ratecard input").nth(1).fill(original);
      await page.waitForTimeout(300);
      await saveButton(page).click();
      await expect(banner(page)).toHaveCount(0, { timeout: 30_000 });
    }
  });

  test("the restored card is clean, so the rate card is as the suite found it", async ({ page }) => {
    await openRateCard(page);
    await expect(banner(page)).toHaveCount(0);
    expect(
      await page.locator("table.ratecard input").nth(1).inputValue(),
      "the test edit was left behind on a shared record",
    ).not.toContain(PREFIX);
  });
});
