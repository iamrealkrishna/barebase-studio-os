import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import {
  PREFIX,
  RUN_ID,
  addClientContact,
  addItem,
  createProject,
  login,
  money,
  openClientLink,
  testEmail,
  testName,
  waitForSaved,
} from "./helpers";

/**
 * A version saved before line-item counts existed.
 *
 * This is the case that could have gone quietly wrong: those snapshots have no
 * `count` key at all, and reading a missing number as zero would multiply every
 * quantity by nothing — silently zeroing estimates clients have already
 * approved. Rather than trust the unit-level guard, this writes a snapshot in
 * the genuine old shape straight into the database and reads it back through
 * the running app.
 *
 * It needs DATABASE_URL, so it is skipped when pointed at a deployment whose
 * database this machine can't reach.
 */

const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * A snapshot exactly as the app wrote them before counts were added.
 *
 * Item ids are scoped to the run. Restoring a version deliberately reuses the
 * snapshot's ids so history and diffs stay continuous, and LineItem.id is a
 * global primary key — so fixed ids here would collide with the rows the
 * previous run's restore left behind.
 */
function legacySnapshot(projectName: string) {
  return {
    meta: {
      client: "PLAYWRIGHT Legacy Client",
      property: projectName,
      preparedBy: "Someone",
      date: "2026-01-15",
      terms: "",
      discountType: "pct",
      discountValue: 0,
      gstOn: false,
      gstRate: 18,
      cols: { material: true, finish: true, qty: true, rate: true },
    },
    sections: [
      {
        name: "Master Bedroom",
        items: [
          {
            // Note: no `count` key anywhere below. That is the whole point.
            id: `legacy-1-${RUN_ID}`,
            category: "Civil & Infra Works",
            custom: false,
            desc: "Legacy Wardrobe",
            material: "Plywood",
            finish: "Laminate",
            unit: "SQFT",
            rate: 1200,
            cost: 800,
            dims: { l: "6", b: "8" },
            qty: 48,
            qtyOverride: false,
            description: "",
            note: "",
            image: null,
          },
          {
            id: `legacy-2-${RUN_ID}`,
            category: "Electrical Works",
            custom: false,
            desc: "Legacy Sockets",
            material: "",
            finish: "",
            unit: "Nos.",
            rate: 350,
            cost: 200,
            dims: { l: "", b: "", h: "" },
            qty: 12,
            qtyOverride: false,
            description: "",
            note: "",
            image: null,
          },
          {
            id: `legacy-3-${RUN_ID}`,
            category: "Civil & Infra Works",
            custom: false,
            desc: "Legacy Odd Wall",
            material: "",
            finish: "",
            unit: "SQFT",
            rate: 90,
            cost: 50,
            dims: { l: "3", b: "3" },
            qty: 45,
            // A typed quantity overriding the dimensions — the other shape
            // that existed before counts.
            qtyOverride: true,
            description: "",
            note: "",
            image: null,
          },
        ],
      },
    ],
  };
}

// 48 × 1200 + 12 × 350 + 45 × 90 = 57,600 + 4,200 + 4,050
const EXPECTED_TOTAL = 65850;

