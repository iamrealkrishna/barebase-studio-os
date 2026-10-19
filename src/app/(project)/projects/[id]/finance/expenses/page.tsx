import { Placeholder } from "@/components/Placeholder";
import { projectFinanceTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-expenses").title };

export default async function FinanceExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="finance-expenses" projectId={id} tabs={{ label: "Finance", items: projectFinanceTabs(id) }} />;
}
