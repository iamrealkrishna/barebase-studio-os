import type { Metadata, Viewport } from "next";

import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Barebase Studio OS", template: "%s · Barebase" },
  description: "Barebase's one place for leads, projects, BOQs, money, site work and handover.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
