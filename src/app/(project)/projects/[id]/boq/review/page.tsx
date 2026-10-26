import ReviewBoard from "@/components/ReviewBoard";
import { canSeeCost as userCanSeeCost, snapshotFor } from "@/lib/cost-privacy";
import { prisma } from "@/lib/db";
import { getProjectPageData, toSnapshot } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { currentClientVersion, latestApprovedVersion } from "@/lib/versions";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, project } = await getProjectPageData(id);
  // Cost and internal notes stay on the server for non-cost users (decisions 20 and 25).
  const canSeeCost = userCanSeeCost(user);

  // The version the client is actually looking at — the newest one they've been
  // sent. Approvals are recorded against that exact version, never the live BOQ.
  const reviewed = await currentClientVersion(project.id);

  const [rateItems, approved, approvals, contacts] = await Promise.all([
    prisma.rateItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ category: "asc" }, { position: "asc" }],
    }),
    latestApprovedVersion(project.id),
    reviewed
      ? prisma.itemApproval.findMany({
          where: { versionId: reviewed.id },
          include: { contact: { select: { name: true } } },
          orderBy: { updatedAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.clientContact.findMany({
      where: { projectId: project.id, revoked: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, lastViewedAt: true, reviewSubmittedAt: true },
    }),
  ]);

  const live = toSnapshot(project);
  const approvedSnapshot = approved ? parseSnapshot(approved.snapshot) : null;
  const reviewedSnapshot = reviewed ? parseSnapshot(reviewed.snapshot) : null;

  return (
    <ReviewBoard
      projectId={project.id}
      projectName={project.name}
      canSeeCost={canSeeCost}
      initialSnapshot={snapshotFor(user, live)}
      initialUpdatedAt={project.updatedAt.toISOString()}
      rateEntries={rateItems.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        material: item.material,
        finish: item.finish,
        unit: item.unit,
        rate: item.rate,
        cost: canSeeCost ? item.cost : 0,
        defaultScope: item.defaultScope,
      }))}
      approvedSnapshot={approvedSnapshot ? snapshotFor(user, approvedSnapshot) : null}
      approvedVersionNumber={approved?.number ?? null}
      reviewedVersion={
        reviewed
          ? {
              number: reviewed.number,
              status: reviewed.status,
              sentAt: reviewed.createdAt.toISOString(),
              itemCount: reviewedSnapshot
                ? reviewedSnapshot.sections.reduce((n, s) => n + s.items.length, 0)
                : 0,
            }
          : null
      }
      approvals={approvals.map((approval) => ({
        lineItemId: approval.lineItemId,
        lineItemName: approval.lineItemName,
        status: approval.status,
        comment: approval.comment ?? "",
        contactName: approval.contact.name,
        at: approval.updatedAt.toISOString(),
      }))}
      contacts={contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        lastViewedAt: contact.lastViewedAt ? contact.lastViewedAt.toISOString() : null,
        submittedAt: contact.reviewSubmittedAt ? contact.reviewSubmittedAt.toISOString() : null,
      }))}
    />
  );
}
