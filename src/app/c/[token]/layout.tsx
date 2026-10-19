import type { Metadata } from "next";

import { ClientShell } from "@/components/shell/PhoneShells";
import { clientTabs } from "@/lib/nav";

// A client link is a credential; keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** ClientShell: letterhead and tabs, no staff session. Project and client come from the link in Phase 4. */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <ClientShell projectName="Sample project" clientName="the client" tabs={clientTabs(token)}>
      {children}
    </ClientShell>
  );
}
