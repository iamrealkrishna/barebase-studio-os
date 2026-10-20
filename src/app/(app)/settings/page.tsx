import Link from "next/link";

import OrgSettingsForm from "@/components/OrgSettingsForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Org Settings › Company and letterhead. The rate card is its own tab at /settings/rate-card. */
export default async function SettingsPage() {
  const user = await requireUser();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="settings-wrap">
      <div className="proj-head-row">
        <span className="proj-title">Org Settings</span>
      </div>
      <SettingsTabs />

      {!isAdmin ? (
        <div className="flash err">
          You&apos;re signed in as a team member — organisation settings are admin-only. Your own name, email and
          password live on <Link href="/account">your account page</Link>.
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
    </div>
  );
}
