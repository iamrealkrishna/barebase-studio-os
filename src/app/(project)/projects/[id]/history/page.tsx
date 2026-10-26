import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("history").title };

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="history"
      project={{ id: project.id, name: project.name }} workingToday={[{ label: "Audit log and its PDF export (Versions & Approvals)", href: `/projects/${project.id}/boq/versions` }]}
    />
  );
}
