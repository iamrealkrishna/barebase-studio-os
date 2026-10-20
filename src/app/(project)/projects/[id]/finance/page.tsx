import { Placeholder } from "@/components/Placeholder";
import { projectFinanceTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("project-finance").title };

export default async function ProjectFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="project-finance"
      project={{ id: project.id, name: project.name }} tabs={{ label: "Finance", items: projectFinanceTabs(project.id) }}
    />
  );
}
