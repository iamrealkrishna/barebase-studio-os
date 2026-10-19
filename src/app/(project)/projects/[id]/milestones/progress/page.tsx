import { Placeholder } from "@/components/Placeholder";
import { milestoneTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("progress").title };

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="progress" projectId={id} tabs={{ label: "Milestones & DPR", items: milestoneTabs(id) }} />;
}
