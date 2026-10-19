import { Placeholder } from "@/components/Placeholder";
import { projectFinanceTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("project-finance").title };

export default async function ProjectFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="project-finance" projectId={id} tabs={{ label: "Finance", items: projectFinanceTabs(id) }} />;
}
