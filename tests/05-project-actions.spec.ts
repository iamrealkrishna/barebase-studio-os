import { expect, test } from "@playwright/test";

import { addItem, addSection, createProject, login, money, testName, waitForSaved } from "./helpers";

/** The compact rows as plain strings, for comparing one project against another. */
async function rowSummaries(page: import("@playwright/test").Page): Promise<string[]> {
  const rows = await page.locator(".compact-row").all();
  const out: string[] = [];
  for (const row of rows) {
    const name = (await row.locator(".main-line").innerText()).trim();
    const spec = (await row.locator(".sub-line").innerText()).trim();
    const qty = (await row.locator(".cr-qty").innerText()).trim();
    const amount = (await row.locator(".cr-amt").innerText()).trim();
    out.push([name, spec, qty, amount].join(" | "));
  }
  return out.sort();
}

test.describe("Project actions", () => {
  test.describe.configure({ mode: "serial" });

  test("duplicate a project and every line carries over", async ({ page }) => {
    await login(page);
    const sourceName = testName("Duplicate Source");
    const sourceId = await createProject(page, sourceName);

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 5 });
    await waitForSaved(page);

    const before = await rowSummaries(page);
    const beforeTotal = money(await page.locator(".sum-row.total .amt").innerText());
    expect(before).toHaveLength(2);

    // Duplicate from the Projects list.
    const copyName = testName("Duplicate Copy");
    await page.goto("/projects");
    await page.locator(".proj-row", { hasText: sourceName }).locator('button:has-text("Duplicate")').click();
    await page.waitForSelector(".modal");
    const modal = page.locator(".modal");
    await modal.locator('input[name="name"]').fill(copyName);
    await modal.locator('button[type="submit"]').click();
    await page.waitForURL("**/boq", { timeout: 45_000 });
    await page.waitForSelector(".sec-block");

    const copyId = page.url().match(/projects\/([^/]+)\/boq/)![1];
    expect(copyId).not.toBe(sourceId);

    const after = await rowSummaries(page);
    expect(after, "the copy has the same lines as the source").toEqual(before);
    expect(money(await page.locator(".sum-row.total .amt").innerText())).toBeCloseTo(beforeTotal!, 2);

    // A fresh Draft with no history of its own.
    await page.goto(`/projects/${copyId}/boq/versions`);
    await expect(page.locator(".no-versions")).toBeVisible();

    // And genuinely a copy: editing it doesn't touch the source.
    await page.goto(`/projects/${copyId}/boq`);
    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".compact-row.editing-row");
    await page.locator(".compact-row.editing-row .item-field.dim input").last().fill("31337");
    await page.locator('.compact-row.editing-row button:has-text("Save")').click();
    await page.waitForTimeout(1500);
    await waitForSaved(page);

    await page.goto(`/projects/${sourceId}/boq`);
    await page.waitForSelector(".compact-row");
    expect(await rowSummaries(page), "the source is untouched").toEqual(before);
  });

  test("import line items from another project", async ({ page }) => {
    await login(page);

    // A source with a room section, so the merge/append behaviour shows.
    const sourceName = testName("Import Source");
    await createProject(page, sourceName);
    await addItem(page, { section: "Electrical Work", category: "Electrical Works", desc: "Switches & Sockets", l: 3 });
    await addSection(page, "Kitchen");
    await addItem(page, { section: "Kitchen", category: "Civil & Infra Works", desc: "Painting", l: 8, b: 8 });
    await waitForSaved(page);
    const sourceRows = await rowSummaries(page);
    expect(sourceRows).toHaveLength(2);

    // The target starts empty.
    const targetId = await createProject(page, testName("Import Target"));
    await expect(page.locator(".compact-row")).toHaveCount(0);

    await page.click('button:has-text("Import from project")');
    await page.waitForSelector(".modal");
    const picker = page.locator(".modal");
    // Options read "<name> — <client> · N items", so match on the text rather
    // than an exact label (selectOption takes no regex).
    const chooser = picker.locator("select").first();
    const optionValues = await chooser.locator("option").evaluateAll((nodes, name) =>
      nodes
        .filter((node) => node.textContent?.includes(name as string))
        .map((node) => (node as HTMLOptionElement).value),
    sourceName);
    expect(optionValues, `"${sourceName}" should be offered as an import source`).toHaveLength(1);
    await chooser.selectOption(optionValues[0]);
    await page.waitForTimeout(1500);

    // The picker says what will happen to each section before importing.
    await expect(picker).toContainText("merges into your existing section");
    await expect(picker).toContainText("will be added as a new section");

    await picker.locator('button:has-text("Import")').click();
    await page.waitForTimeout(2000);
    await waitForSaved(page);

    expect(await rowSummaries(page), "every picked line came across").toEqual(sourceRows);

    // Kitchen didn't exist in the target, so it was added.
    const sections = await page.locator(".sec-name").allInnerTexts();
    expect(sections).toContain("Kitchen");

    // Copies, not links.
    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForSelector(".compact-row.editing-row");
    await page.locator(".compact-row.editing-row .item-field.dim input").last().fill("4242");
    await page.locator('.compact-row.editing-row button:has-text("Save")').click();
    await page.waitForTimeout(1500);
    await waitForSaved(page);

    await page.goto("/projects");
    await page.locator(".proj-row-main", { hasText: sourceName }).click();
    await page.waitForSelector(".compact-row");
    expect(await rowSummaries(page), "the source project is untouched").toEqual(sourceRows);

    expect(targetId).toBeTruthy();
  });
});
