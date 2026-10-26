import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("site-dpr").title };

export default async function SiteDprPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { project } = await loadShellProject((await params).projectId);
  return <Placeholder screenKey="site-dpr" project={{ id: project.id, name: project.name }} />;
}