test.describe("A version from before counts existed", () => {
  test.skip(!hasDb, "needs DATABASE_URL to write a snapshot in the old shape");
  test.describe.configure({ mode: "serial" });

  let projectId = "";
  const projectName = testName("Legacy");

  test("write a pre-count version straight into the database", async ({ page }) => {
    await login(page);
    projectId = await createProject(page, projectName);
    await page.goto(`/projects/${projectId}/build`);
    await page.waitForSelector(".sec-block");
    await addItem(page, { category: "Civil & Infra Works", desc: "Painting", l: 5, b: 5 });
    await waitForSaved(page);

    const prisma = new PrismaClient();
    try {
      await prisma.version.create({
        data: {
          projectId,
          number: 1,
          status: "SENT_TO_CLIENT",
          snapshot: legacySnapshot(projectName),
          createdByName: "PLAYWRIGHT Legacy",
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test("the Versions page totals it exactly as it was", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}`);
    await page.waitForSelector(".version-row");

    const row = page.locator(".version-row").filter({ hasText: "V1" }).first();
    const meta = await row.locator(".v-meta").innerText();
    expect(meta, "the legacy version lost its item count").toContain("3 items");

    // The amount has its own span — the row text opens with the item count, so
    // reading the first number out of it would just find "3".
    const total = money(await row.locator(".v-meta .tabular").first().innerText());
    expect(
      total,
      "a pre-count version must total exactly what it did before counts existed",
    ).toBeCloseTo(EXPECTED_TOTAL, 0);
  });

  test("its lines still read correctly, with no phantom count", async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}`);
    await page.waitForSelector(".version-row");

    const html = await page.content();
    expect(html, "an old line was rendered as though it had a count").not.toContain("nos.");
  });

  test("a client opening the link sees the original quantities", async ({ browser, page }) => {
    // Through the real share link, not the team's Client View preview — that
    // preview renders the LIVE BOQ, so it would never show this version at all.
    await login(page);
    const link = await addClientContact(
      page,
      projectId,
      `${PREFIX} Legacy Contact`,
      testEmail("legacy-contact"),
    );

    const context = await browser.newContext();
    const client = await context.newPage();
    try {
      await openClientLink(client, link, testEmail("legacy-contact"));
      const joined = (await client.locator(".cv-row").allInnerTexts()).join("\n");

      expect(joined, "the client is not being served the legacy version").toContain("Legacy Wardrobe");
      // 6 × 8 = 48 SQFT — not 0, and not doubled.
      expect(joined, "the dimension-driven line lost its quantity").toContain("48");
      expect(joined, "the piece-priced line lost its quantity").toContain("12");
      expect(joined, "the typed-quantity line lost its quantity").toContain("45");
      expect(joined, "a legacy line grew a count it never had").not.toContain("nos.");

      const subtotal = money(
        await client.locator(".cv-summary .row", { hasText: "Subtotal" }).locator("span").last().innerText(),
      );
      expect(subtotal, "the client's total moved on a version they may have approved").toBeCloseTo(
        EXPECTED_TOTAL,
        0,
      );
    } finally {
      await context.close();
    }
  });

  test("restoring it into the live BOQ keeps every quantity", async ({ page }) => {
    // The write path. Restore pushes the version's items back into live
    // LineItem rows, so a missing count would be written to the database here
    // as a real zero rather than defaulting on read.
    await login(page);
    await page.goto(`/projects/${projectId}`);
    await page.waitForSelector(".version-row");

    const row = page.locator(".version-row").filter({ hasText: "V1" }).first();
    await row.locator('button:has-text("Open")').click();
    await page.waitForURL("**/build", { timeout: 45_000 });
    await page.waitForSelector(".compact-row");

    const rows = await page.locator(".compact-row").allInnerTexts();
    const joined = rows.join("\n");
    expect(joined, "restore didn't bring the legacy lines across").toContain("Legacy Wardrobe");
    expect(joined, "a restored legacy line grew a count it never had").not.toContain("nos.");

    const amounts = (await page.locator(".compact-row .cr-amt").allInnerTexts()).map((t) => money(t)!);
    expect(amounts.reduce((a, b) => a + b, 0), "restoring changed the estimate's value").toBeCloseTo(
      EXPECTED_TOTAL,
      0,
    );
  });

  test("and the restored rows carry a count of 1 in the database, not 0", async ({ page }) => {
    // Read the actual column. A default that only applies on read would leave
    // zeros here, and every later save would then bill nothing.
    await login(page);
    const prisma = new PrismaClient();
    try {
      const items = await prisma.lineItem.findMany({
        where: { section: { projectId } },
        select: { name: true, count: true, qty: true },
      });
      expect(items.length, "no line items were restored").toBeGreaterThan(0);
      for (const item of items) {
        expect(item.count, `"${item.name}" was stored with a count of ${item.count}`).toBe(1);
      }
    } finally {
      await prisma.$disconnect();
    }
  });
});
