import { Placeholder } from "@/components/Placeholder";
import { milestoneTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("dpr").title };

export default async function DprPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="dpr"
      project={{ id: project.id, name: project.name }} tabs={{ label: "Milestones & DPR", items: milestoneTabs(project.id) }}
    />
  );
}
