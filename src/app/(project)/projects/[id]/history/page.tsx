import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("history").title };

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="history" projectId={id} />;
}
