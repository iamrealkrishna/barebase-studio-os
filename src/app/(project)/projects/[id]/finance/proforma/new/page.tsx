import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("proforma-new").title };

export default async function ProformaNewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder screenKey="proforma-new" projectId={id} />;
}
