import { Placeholder } from "@/components/Placeholder";
import { projectFinanceTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("finance-expenses").title };

export default async function FinanceExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="finance-expenses"
      project={{ id: project.id, name: project.name }} tabs={{ label: "Finance", items: projectFinanceTabs(project.id) }}
    />
  );
}
