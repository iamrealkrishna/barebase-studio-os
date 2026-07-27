"use client";

import autoTable from "jspdf-autotable";
import { useState } from "react";

import { createPdfDoc, PDF_FONT, type Letterhead } from "@/lib/pdf";

export type AuditRow = {
  when: string;
  actorType: string;
  actorName: string;
  action: string;
};

/**
 * Exportable audit log (APPROVALS_SPEC §4) — the record that settles disputes
 * about who agreed to what and when. Internal-only, never linked to a client.
 */
export default function AuditLogButton({
  projectName,
  letterhead,
  events,
}: {
  projectName: string;
  letterhead: Letterhead;
  events: AuditRow[];
}) {
  const [busy, setBusy] = useState(false);

  const build = async () => {
    const doc = await createPdfDoc();
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(16);
    doc.setTextColor(33, 31, 26);
    doc.text(letterhead.name.toUpperCase(), 40, 46);

    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 85, 70);
    if (letterhead.addressLine) doc.text(letterhead.addressLine, 40, 60);

    doc.setDrawColor(138, 107, 50);
    doc.setLineWidth(1.2);
    doc.line(40, 72, pageW - 40, 72);

    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(33, 31, 26);
    doc.text("BOQ AUDIT LOG — INTERNAL", 40, 94);

    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(9.5);
    doc.text(`Project: ${projectName}`, 40, 110);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageW - 40, 110, { align: "right" });

    autoTable(doc, {
      startY: 126,
      head: [["When", "Who", "Event"]],
      body: events.map((event) => [
        new Date(event.when).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        `${event.actorName} (${event.actorType})`,
        event.action,
      ]),
      theme: "grid",
      styles: { font: PDF_FONT, fontSize: 8, cellPadding: 4, textColor: [33, 31, 26], lineColor: [214, 207, 187] },
      headStyles: { font: PDF_FONT, fillColor: [239, 235, 224], textColor: [90, 85, 74], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 130 } },
      margin: { left: 40, right: 40 },
    });

    doc.save(`${projectName.replace(/\s+/g, "_")}_Audit_Log.pdf`);
  };

  const download = async () => {
    setBusy(true);
    try {
      await build();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn light small" onClick={() => void download()} disabled={busy || events.length === 0}>
      {busy ? "Building…" : "Export audit log PDF"}
    </button>
  );
}
