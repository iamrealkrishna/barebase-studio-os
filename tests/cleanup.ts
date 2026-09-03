/**
 * Remove everything a test run created.
 *
 * Run it against whatever database the suite was pointed at:
 *
 *   DATABASE_URL="<the same one the app uses>" npx tsx tests/cleanup.ts --dry-run
 *   DATABASE_URL="<...>" npx tsx tests/cleanup.ts
 *
 * It is a standalone script on purpose — the app has no delete-a-user feature
 * and shouldn't grow one just to tidy up after tests. Deactivated team members
 * are kept deliberately by the product (they anchor the audit trail), so only
 * something outside the app should ever remove them.
 *
 * Nothing without the PLAYWRIGHT TEST prefix is touched, and `--dry-run` lists
 * what would go before anything does. Deleting a project cascades to its
 * sections, line items, versions, client contacts, approvals, change orders and
 * audit entries, so those need no separate pass.
 */
import { PrismaClient } from "@prisma/client";

const PREFIX = "PLAYWRIGHT TEST";
/** Emails the suite issues, e.g. playwright-test-member-123456@example.invalid */
const EMAIL_PREFIX = "playwright-test-";

const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");
const prisma = new PrismaClient();

function heading(text: string) {
  console.log(`\n${text}\n${"-".repeat(text.length)}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Point it at the same database the tests ran against.");
    process.exit(1);
  }

  console.log(dryRun ? "DRY RUN — nothing will be deleted.\n" : "Deleting test records.\n");

  // ------------------------------------------------------------- projects
  const projects = await prisma.project.findMany({
    where: { name: { startsWith: PREFIX } },
    select: {
      id: true,
      name: true,
      _count: { select: { sections: true, versions: true, contacts: true, auditEvents: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  heading(`Projects (${projects.length})`);
  for (const project of projects) {
    console.log(
      `  ${project.name}` +
        `  [${project._count.sections} sections, ${project._count.versions} versions, ` +
        `${project._count.contacts} contacts, ${project._count.auditEvents} audit entries]`,
    );
  }
  if (projects.length === 0) console.log("  (none)");

  // ------------------------------------------------------------ rate items
  // The suite never commits a rate card import, but a run interrupted at the
  // wrong moment could leave one behind.
  const rateItems = await prisma.rateItem.findMany({
    where: { OR: [{ category: { startsWith: PREFIX } }, { name: { startsWith: PREFIX } }] },
    select: { id: true, category: true, name: true },
  });

  heading(`Rate card items (${rateItems.length})`);
  for (const item of rateItems) console.log(`  ${item.category} · ${item.name}`);
  if (rateItems.length === 0) console.log("  (none)");

  // ----------------------------------------------------------------- users
  const users = await prisma.user.findMany({
    where: {
      OR: [{ name: { startsWith: PREFIX } }, { email: { startsWith: EMAIL_PREFIX } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      _count: { select: { projects: true, versions: true } },
    },
  });

  heading(`Team members (${users.length})`);
  for (const user of users) {
    const owns = user._count.projects + user._count.versions;
    console.log(
      `  ${user.name} <${user.email}> ${user.role}${user.active ? "" : " (deactivated)"}` +
        (owns > 0 ? `  — authored ${user._count.projects} projects, ${user._count.versions} versions` : ""),
    );
  }
  if (users.length === 0) console.log("  (none)");

  // A test user who somehow authored a real project is a red flag; say so
  // rather than deleting and taking the project's history down with it.
  const risky = users.filter((user) => user._count.projects > 0 || user._count.versions > 0);

  if (dryRun) {
    console.log(
      `\nWould delete ${projects.length} project(s), ${rateItems.length} rate item(s), ` +
        `${users.length - risky.length} user(s).`,
    );
    if (risky.length > 0) {
      console.log(
        `\n${risky.length} test user(s) authored projects or versions and will be SKIPPED:\n` +
          risky.map((u) => `  ${u.email}`).join("\n") +
          `\nDelete the projects first, or remove them by hand if you're sure.`,
      );
    }
    console.log("\nRe-run without --dry-run to apply.");
    return;
  }

  let deletedProjects = 0;
  for (const project of projects) {
    await prisma.project.delete({ where: { id: project.id } });
    deletedProjects++;
  }

  const deletedRateItems = rateItems.length
    ? (await prisma.rateItem.deleteMany({ where: { id: { in: rateItems.map((i) => i.id) } } })).count
    : 0;

  // Re-check ownership after the projects are gone — deleting them releases
  // most of it, since Project.createdById is set to null rather than cascading.
  let deletedUsers = 0;
  const skipped: string[] = [];
  for (const user of users) {
    const stillOwns = await prisma.version.count({ where: { createdById: user.id } });
    const stillCreated = await prisma.project.count({ where: { createdById: user.id } });
    if (stillOwns > 0 || stillCreated > 0) {
      skipped.push(`${user.email} (still on ${stillCreated} projects, ${stillOwns} versions)`);
      continue;
    }
    await prisma.user.delete({ where: { id: user.id } });
    deletedUsers++;
  }

  heading("Done");
  console.log(`  ${deletedProjects} project(s) deleted (with everything under them)`);
  console.log(`  ${deletedRateItems} rate card item(s) deleted`);
  console.log(`  ${deletedUsers} team member(s) deleted`);
  if (skipped.length > 0) {
    console.log(`\n  Skipped, because real work is attributed to them:`);
    for (const line of skipped) console.log(`    ${line}`);
    console.log(`  Deactivate them on /team instead — deleting would break the audit trail.`);
  }
}

main()
  .catch((error) => {
    console.error("\nCleanup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
