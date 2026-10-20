import { AppShell } from "@/components/shell/AppShell";
import { Sidebar } from "@/components/shell/Sidebar";
import { projectMenu, projectNav } from "@/lib/nav";
import { loadShellProject } from "@/lib/shell-project";
import { shellUser } from "@/lib/user-display";

export const dynamic = "force-dynamic";

/**
 * ProjectShell: inside a project the sidebar switches to the project's tabs.
 * Loads the project once, scoped to the signed-in person's organisation; anything
 * else is a 404. Membership checks arrive with project members in Phase 0 (P0-7).
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, project } = await loadShellProject(id);

  const display = shellUser(user);
  const items = projectNav(project.id);
  return (
    <AppShell
      initials={display.initials}
      sidebar={
        <Sidebar
          items={items}
          exactHrefs={[items[0].href]}
          user={display}
          project={{
            name: project.name,
            subtitle: project.clientName || "No client yet",
            menu: projectMenu(project.id),
          }}
        />
      }
    >
      {children}
    </AppShell>
  );
}
