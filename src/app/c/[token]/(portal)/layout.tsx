import type { Metadata } from "next";

import { ClientShell } from "@/components/shell/PhoneShells";
import { clientTabs } from "@/lib/nav";

// A client link is a credential; keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * ClientShell for the portal tabs that aren't built yet. Nothing about the project is
 * loaded here: these placeholders sit outside the email check, so they show no data.
 * The live estimate at /c/[token] keeps its own gated page (and isn't wrapped by this).
 */
export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <ClientShell projectName="Your home" clientName="you" tabs={clientTabs(token)}>
      {children}
    </ClientShell>
  );
}
