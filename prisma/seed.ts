/**
 * Seeds the Barebase organisation, its first admin, and the default rate card.
 *
 * Safe to re-run: the org and user are upserted, and the rate card is only
 * written when the org has none — so a team that has edited rates in-app never
 * gets them stomped by a redeploy.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { DEFAULT_RATE_CARD } from "../src/lib/default-rate-card";
import { DEFAULT_TERMS } from "../src/lib/boq";

const prisma = new PrismaClient();

async function main() {
  const orgName = process.env.SEED_ORG_NAME || "Barebase";
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  const name = process.env.SEED_ADMIN_NAME || "Admin";

  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const org = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: {
      name: orgName,
      slug,
      legalName: "Kanchan Integrated Property Development Co (Barebase)",
      addressLine: "202, 2nd Floor, Ahuja Chambers, Kumar Krupa Road, Bangalore 560 001",
      pocName: "Ridhi Bhinde",
      pocPhone: "+91 7411664532",
      pocEmail: "ridhi@barebase.in",
      terms: DEFAULT_TERMS,
    },
  });
  console.log(`Organisation: ${org.name} (${org.id})`);

  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { orgId: org.id, role: "ADMIN" },
      create: { orgId: org.id, email, name, passwordHash, role: "ADMIN" },
    });
    console.log(`Admin: ${user.email}`);
  } else {
    console.log("No SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD set — skipping admin creation.");
  }

  const existing = await prisma.rateItem.count({ where: { orgId: org.id } });
  if (existing > 0) {
    console.log(`Rate card already has ${existing} items — leaving it alone.`);
  } else {
    await prisma.rateItem.createMany({
      data: DEFAULT_RATE_CARD.map((item, position) => ({ ...item, orgId: org.id, position })),
    });
    console.log(`Rate card: seeded ${DEFAULT_RATE_CARD.length} items.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
