import ClientViewPreview from "@/components/ClientViewPreview";
import { toClientSnapshot } from "@/lib/boq";
import { prisma } from "@/lib/db";
import { clientLink } from "@/lib/app-url";
import { getProjectPageData, toSnapshot } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { latestApprovedVersion, reviewAttentionCount } from "@/lib/versions";

export const dynamic = "force-dynamic";

export default async function ClientViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, letterhead } = await getProjectPageData(id);

  const [approved, contacts, reviewFlag] = await Promise.all([
    latestApprovedVersion(project.id),
    prisma.clientContact.findMany({
      where: { projectId: project.id, revoked: false },
      orderBy: { createdAt: "asc" },
    }),
    reviewAttentionCount(project.id),
  ]);

  return (
    <ClientViewPreview
      projectId={project.id}
      projectName={project.name}
      reviewFlag={reviewFlag}
      // Cost, margin and internal notes are stripped before this ever renders.
      snapshot={toClientSnapshot(toSnapshot(project))}
      letterhead={letterhead}
      // Stripped too: it's only here to diff against, and the diff runs on
      // client-visible fields, which cost and internal notes aren't.
      approvedSnapshot={approved ? toClientSnapshot(parseSnapshot(approved.snapshot)) : null}
      approvedVersionNumber={approved?.number ?? null}
      shareLinks={contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        url: clientLink(contact.token),
      }))}
    />
  );
}
