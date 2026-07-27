import OrgSettingsForm from "@/components/OrgSettingsForm";
import RateCardEditor from "@/components/RateCardEditor";
import TeamSettings from "@/components/TeamSettings";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  const [org, rateItems, team] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } }),
    prisma.rateItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ category: "asc" }, { position: "asc" }],
    }),
    prisma.user.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
  ]);

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="settings-wrap">
      <div className="proj-head-row">
        <span className="proj-title">Rate Card &amp; Settings</span>
      </div>

      {!isAdmin ? (
        <div className="flash err">
          You&apos;re signed in as a team member — you can build BOQs, but rate card and organisation settings are
          admin-only.
        </div>
      ) : null}

      <OrgSettingsForm
        canEdit={isAdmin}
        org={{
          name: org.name,
          legalName: org.legalName ?? "",
          addressLine: org.addressLine ?? "",
          pocName: org.pocName ?? "",
          pocPhone: org.pocPhone ?? "",
          pocEmail: org.pocEmail ?? "",
          terms: org.terms,
        }}
      />

      <RateCardEditor
        canEdit={isAdmin}
        initialEntries={rateItems.map((item) => ({
          id: item.id,
          category: item.category,
          name: item.name,
          material: item.material,
          finish: item.finish,
          unit: item.unit,
          rate: item.rate,
          cost: item.cost,
        }))}
      />

      <TeamSettings canEdit={isAdmin} currentUserId={user.id} members={team} />
    </div>
  );
}
