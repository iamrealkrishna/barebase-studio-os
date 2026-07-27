import type { Metadata } from "next";

import ClientPortal from "@/components/ClientPortal";
import { recordClientView } from "@/actions/approvals";
import { toClientSnapshot } from "@/lib/boq";
import { resolveClientAccess } from "@/lib/client-access";
import { prisma } from "@/lib/db";
import { toLetterhead } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { clientDiffBaseline, currentClientVersion } from "@/lib/versions";

export const dynamic = "force-dynamic";

// A share link is a bearer credential; keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveClientAccess(token);

  if (!access) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="mark">BAREBASE</div>
          <div className="sub">BOQ Studio</div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            This review link isn&apos;t active any more. Please ask your Barebase contact for a fresh one.
          </p>
        </div>
      </div>
    );
  }

  const version = await currentClientVersion(access.project.id);

  if (!version) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="mark">{access.org.name.toUpperCase()}</div>
          <div className="sub">Estimate</div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Hi {access.contact.name} — your estimate for {access.project.name} isn&apos;t ready to review yet. You&apos;ll
            get an update as soon as it is.
          </p>
        </div>
      </div>
    );
  }

  await recordClientView(token);

  const [baseline, approvals] = await Promise.all([
    clientDiffBaseline(access.project.id, access.contact.lastApprovedVersionId),
    prisma.itemApproval.findMany({
      where: { versionId: version.id, contactId: access.contact.id },
    }),
  ]);

  // Everything internal — cost, margin, notes — is stripped before render.
  const snapshot = toClientSnapshot(parseSnapshot(version.snapshot));

  return (
    <ClientPortal
      token={token}
      versionId={version.id}
      contactName={access.contact.name}
      snapshot={snapshot}
      letterhead={toLetterhead(access.org)}
      baselineSnapshot={baseline ? toClientSnapshot(baseline) : null}
      alreadyApproved={version.status === "APPROVED"}
      initialApprovals={approvals.map((approval) => ({
        lineItemId: approval.lineItemId,
        status: approval.status,
        comment: approval.comment ?? "",
      }))}
    />
  );
}
