import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("site-snag").title };

export default async function SiteSnagPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { project } = await loadShellProject((await params).projectId);
  return <Placeholder screenKey="site-snag" project={{ id: project.id, name: project.name }} />;
}
