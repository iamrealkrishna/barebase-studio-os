import BoqBuilder from "@/components/BoqBuilder";
import { prisma } from "@/lib/db";
import { getProjectPageData, toSnapshot } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { latestApprovedVersion } from "@/lib/versions";

export const dynamic = "force-dynamic";

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, project, letterhead } = await getProjectPageData(id);

  const [rateItems, approved] = await Promise.all([
    prisma.rateItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ category: "asc" }, { position: "asc" }],
    }),
    latestApprovedVersion(project.id),
  ]);

  return (
    <BoqBuilder
      projectId={project.id}
      initialSnapshot={toSnapshot(project)}
      initialUpdatedAt={project.updatedAt.toISOString()}
      rateEntries={rateItems.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        material: item.material,
        finish: item.finish,
        unit: item.unit,
        rate: item.rate,
        cost: item.cost,
      }))}
      letterhead={letterhead}
      approvedSnapshot={approved ? parseSnapshot(approved.snapshot) : null}
      approvedVersionNumber={approved?.number ?? null}
    />
  );
}
