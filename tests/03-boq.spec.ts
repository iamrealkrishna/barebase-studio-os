import { expect, test } from "@playwright/test";

import { addItem, addSection, createProject, login, money, testName, waitForSaved } from "./helpers";

/**
 * The two items are picked for what they exercise rather than what they cost:
 * Painting is SQFT so its quantity comes from Length × Breadth, and Switches &
 * Sockets is Nos. so it takes a typed quantity. Rates come from the rate card,
 * so the expected totals are read off the page rather than hard-coded — a rate
 * change shouldn't fail a test about arithmetic.
 */
test.describe("Building a BOQ", () => {
  test.describe.configure({ mode: "serial" });

  test("create a project, add a room, add items, and the totals add up", async ({ page }) => {
    await login(page);
    const projectId = await createProject(page, testName("BOQ"));

    // A room section on top of the three fixed ones.
    await addSection(page, "Kitchen");
    const sectionNames = await page.locator(".sec-name").allInnerTexts();
    expect(sectionNames).toEqual(["Electrical Work", "Wall Works", "Other", "Kitchen"]);

    await addItem(page, { section: "Electrical Work", category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await addItem(page, { section: "Kitchen", category: "Electrical Works", desc: "Switches & Sockets", l: 6 });
    await waitForSaved(page);

    const rows = page.locator(".compact-row");
    await expect(rows).toHaveCount(2);

    // Each row: quantity × rate should equal the amount it shows.
    let expectedSubtotal = 0;
    for (const row of await rows.all()) {
      const qtyAtRate = await row.locator(".cr-qty").innerText();
      const parsed = qtyAtRate.match(/^([\d.]+)\s+\S*\s*@\s*([\d,.]+)/);
      expect(parsed, `couldn't read "qty @ rate" out of ${JSON.stringify(qtyAtRate)}`).not.toBeNull();

      const qty = Number(parsed![1]);
      const rate = money(parsed![2])!;
      const amount = money(await row.locator(".cr-amt").innerText())!;

      expect(qty).toBeGreaterThan(0);
      expect(rate).toBeGreaterThan(0);
      expect(amount).toBeCloseTo(qty * rate, 2);
      expectedSubtotal += amount;
    }

    // SQFT quantity really is length × breadth.
    const painting = page.locator(".compact-row", { hasText: "Painting" }).first();
    expect(await painting.locator(".cr-qty").innerText()).toMatch(/^120\s/);

    // And the summary agrees with the sum of the rows.
    const subtotal = money(
      await page.locator(".sum-row", { hasText: "Subtotal" }).locator(".amt").innerText(),
    );
    expect(subtotal).toBeCloseTo(expectedSubtotal, 2);

    const grand = money(await page.locator(".sum-row.total .amt").innerText());
    expect(grand, "no discount or GST yet, so the grand total is the subtotal").toBeCloseTo(
      expectedSubtotal,
      2,
    );

    // Survives a reload — this is the database, not component state.
    await page.goto(`/projects/${projectId}/boq`);
    await expect(page.locator(".compact-row")).toHaveCount(2);
    expect(money(await page.locator(".sum-row.total .amt").innerText())).toBeCloseTo(expectedSubtotal, 2);
  });

  test("discount and GST feed through to the grand total", async ({ page }) => {
    await login(page);
    const projectId = await createProject(page, testName("Totals"));
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 10 });
    await waitForSaved(page);

    const subtotal = money(
      await page.locator(".sum-row", { hasText: "Subtotal" }).locator(".amt").innerText(),
    )!;

    // 10% off, then 18% GST on what's left.
    await page.locator(".discount-row input").fill("10");
    await page.locator(".discount-row select").selectOption("pct");
    await page.waitForTimeout(600);
    await page.locator("#gstToggle").check();
    await page.selectOption(".gst-toggle select", "18");
    await page.waitForTimeout(800);
    await waitForSaved(page);

    const afterDiscount = subtotal * 0.9;
    const cgst = money(await page.locator(".sum-row", { hasText: "CGST" }).locator(".amt").innerText())!;
    const sgst = money(await page.locator(".sum-row", { hasText: "SGST" }).locator(".amt").innerText())!;
    const grand = money(await page.locator(".sum-row.total .amt").innerText())!;

    expect(cgst).toBeCloseTo(afterDiscount * 0.09, 1);
    expect(sgst).toBeCloseTo(afterDiscount * 0.09, 1);
    expect(grand).toBeCloseTo(afterDiscount + cgst + sgst, 1);

    expect(projectId).toBeTruthy();
  });

  test("inline editing: several rows open at once, saved together", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Inline"));
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 10 });
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 4 });
    await waitForSaved(page);

    // Open both rows. Re-queried each time: opening a row replaces it with the
    // editor, so a list of locators grabbed up front goes stale immediately.
    for (let i = 0; i < 2; i++) {
      await page
        .locator('.compact-row:not(.editing-row) button[title="Edit this row"]')
        .first()
        .click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator(".compact-row.editing-row")).toHaveCount(2);
    await expect(page.locator(".edit-bar-count")).toContainText("2 rows open");

    // Change the rate on both, then commit them in one go.
    const editing = page.locator(".compact-row.editing-row");
    await editing.nth(0).locator(".item-field.dim input").last().fill("111");
    await editing.nth(1).locator(".item-field.dim input").last().fill("222");
    await page.waitForTimeout(400);

    await page.locator('.edit-bar button:has-text("Save all")').click();
    await page.waitForTimeout(1500);
    await expect(page.locator(".compact-row.editing-row")).toHaveCount(0);
    await waitForSaved(page);

    await page.reload();
    const rates = (await page.locator(".compact-row .cr-qty").allInnerTexts()).map((t) =>
      money(t.split("@")[1]),
    );
    expect(rates).toContain(111);
    expect(rates).toContain(222);
  });

  test("inline editing: Cancel discards without saving", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Cancel"));
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 10 });
    await waitForSaved(page);

    const before = await page.locator(".compact-row .cr-qty").innerText();

    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForTimeout(400);
    await page.locator(".compact-row.editing-row .item-field.dim input").last().fill("9999");
    await page.waitForTimeout(300);
    await page.locator('.compact-row.editing-row button:has-text("Cancel")').click();
    await page.waitForTimeout(800);

    expect(await page.locator(".compact-row .cr-qty").innerText()).toBe(before);
    await page.reload();
    expect(await page.locator(".compact-row .cr-qty").innerText()).toBe(before);
  });

  test("switching an item's Category re-drives the whole cascade", async ({ page }) => {
    await login(page);
    await createProject(page, testName("Category"));
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 10 });
    await waitForSaved(page);

    await expect(page.locator(".compact-row .sub-line")).toContainText("Civil & Infra Works");

    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".compact-row.editing-row");
    const editing = page.locator(".compact-row.editing-row").first();
    const selects = editing.locator("select");

    await selects.nth(0).selectOption({ label: "Electrical Works" });
    await page.waitForTimeout(700);

    // Description now offers Electrical Works items, not Civil ones.
    const descriptions = await selects.nth(1).locator("option").allInnerTexts();
    expect(descriptions.join(" ")).toContain("Switches & Sockets");
    expect(descriptions.join(" ")).not.toContain("Painting");

    await selects.nth(1).selectOption({ label: "Switches & Sockets" });
    await page.waitForTimeout(700);
    await editing.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1500);
    await waitForSaved(page);

    await page.reload();
    const row = page.locator(".compact-row").first();
    await expect(row.locator(".main-line")).toContainText("Switches & Sockets");
    await expect(row.locator(".sub-line")).toContainText("Electrical Works");
    // The unit followed the category, so quantity is a plain number now.
    await expect(row.locator(".cr-qty")).toContainText("Nos.");
  });
});
