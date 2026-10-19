import { Placeholder } from "@/components/Placeholder";
import { homeBudgetTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("client-purchases").title };

export default async function ClientPurchasesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="client-purchases" projectId={id} tabs={{ label: "Home budget", items: homeBudgetTabs(id) }} />;
}
