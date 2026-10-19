import { AppShell } from "@/components/shell/AppShell";
import { Sidebar } from "@/components/shell/Sidebar";
import { projectMenu, projectNav } from "@/lib/nav";
import { titleFromSlug } from "@/lib/screens";

/**
 * ProjectShell: inside a project the sidebar switches to the project's tabs.
 * The project name comes from the URL until projects are in the database (Phase 1);
 * from then on this layout loads the project once and checks membership.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const items = projectNav(id);
  return (
    <AppShell
      sidebar={
        <Sidebar
          items={items}
          exactHrefs={[items[0].href]}
          project={{ name: titleFromSlug(id), subtitle: "Sample project", menu: projectMenu(id) }}
        />
      }
    >
      {children}
    </AppShell>
  );
}
