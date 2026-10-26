import { expect, test, type Page } from "@playwright/test";

import { SCREENS, sampleHref, screen } from "../src/lib/screens";
import { createProject, login, testName } from "./helpers";

/**
 * The Studio OS shell, clicked through (prompts/00-kickoff.md).
 *
 * Every screen that isn't built yet renders its placeholder, with its title, its
 * phase and its mock-up, inside the right shell. Every screen imported from BOQ
 * Studio renders inside the shell too. Nothing scrolls sideways at 1440 or 375 px
 * (UI spec 7), and the old routes redirect.
 */

const PLACEHOLDERS = SCREENS.filter((s) => !("live" in s));
// The live client estimate needs a real share link; tests 06 and 20 cover it.
const LIVE = SCREENS.filter((s) => "live" in s && s.shell !== "client");

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 812 };

let projectId = "";

async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("Studio OS shell and navigation", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("set up a project to navigate inside", async ({ page }) => {
    projectId = await createProject(page, testName("Navigation"));
  });

  test("every placeholder shows its title, phase and mock-up, at 1440 and 375 px", async ({ page }) => {
    test.setTimeout(PLACEHOLDERS.length * 8_000);
    for (const s of PLACEHOLDERS) {
      const href = sampleHref(s.route, projectId);
      for (const viewport of [DESKTOP, PHONE]) {
        await page.setViewportSize(viewport);
        const response = await page.goto(href);
        expect(response?.status(), `${href} should load`).toBe(200);
        await expect(page.getByRole("heading", { level: 1, name: s.title }), href).toBeVisible();
        await expect(page.getByText(`Not built yet · Phase ${s.phase}`), href).toBeVisible();
        expect(await sidewaysOverflow(page), `${href} scrolls sideways at ${viewport.width} px`).toBeLessThanOrEqual(0);
      }

      // Each mock-up is a real image, not a broken link.
      const images = page.locator("figure img");
      await expect(images).toHaveCount(s.mockups.length);
      for (let i = 0; i < s.mockups.length; i++) {
        const img = images.nth(i);
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
            message: `mock-up ${s.mockups[i]} on ${href} should load`,
          })
          .toBe(true);
      }
    }
  });

  test("every BOQ Studio screen renders inside the shell, at 1440 and 375 px", async ({ page }) => {
    for (const s of LIVE) {
      if (s.shell === "auth") continue; // A signed-in visitor to /login is sent onwards.
      const href = sampleHref(s.route, projectId);
      for (const viewport of [DESKTOP, PHONE]) {
        await page.setViewportSize(viewport);
        const response = await page.goto(href);
        expect(response?.status(), `${href} should load`).toBe(200);
        expect(new URL(page.url()).pathname).toBe(href);
        await expect(page.locator("main"), href).toBeVisible();
        expect(await sidewaysOverflow(page), `${href} scrolls sideways at ${viewport.width} px`).toBeLessThanOrEqual(0);
      }
      await expect(page.getByText("Not built yet")).toHaveCount(0);
    }
  });

  test("desktop: global sidebar, top bar and project sidebar link up", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
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
    await page.getByRole("tab", { name: "Rate card" }).or(page.getByRole("link", { name: "Rate card" })).first().click();
    await expect(page).toHaveURL("/settings/rate-card");

    // Into a project: the sidebar switches to the project's sections.
    await page.goto(`/projects/${projectId}`);
    const project = page.getByRole("navigation", { name: "Project", exact: true });
    for (const label of ["Overview", "Files", "BOQ", "Finance", "Home budget", "Milestones & DPR", "Snags"]) {
      await expect(project.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await project.getByRole("link", { name: "BOQ", exact: true }).click();
    await expect(page).toHaveURL(`/projects/${projectId}/boq`);
    await page.waitForSelector(".sec-block");

    await project.getByRole("link", { name: "Milestones & DPR" }).click();
    await project.getByRole("link", { name: "Progress by BOQ line" }).click();
    await expect(page).toHaveURL(`/projects/${projectId}/milestones/progress`);
    await expect(page.getByRole("heading", { level: 1, name: "Progress by BOQ line" })).toBeVisible();

    await page.getByRole("link", { name: "All Projects" }).click();
    await expect(page).toHaveURL("/projects");
  });

  test("phone: the bottom bar replaces the sidebar", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/");
    await expect(page.locator("aside")).toBeHidden();
    const bar = page.getByRole("navigation", { name: "Main" }).last();
    await bar.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL("/projects");
    await bar.getByRole("link", { name: "Approvals" }).click();
    await expect(page).toHaveURL("/approvals");
    await bar.getByRole("link", { name: "Me", exact: true }).click();
    await expect(page).toHaveURL("/account");
  });

  test("BOQ Studio's old routes and the spec's older routes redirect", async ({ page }) => {
    const redirects: [string, string][] = [
      [`/projects/${projectId}/build`, `/projects/${projectId}/boq`],
      [`/projects/${projectId}/client-view`, `/projects/${projectId}/boq/client-view`],
      [`/projects/${projectId}/review`, `/projects/${projectId}/boq/review`],
      [`/projects/${projectId}/budget`, `/projects/${projectId}/home-budget`],
      [`/projects/${projectId}/finance/client`, `/projects/${projectId}/finance/payments`],
      [`/projects/${projectId}/snags/walk`, `/site/${projectId}/snag/new`],
      ["/finance/gst", "/finance/tax"],
      ["/settings/catalogue", "/settings/rate-card"],
      ["/profile", "/account"],
    ];
    for (const [from, to] of redirects) {
      await page.goto(from);
      expect(new URL(page.url()).pathname, `${from} should redirect`).toBe(to);
    }
  });

  test("mock-ups are for signed-in staff only", async ({ browser }) => {
    const context = await browser.newContext();
    const anon = await context.newPage();
    const response = await anon.request.get("/mockups/screens/Main.png", { maxRedirects: 0 });
    expect(response.status()).not.toBe(200);
    await context.close();
  });
});
