import { expect, test } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { login } from "./helpers";

/**
 * The rate card is one shared record used by every project, so this spec is
 * deliberately read-only: it exports, edits a copy, uploads it, checks the
 * preview describes exactly the right changes — and then cancels.
 *
 * That is the step worth testing anyway ("nothing is written until you
 * confirm"), and it means the suite can be pointed at production without
 * rewriting the studio's live prices. The last test proves the cancel really
 * left the card untouched.
 */
test.describe("Rate card CSV", () => {
  test.describe.configure({ mode: "serial" });

  const tmp = path.join(os.tmpdir(), `pw-ratecard-${Date.now()}`);
  let header: string[] = [];
  let rows: string[] = [];
  let firstBefore: { id: string; category: string; name: string; rate: string } | null = null;

  test.beforeAll(() => fs.mkdirSync(tmp, { recursive: true }));

  test("export carries an Item ID column", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.click('button:has-text("Download Rate Card")');
    const file = path.join(tmp, "rates.csv");
    await (await download).saveAs(file);

    const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "").trim();
    const lines = text.split("\r\n");
    header = lines[0].split(",");
    rows = lines.slice(1);

    expect(header[0]).toBe("Item ID");
    expect(header).toContain("Category");
    expect(header).toContain("Description");
    expect(header).toContain("Rate");
    expect(rows.length).toBeGreaterThan(10);

    // Every row should carry a real id, or ID-matching can't work.
    const withoutId = rows.filter((row) => row.split(",")[0].trim() === "");
    expect(withoutId, "every exported row should have an Item ID").toHaveLength(0);

    const cells = rows[0].split(",");
    firstBefore = { id: cells[0], category: cells[1], name: cells[2], rate: cells[6] };
  });

  test("the preview describes an ID-matched edit before anything is written", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    // Change the rate on the first row, keeping its Item ID — the matching
    // path this whole column exists for.
    const edited = [...rows];
    const cells = rows[0].split(",");
    const newRate = String(Number(firstBefore!.rate) + 7);
    cells[6] = newRate;
    edited[0] = cells.join(",");

    const file = path.join(tmp, "rates-edited.csv");
    fs.writeFileSync(file, "﻿" + [header.join(","), ...edited].join("\r\n") + "\r\n", "utf8");

    await page.setInputFiles('input[type="file"]', file);
    await expect(page.locator(".hint-text", { hasText: "data row" })).toBeVisible({ timeout: 60_000 });

    const summary = (await page.locator(".hint-text", { hasText: "data row" }).innerText()).replace(/\s+/g, " ");
    expect(summary).toContain(`${rows.length} data rows read`);
    expect(summary, "exactly one row was edited").toContain("1 to update");
    expect(summary, "an ID-matched edit is not a new item").toContain("0 to add");
    expect(summary).toContain("0 skipped");

    // The preview names the item and the old -> new value.
    const updates = page.locator(".entry-form-label", { hasText: "will be updated" });
    await expect(updates).toBeVisible();
    const updateRow = updates.locator("xpath=following-sibling::table[1]").locator("tbody tr").first();
    await expect(updateRow).toContainText(firstBefore!.name);
    await expect(updateRow).toContainText("Rate:");
    await expect(updateRow.locator(".from")).toHaveText(firstBefore!.rate);
    await expect(updateRow.locator(".to")).toHaveText(newRate);

    // Nothing has been written yet — the confirm button still offers to do it.
    await expect(page.locator('button:has-text("Confirm")')).toBeVisible();
    await expect(page.locator("h4", { hasText: "nothing has been saved yet" })).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button:has-text("Confirm")')).toHaveCount(0);
  });

  test("a row with a blank Item ID previews as a new item", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    const added = `,PLAYWRIGHT TEST Category,PLAYWRIGHT TEST Item,Ply,Duco,SQFT,410,220,Boilerplate scope`;
    const file = path.join(tmp, "rates-new.csv");
    fs.writeFileSync(file, "﻿" + [header.join(","), ...rows, added].join("\r\n") + "\r\n", "utf8");

    await page.setInputFiles('input[type="file"]', file);
    await expect(page.locator(".hint-text", { hasText: "data row" })).toBeVisible({ timeout: 60_000 });

    const summary = (await page.locator(".hint-text", { hasText: "data row" }).innerText()).replace(/\s+/g, " ");
    expect(summary).toContain("1 to add");
    expect(summary).toContain("0 to update");

    const inserts = page.locator(".entry-form-label", { hasText: "will be added" });
    await expect(inserts).toBeVisible();
    await expect(inserts.locator("xpath=following-sibling::table[1]")).toContainText("PLAYWRIGHT TEST Item");

    // Cancel — this spec never commits.
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button:has-text("Confirm")')).toHaveCount(0);
  });

  test("a bad row is reported with a reason, and doesn't block the rest", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    const file = path.join(tmp, "rates-bad.csv");
    fs.writeFileSync(
      file,
      "﻿" +
        [
          header.join(","),
          ...rows,
          `,,PLAYWRIGHT TEST No Category,Ply,Duco,SQFT,100,50,`,
          `,PLAYWRIGHT TEST Cat,PLAYWRIGHT TEST Bad Rate,Ply,Duco,SQFT,not-a-number,50,`,
        ].join("\r\n") +
        "\r\n",
      "utf8",
    );

    await page.setInputFiles('input[type="file"]', file);
    await expect(page.locator(".hint-text", { hasText: "data row" })).toBeVisible({ timeout: 60_000 });

    const rejected = page.locator(".entry-form-label", { hasText: "skipped" });
    await expect(rejected).toBeVisible();
    const table = rejected.locator("xpath=following-sibling::table[1]");
    await expect(table).toContainText("Category is blank");
    await expect(table).toContainText(`Rate "not-a-number" isn't a number`);

    await page.click('button:has-text("Cancel")');
  });

  test("cancelling really did leave the rate card alone", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForSelector("table.ratecard");

    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.click('button:has-text("Download Rate Card")');
    const file = path.join(tmp, "rates-after.csv");
    await (await download).saveAs(file);

    const after = fs.readFileSync(file, "utf8").replace(/^﻿/, "").trim().split("\r\n");
    expect(after.length - 1, "no rows added or removed").toBe(rows.length);
    expect(after[1], "the row we previewed an edit for is unchanged").toBe(rows[0]);
  });
});
