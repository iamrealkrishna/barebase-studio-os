import BoqBuilder from "@/components/BoqBuilder";
import { canSeeCost as userCanSeeCost, snapshotFor } from "@/lib/cost-privacy";
import { prisma } from "@/lib/db";
import { getProjectPageData, toSnapshot } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { latestApprovedVersion, reviewAttentionCount } from "@/lib/versions";

export const dynamic = "force-dynamic";

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, project, letterhead } = await getProjectPageData(id);
  // Cost and internal notes never reach the browser of someone who can't see
  // cost (decisions 20 and 25); `saveBoq` keeps the stored values.
  const canSeeCost = userCanSeeCost(user);

  const [rateItems, approved, reviewFlag] = await Promise.all([
    prisma.rateItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ category: "asc" }, { position: "asc" }],
    }),
    latestApprovedVersion(project.id),
    reviewAttentionCount(project.id),
  ]);

  const live = toSnapshot(project);
  const approvedSnapshot = approved ? parseSnapshot(approved.snapshot) : null;

  return (
    <BoqBuilder
      projectId={project.id}
      canSeeCost={canSeeCost}
      reviewFlag={reviewFlag}
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
      letterhead={letterhead}
      approvedSnapshot={approvedSnapshot ? snapshotFor(user, approvedSnapshot) : null}
      approvedVersionNumber={approved?.number ?? null}
    />
  );
}
