import { Placeholder } from "@/components/Placeholder";
import { homeBudgetTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("home-budget").title };

export default async function HomeBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="home-budget" projectId={id} tabs={{ label: "Home budget", items: homeBudgetTabs(id) }} />;
}
