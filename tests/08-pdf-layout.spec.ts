import { expect, test } from "@playwright/test";

import {
  PREFIX,
  addItem,
  createProject,
  describeLayoutProblems,
  downloadPdf,
  findOutsideMargins,
  findOverlaps,
  login,
  pdfLayout,
  pdfText,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * PDF layout — that nothing is printed on top of anything else.
 *
 * Text extraction can't catch this on its own: two strings drawn over each
 * other read back as two perfectly good strings, which is why a property
 * address printed across the quote date survived a suite that already checked
 * the PDF's contents. These tests check geometry instead — every string's
 * position and true width, taken from the file — so a collision fails here
 * rather than in front of a client.
 *
 * The values are deliberately long. Short ones fit whatever the layout does,
 * and prove nothing about what happens when a real project name doesn't.
 */

/** The property address from the estimate this was first reported on. */
// Prefixed, like every other record this suite creates. These specs overwrite
// "Property / project", which renames the project — without the prefix here the
// row stops matching the cleanup sweep and survives it.
const LONG_PROPERTY =
  `${PREFIX} Renovation Project | Bedroom | A06, Almond Tree, Kenchanahalli Rd, ` +
  "Yelahanka, New Town, Bengaluru, Karnataka 560064";

const LONG_CLIENT = `${PREFIX} Dr. Pratham Bhatra & Mrs. Anuradha Bhatra-Venkataraman (Joint Owners)`;

test.describe("PDF layout", () => {
  test("a long property address never collides with the date beside it", async ({ page }) => {
    await login(page);
    const name = testName("PDF Long Header");
    const projectId = await createProject(page, name, LONG_CLIENT);

    // The project name is what prints as "Property:", so set it to the address
    // that first showed the overlap.
    await page.goto(`/projects/${projectId}/boq/versions`);
    await page.fill("#pd-name", LONG_PROPERTY);
    await page.fill("#pd-prepared", "Ananya Krishnamurthy");
    await page.click('button:has-text("Save project details")');
    await page.waitForTimeout(1500);

    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);

    const layout = pdfLayout(await downloadPdf(page, "Client PDF"));

    // The header is what broke, so assert on it by name before the sweep below
    // — a failure here should say "the address overlaps the date", not just
    // "something overlaps somewhere".
    const overlaps = findOverlaps(layout);
    const headerCollision = overlaps.find(
      (o) => o.left.includes("Property:") || o.right.includes("Date:"),
    );
    expect(
      headerCollision,
      `the property line is printed over the date:\n${describeLayoutProblems(layout)}`,
    ).toBeUndefined();

    // And the whole address is still there — wrapped, not quietly truncated.
    // Compared with whitespace squeezed out of both sides, since wrapping puts
    // a line break somewhere in the middle of it by design.
    const text = pdfText(await downloadPdf(page, "Client PDF"));
    const squashed = text.replace(/\s+/g, "");
    expect(squashed, "the property address was cut short instead of wrapped").toContain(
      LONG_PROPERTY.replace(/\s+/g, ""),
    );
    expect(squashed).toContain(LONG_CLIENT.replace(/\s+/g, ""));
    expect(text).toContain("Date:");
    expect(text).toContain("Prepared by:");
  });

  test("nothing on the Client PDF overlaps or runs off the page", async ({ page }) => {
    await login(page);
    const projectId = await createProject(page, testName("PDF Sweep"), LONG_CLIENT);

    await page.goto(`/projects/${projectId}/boq/versions`);
    await page.fill("#pd-name", LONG_PROPERTY);
    await page.fill("#pd-prepared", "Ananya Krishnamurthy");
    await page.click('button:has-text("Save project details")');
    await page.waitForTimeout(1500);

    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 6 });
    await waitForSaved(page);

    // Totals wide enough to crowd their labels, and GST so every summary row prints.
    await page.locator(".discount-row input").fill("7.5");
    await page.locator("#gstToggle").check();
    await page.selectOption(".gst-toggle select", "18");
    await page.waitForTimeout(1000);
    await waitForSaved(page);

    const layout = pdfLayout(await downloadPdf(page, "Client PDF"));

    expect(layout.runs.length, "no text was read out of the PDF at all").toBeGreaterThan(20);
    expect(findOverlaps(layout), describeLayoutProblems(layout)).toEqual([]);
    expect(findOutsideMargins(layout), describeLayoutProblems(layout)).toEqual([]);
  });

  test("the Internal PDF holds up too, with its extra cost and margin columns", async ({ page }) => {
    await login(page);
    const projectId = await createProject(page, testName("PDF Internal"), LONG_CLIENT);

    await page.goto(`/projects/${projectId}/boq/versions`);
    await page.fill("#pd-name", LONG_PROPERTY);
    await page.click('button:has-text("Save project details")');
    await page.waitForTimeout(1500);

    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await waitForSaved(page);

    const layout = pdfLayout(await downloadPdf(page, "Internal PDF"));
    expect(findOverlaps(layout), describeLayoutProblems(layout)).toEqual([]);
    expect(findOutsideMargins(layout), describeLayoutProblems(layout)).toEqual([]);
  });

  test("a scope note with no spaces in it is cut to fit rather than run off", async ({ page }) => {
    await login(page);
    const projectId = await createProject(page, testName("PDF Unbroken"));

    await page.goto(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });

    // One token with nowhere to wrap. A word-wrapper can't break this, so
    // without a hard fit it would be drawn straight off the right edge.
    await page.locator('.compact-row button[title="Edit this row"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('.inline-edit button:has-text("Scope & notes")').first().click();
    await page.waitForTimeout(300);
    await page
      .locator(".inline-edit-details textarea")
      .first()
      .fill("REF-" + "X".repeat(400));
    await page.locator('.inline-edit button:has-text("Save")').first().click();
    await page.waitForTimeout(800);
    await waitForSaved(page);

    const layout = pdfLayout(await downloadPdf(page, "Client PDF"));
    expect(findOutsideMargins(layout), describeLayoutProblems(layout)).toEqual([]);
    expect(findOverlaps(layout), describeLayoutProblems(layout)).toEqual([]);
  });
});
