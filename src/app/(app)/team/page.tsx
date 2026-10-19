import TeamManager from "@/components/TeamManager";
// requireAdmin redirects a Team Member away before anything renders, so hitting
// /team directly is blocked server-side — hiding the nav link is cosmetic only.
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const admin = await requireAdmin();

  const members = await prisma.user.findMany({
    where: { orgId: admin.orgId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      deactivatedAt: true,
      createdAt: true,
      _count: { select: { projects: true, versions: true } },
    },
  });

  return (
    <div className="settings-wrap">
      <div className="proj-head-row">
        <span className="proj-title">Team</span>
      </div>

      <TeamManager
        currentUserId={admin.id}
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          active: member.active,
          deactivatedAt: member.deactivatedAt ? member.deactivatedAt.toISOString() : null,
          createdAt: member.createdAt.toISOString(),
          projectCount: member._count.projects,
          versionCount: member._count.versions,
        }))}
      />
    </div>
  );
}
