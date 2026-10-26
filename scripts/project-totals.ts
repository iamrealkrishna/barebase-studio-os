/**
 * Every project's totals, as CSV: the live BOQ and every saved version.
 *
 *   DATABASE_URL="<staging>" npx tsx scripts/project-totals.ts > before.csv
 *   (run a migration on staging)
 *   DATABASE_URL="<staging>" npx tsx scripts/project-totals.ts > after.csv
 *   diff before.csv after.csv
 *
 * Read-only. Used to prove that every project copied from BOQ Studio opens with
 * the same totals after each migration and on switch-over day (docs/PLAN.md,
 * sections 2 and 6). Totals come from the same `computeTotals` the screens and
 * PDFs use, rounded to the paisa.
 */
import { PrismaClient } from "@prisma/client";

import { computeTotals, type BoqSnapshot } from "../src/lib/boq";
import { parseSnapshot, toSnapshot } from "../src/lib/serialize";

const prisma = new PrismaClient();

const paisa = (n: number) => n.toFixed(2);
const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

function row(projectId: string, name: string, what: string, snapshot: BoqSnapshot) {
  const t = computeTotals(snapshot);
  const lines = snapshot.sections.reduce((n, s) => n + s.items.length, 0);
  return [projectId, name, what, String(lines), paisa(t.subtotal), paisa(t.discountAmount), paisa(t.gst), paisa(t.grand)]
    .map(cell)
    .join(",");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sections: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
      versions: { orderBy: { number: "asc" }, select: { number: true, status: true, snapshot: true } },
    },
  });

  console.log("projectId,name,boq,lines,subtotal,discount,gst,grandTotal");
  for (const project of projects) {
    console.log(row(project.id, project.name, "live", toSnapshot(project)));
    for (const version of project.versions) {
      console.log(row(project.id, project.name, `v${version.number} ${version.status}`, parseSnapshot(version.snapshot)));
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
