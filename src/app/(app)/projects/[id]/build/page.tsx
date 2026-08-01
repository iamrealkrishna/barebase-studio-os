import BoqBuilder from "@/components/BoqBuilder";
import type { BoqSnapshot } from "@/lib/boq";
import { prisma } from "@/lib/db";
import { getProjectPageData, toSnapshot } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { latestApprovedVersion, reviewAttentionCount } from "@/lib/versions";

export const dynamic = "force-dynamic";

/**
 * Internal cost is admin-only, so a team member's page payload carries none of
 * it — hiding the column client-side would still ship the numbers to their
 * browser. `saveBoq` refuses cost from a non-admin, so these zeros can't be
 * written back over the real figures.
 */
function withoutCost(snapshot: BoqSnapshot): BoqSnapshot {
  return {
    ...snapshot,
    sections: snapshot.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, cost: 0 })),
    })),
  };
}

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, project, letterhead } = await getProjectPageData(id);
  const canSeeCost = user.role === "ADMIN";

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
      initialSnapshot={canSeeCost ? live : withoutCost(live)}
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
      }))}
      letterhead={letterhead}
      approvedSnapshot={
        approvedSnapshot ? (canSeeCost ? approvedSnapshot : withoutCost(approvedSnapshot)) : null
      }
      approvedVersionNumber={approved?.number ?? null}
    />
  );
}
