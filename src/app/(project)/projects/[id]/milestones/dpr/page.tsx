import { Placeholder } from "@/components/Placeholder";
import { milestoneTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("dpr").title };

export default async function DprPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="dpr" projectId={id} tabs={{ label: "Milestones & DPR", items: milestoneTabs(id) }} />;
}
