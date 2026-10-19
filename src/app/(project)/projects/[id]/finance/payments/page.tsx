import { Placeholder } from "@/components/Placeholder";
import { projectFinanceTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-payments").title };

export default async function FinancePaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="finance-payments" projectId={id} tabs={{ label: "Finance", items: projectFinanceTabs(id) }} />;
}
