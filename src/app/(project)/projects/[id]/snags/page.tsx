import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("snags").title };

export default async function SnagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="snags"
      project={{ id: project.id, name: project.name }}
    />
  );
}
