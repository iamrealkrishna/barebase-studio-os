import { SiteShell } from "@/components/shell/PhoneShells";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

/** Phone site screens (DPR, raise a snag): staff only, scoped to the organisation. */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await loadShellProject(projectId);
  return (
    <SiteShell backHref={`/projects/${project.id}`} backLabel={project.name}>
      {children}
    </SiteShell>
  );
}
