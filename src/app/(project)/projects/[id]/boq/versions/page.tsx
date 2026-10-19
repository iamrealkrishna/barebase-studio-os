import { Placeholder } from "@/components/Placeholder";
import { boqTabs } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("boq-versions").title };

export default async function BoqVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="boq-versions" projectId={id} tabs={{ label: "BOQ", items: boqTabs(id) }} />;
}
