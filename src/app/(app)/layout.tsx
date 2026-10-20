import { AppShell } from "@/components/shell/AppShell";
import { Sidebar } from "@/components/shell/Sidebar";
import { requireUser } from "@/lib/auth";
import { GLOBAL_NAV, GLOBAL_NAV_FOOTER } from "@/lib/nav";
import { shellUser } from "@/lib/user-display";

export const dynamic = "force-dynamic";

/** Global pages: the six global areas in the sidebar, Org Settings at the bottom. */
export default async function GlobalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const display = shellUser(user);
  // Team is admin-only (the page checks on the server too); hidden, not greyed out (UI spec 3).
  const items = user.role === "ADMIN" ? GLOBAL_NAV : GLOBAL_NAV.filter((item) => item.href !== "/team");
  return (
    <AppShell
      initials={display.initials}
      sidebar={<Sidebar items={items} footerItem={GLOBAL_NAV_FOOTER} user={display} />}
    >
      {children}
    </AppShell>
  );
}
