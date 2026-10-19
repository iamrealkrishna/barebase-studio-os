import { SiteShell } from "@/components/shell/PhoneShells";
import { titleFromSlug } from "@/lib/screens";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SiteShell backHref={`/projects/${projectId}`} backLabel={titleFromSlug(projectId)}>
      {children}
    </SiteShell>
  );
}
