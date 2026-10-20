import { Placeholder } from "@/components/Placeholder";
import { homeBudgetTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("home-budget").title };

export default async function HomeBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="home-budget"
      project={{ id: project.id, name: project.name }} tabs={{ label: "Home budget", items: homeBudgetTabs(project.id) }}
    />
  );
}
