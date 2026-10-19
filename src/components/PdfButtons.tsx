"use client";

import { useState } from "react";

import type { BoqSnapshot } from "@/lib/boq";
import { downloadBoqPdf, type Letterhead, type PdfMode } from "@/lib/pdf";

/**
 * PDF export is async now that the Unicode font is dynamically imported, so the
 * button owns its own busy state rather than looking dead for a beat.
 */
export function PdfButton({
  snapshot,
  letterhead,
  mode,
  label,
  className = "btn",
  style,
  onError,
}: {
  snapshot: BoqSnapshot;
  letterhead: Letterhead;
  mode: PdfMode;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await downloadBoqPdf(snapshot, letterhead, mode);
    } catch {
      onError?.("Could not build that PDF — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className={className} style={style} disabled={busy} onClick={() => void run()}>
      {busy ? "Building…" : label}
    </button>
  );
}
