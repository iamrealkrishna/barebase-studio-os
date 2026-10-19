import { expect, test } from "@playwright/test";

import { SCREENS, sampleHref, screen } from "../../src/lib/screens";

/**
 * Setup check (prompts/00-kickoff.md, step 3): every route renders its placeholder
 * inside the right shell, so the whole navigation can be clicked through.
 */
test.describe("every route renders its placeholder", () => {
  for (const s of SCREENS) {
    test(`${s.route} · ${s.title}`, async ({ page }) => {
      const response = await page.goto(sampleHref(s.route));
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: s.title })).toBeVisible();
      await expect(page.getByText(`Not built yet · Phase ${s.phase}`)).toBeVisible();
      // No page scrolls sideways, at 1440 or 375 px (UI spec 7).
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test("desktop: global sidebar, project sidebar and top bar link up", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Sidebar is replaced by the bottom bar on phones");

  await page.goto("/");
  const main = page.getByRole("navigation", { name: "Main" }).first();
  for (const label of ["Home", "Insights", "Leads", "Projects", "Finance", "Team"]) {
    await expect(main.getByRole("link", { name: label })).toBeVisible();
  }
  // Approvals is reached from the top bar, not the sidebar.
  await expect(main.getByRole("link", { name: "Approvals" })).toHaveCount(0);
  await page.getByRole("link", { name: "To approve" }).click();
  await expect(page.getByRole("heading", { level: 1, name: screen("approvals").title })).toBeVisible();

  await page.getByRole("link", { name: "Org Settings" }).click();
  await expect(page).toHaveURL("/settings");

  // Into a project: the sidebar switches to the project's tabs.
  await page.goto("/projects/villa-prakruthi");
  const project = page.getByRole("navigation", { name: "Project", exact: true });
  for (const label of ["Overview", "Files", "BOQ", "Finance", "Home budget", "Milestones & DPR", "Snags"]) {
    await expect(project.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await project.getByRole("link", { name: "Milestones & DPR" }).click();
  await project.getByRole("link", { name: "Progress by BOQ line" }).click();
  await expect(page).toHaveURL("/projects/villa-prakruthi/milestones/progress");
  await expect(page.getByRole("heading", { level: 1, name: "Progress by BOQ line" })).toBeVisible();

  await page.getByRole("link", { name: "All Projects" }).click();
  await expect(page).toHaveURL("/projects");
});

test("phone: bottom bar replaces the sidebar", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Phone layout only");
  await page.goto("/");
  await expect(page.locator("aside")).toBeHidden();
  const bar = page.getByRole("navigation", { name: "Main" }).last();
  await bar.getByRole("link", { name: "Approvals" }).click();
  await expect(page).toHaveURL("/approvals");
});

test("old UI-spec routes redirect to the screens-file routes", async ({ page }) => {
  await page.goto("/projects/villa-prakruthi/budget");
  await expect(page).toHaveURL("/projects/villa-prakruthi/home-budget");
  await page.goto("/finance/gst");
  await expect(page).toHaveURL("/finance/tax");
});
