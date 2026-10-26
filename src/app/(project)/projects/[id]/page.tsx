import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("overview").title };

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="overview"
      project={{ id: project.id, name: project.name }} workingToday={[
        { label: "Build BOQ", href: `/projects/${project.id}/boq` },
        { label: "Client view", href: `/projects/${project.id}/boq/client-view` },
        { label: "Client review", href: `/projects/${project.id}/boq/review` },
        { label: "Versions, client links, change orders and audit log", href: `/projects/${project.id}/boq/versions` },
      ]}
    />
  );
}
