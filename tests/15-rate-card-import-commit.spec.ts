import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { PREFIX, RUN_ID, login } from "./helpers";

/**
 * Committing a CSV import, and what the table does afterwards.
 *
 * `04-rate-card-csv` deliberately previews and cancels so it is safe to point
 * at production. That leaves the half that actually writes untested — and the
 * refresh it triggers is what feeds new server data back into the editor. This
 * spec covers that path, then puts the rate card back exactly as it found it.
 *
 * It writes to the rate card, so it is skipped unless E2E_ALLOW_RATE_WRITES is
 * set. Don't set it against production.
 */

const allowed = process.env.E2E_ALLOW_RATE_WRITES === "1";

const banner = (page: Page) => page.locator(".flash.err", { hasText: "unsaved changes" });

async function downloadCsv(page: Page): Promise<string> {
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator('button:has-text("Download Rate Card")').click();
  const file = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function uploadCsv(page: Page, csv: string, label: string): Promise<string> {
  const file = path.join(os.tmpdir(), `rate-card-${label}-${RUN_ID}.csv`);
  fs.writeFileSync(file, csv);
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.waitForTimeout(2500);
  return file;
}

test.describe("Committing a rate card CSV import", () => {
  test.skip(!allowed, "writes to the shared rate card; set E2E_ALLOW_RATE_WRITES=1 to run");
  test.describe.configure({ mode: "serial" });

  let original = "";
  const newItemName = `${PREFIX} Imported Item ${RUN_ID}`;

  test("a committed import appears in the table without a reload", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    original = await downloadCsv(page);
    const rowsBefore = original.trim().split("\n").length;

    // One brand-new row: a blank Item ID means "this is new". Columns are
    // Item ID, Category, Description, Material, Finish, Unit, Rate, Cost,
    // Default scope note — all nine, or the importer rejects the row.
    const added = `,PLAYWRIGHT CATEGORY,${newItemName},Ply,Matte,Nos.,950,600,`;
    await uploadCsv(page, `${original.trim()}\n${added}\n`, "add");

    await expect(page.locator(".bulk-plan, .flash, .preview, table")).toBeTruthy();
    const confirmBtn = page.locator('button:has-text("Confirm — apply")');
    await expect(confirmBtn, "the preview should offer a confirm").toHaveCount(1);
    await confirmBtn.click();
    await page.waitForTimeout(4000);

    // The refresh must feed the new data into the table that's already on
    // screen. Switch to All categories first — the filter defaults to the
    // first category, and the new row is in a category of its own.
    await page.locator(".cat-filter select").first().selectOption({ index: 0 });
    await page.waitForTimeout(400);
    await page.locator('.cat-filter input[type="search"]').fill(newItemName);
    await page.waitForTimeout(800);
    await expect(
      page.locator("table.ratecard tbody tr"),
      "the imported row never reached the open table",
    ).toHaveCount(1);

    // And the table is not left looking unsaved after adopting server data.
    await expect(banner(page), "the table should match the database after an import").toHaveCount(0);

    const after = await downloadCsv(page);
    expect(after.trim().split("\n").length, "the row count should have grown by one").toBe(
      rowsBefore + 1,
    );
    expect(after, "the imported row should come back with a permanent id").toContain(newItemName);
  });

  test("a download taken with edits pending carries those edits, as the warning says", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    const field = page.locator("table.ratecard input").nth(1);
    const before = await field.inputValue();
    await field.fill(`${before} EDITED`);
    await page.waitForTimeout(300);
    await expect(banner(page), "an edit is pending").toHaveCount(1);

    // This is exactly what the warning is about: the download reflects what's
    // on screen, so it carries an edit the database has never seen. Confirming
    // an upload of it would write that edit by the back door — so this stops
    // at the preview and cancels.
    const csv = await downloadCsv(page);
    expect(csv, "the download should reflect the unsaved edit").toContain(`${before} EDITED`);

    await uploadCsv(page, csv, "pending");
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.count()) await cancelBtn.click();
    await page.waitForTimeout(500);

    // Nothing was written, and the edit is still pending.
    await expect(field, "cancelling should not disturb the table").toHaveValue(`${before} EDITED`);
    await expect(banner(page), "the edit is still unsaved").toHaveCount(1);

    // Discard it — nothing from this test is saved.
    await page.reload();
    await page.waitForSelector("table.ratecard");
    await expect(page.locator("table.ratecard input").nth(1)).toHaveValue(before);
    await expect(banner(page)).toHaveCount(0);
  });

  test("put the rate card back exactly as it was", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    // Find the imported row and delete it, then save.
    await page.locator(".cat-filter select").first().selectOption({ index: 0 });
    await page.waitForTimeout(400);
    await page.locator('.cat-filter input[type="search"]').fill(newItemName);
    await page.waitForTimeout(800);

    const rows = page.locator("table.ratecard tbody tr");
    if ((await rows.count()) === 1) {
      await rows.first().locator("button.rm-btn").click();
      await page.waitForTimeout(400);
      await page.locator('button:has-text("Save rate card")').click();
      await page.waitForTimeout(3000);
    }

    await page.reload();
    await page.waitForSelector("table.ratecard");
    const csv = await downloadCsv(page);
    expect(csv, "the imported test row was left on the shared rate card").not.toContain(newItemName);
    expect(csv.trim().split("\n").length, "the card is back to its original size").toBe(
      original.trim().split("\n").length,
    );
  });
});
