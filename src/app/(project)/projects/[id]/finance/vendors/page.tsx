import { Placeholder } from "@/components/Placeholder";
import { projectFinanceTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-vendors").title };

export default async function FinanceVendorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="finance-vendors" projectId={id} tabs={{ label: "Finance", items: projectFinanceTabs(id) }} />;
}
