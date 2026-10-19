import { AppShell } from "@/components/shell/AppShell";
import { Sidebar } from "@/components/shell/Sidebar";
import { GLOBAL_NAV, GLOBAL_NAV_FOOTER } from "@/lib/nav";

/** Global pages: the six global areas in the sidebar, Org Settings at the bottom. */
export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell sidebar={<Sidebar items={GLOBAL_NAV} footerItem={GLOBAL_NAV_FOOTER} />}>{children}</AppShell>;
}
