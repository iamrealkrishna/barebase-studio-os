import { expect, test } from "@playwright/test";

import {
  addItem,
  amountAfter,
  createProject,
  downloadPdfText,
  login,
  money,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * GST on the Client PDF.
 *
 * The check is arithmetic rather than a string match: the line amounts are read
 * off the BOQ, the discount applied, and CGST/SGST computed at half the chosen
 * rate each — then compared with what the PDF actually printed. A PDF that
 * carried the right words but the wrong numbers would fail.
 */
test.describe("GST on the Client PDF", () => {
  test("CGST/SGST split matches the line items and the tax setting", async ({ page }) => {
    await login(page);
    await createProject(page, testName("GST"));

    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 12 });
    await addItem(page, { category: "Electrical Works", desc: "Switches & Sockets", l: 4 });
    await waitForSaved(page);

    // Line amounts, straight off the rows.
    const amounts = (await page.locator(".compact-row .cr-amt").allInnerTexts()).map((t) => money(t)!);
    expect(amounts).toHaveLength(2);
    const subtotal = amounts.reduce((a, b) => a + b, 0);

    // A discount as well, so the tax base is not simply the subtotal.
    await page.locator(".discount-row input").fill("5");
    await page.locator(".discount-row select").selectOption("pct");
    await page.waitForTimeout(600);
    await page.locator("#gstToggle").check();
    await page.selectOption(".gst-toggle select", "18");
    await page.waitForTimeout(1000);
    await waitForSaved(page);

    const taxBase = subtotal * 0.95;
    const expectedHalf = taxBase * 0.09; // 18% split into CGST + SGST
    const expectedGrand = taxBase + expectedHalf * 2;

    // What the app shows on screen.
    const onScreenCgst = money(
      await page.locator(".sum-row", { hasText: "CGST" }).locator(".amt").innerText(),
    )!;
    const onScreenSgst = money(
      await page.locator(".sum-row", { hasText: "SGST" }).locator(".amt").innerText(),
    )!;
    expect(onScreenCgst).toBeCloseTo(expectedHalf, 1);
    expect(onScreenSgst).toBeCloseTo(expectedHalf, 1);

    // What the Client PDF prints.
    const pdf = await downloadPdfText(page, "Client PDF");

    expect(pdf, "the PDF names the split at half the rate each").toContain("CGST @ 9%");
    expect(pdf).toContain("SGST @ 9%");
    expect(pdf).toContain("Subtotal");
    expect(pdf).toContain("Grand total");

    const pdfCgst = amountAfter(pdf, "CGST @ 9%");
    const pdfSgst = amountAfter(pdf, "SGST @ 9%");
    const pdfSubtotal = amountAfter(pdf, "Subtotal");
    const pdfGrand = amountAfter(pdf, "Grand total");

    expect(pdfCgst, "could not read CGST out of the PDF").not.toBeNull();
    expect(pdfSgst, "could not read SGST out of the PDF").not.toBeNull();
    expect(pdfSubtotal, "could not read the subtotal out of the PDF").not.toBeNull();
    expect(pdfGrand, "could not read the grand total out of the PDF").not.toBeNull();

    expect(pdfSubtotal, "PDF subtotal matches the line items").toBeCloseTo(subtotal, 0);
    expect(pdfCgst, "PDF CGST is 9% of the discounted subtotal").toBeCloseTo(expectedHalf, 0);
    expect(pdfSgst, "PDF SGST is 9% of the discounted subtotal").toBeCloseTo(expectedHalf, 0);
    expect(pdfCgst).toBeCloseTo(pdfSgst!, 2);
    expect(pdfGrand, "PDF grand total is base + both halves").toBeCloseTo(expectedGrand, 0);

    // A client PDF never carries internal figures.
    expect(pdf).not.toContain("Margin");
    expect(pdf).not.toContain("Internal cost");
  });

  test("a different GST rate splits correctly too", async ({ page }) => {
    await login(page);
    await createProject(page, testName("GST 5pc"));
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 10, b: 10 });
    await waitForSaved(page);

    const subtotal = money(await page.locator(".compact-row .cr-amt").first().innerText())!;

    await page.locator("#gstToggle").check();
    await page.selectOption(".gst-toggle select", "5");
    await page.waitForTimeout(1000);
    await waitForSaved(page);

    const pdf = await downloadPdfText(page, "Client PDF");
    expect(pdf).toContain("CGST @ 2.5%");
    expect(pdf).toContain("SGST @ 2.5%");

    const half = subtotal * 0.025;
    expect(amountAfter(pdf, "CGST @ 2.5%")).toBeCloseTo(half, 0);
    expect(amountAfter(pdf, "SGST @ 2.5%")).toBeCloseTo(half, 0);
  });
});
