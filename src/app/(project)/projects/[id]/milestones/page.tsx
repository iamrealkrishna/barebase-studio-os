import { Placeholder } from "@/components/Placeholder";
import { milestoneTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("milestones").title };

export default async function MilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="milestones" projectId={id} tabs={{ label: "Milestones & DPR", items: milestoneTabs(id) }} />;
}
