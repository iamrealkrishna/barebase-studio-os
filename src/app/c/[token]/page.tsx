import type { Metadata } from "next";

import ClientGate from "@/components/ClientGate";

export const dynamic = "force-dynamic";

// A share link is a bearer credential; keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The client-facing estimate.
 *
 * Nothing about the project is rendered here. The page hands the token to the
 * gate, which asks for the email address the link was issued to and only then
 * fetches the estimate — so a visitor who fails the check never receives the
 * BOQ at all, rather than having it hidden behind an overlay.
 */
export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientGate token={token} />;
}
