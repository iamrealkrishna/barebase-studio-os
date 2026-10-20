import Link from "next/link";

import RateCardEditor from "@/components/RateCardEditor";
import { SettingsTabs } from "@/components/SettingsTabs";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rate card" };

/** Org Settings › Rate card (screens-and-journeys.md: /settings/rate-card). */
export default async function RateCardPage() {
  const user = await requireUser();

  const [org, rateItems] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } }),
    prisma.rateItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ category: "asc" }, { position: "asc" }],
    }),
  ]);

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="settings-wrap">
      <div className="proj-head-row">
        <span className="proj-title">Rate card</span>
      </div>
      <SettingsTabs />

      {!isAdmin ? (
        <div className="flash err">
          You&apos;re signed in as a team member — you can build BOQs, but the rate card is admin-only, and internal
          cost is hidden. Your own name, email and password live on <Link href="/account">your account page</Link>.
        </div>
      ) : null}

      <RateCardEditor
        canEdit={isAdmin}
        canSeeCost={isAdmin}
        orgName={org.name}
        initialEntries={rateItems.map((item) => ({
          id: item.id,
          category: item.category,
          name: item.name,
          material: item.material,
          finish: item.finish,
          unit: item.unit,
          rate: item.rate,
          // Internal cost is admin-only, so it isn't sent to a member's browser
          // at all. Writes are admin-only too, so the zero can never come back.
          cost: isAdmin ? item.cost : 0,
          defaultScope: item.defaultScope,
        }))}
      />
    </div>
  );
}
