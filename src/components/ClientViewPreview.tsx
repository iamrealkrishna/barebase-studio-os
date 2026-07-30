"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { updateClientColumns } from "@/actions/projects";
import ClientBoqView from "@/components/ClientBoqView";
import ClientColumnToggles from "@/components/ClientColumnToggles";
import { PdfButton } from "@/components/PdfButtons";
import ProjectBar from "@/components/ProjectBar";
import { Toast, useToast } from "@/components/Toast";
import { CLIENT_VISIBLE_FIELDS, diffSnapshots, type BoqSnapshot } from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";

export default function ClientViewPreview({
  projectId,
  projectName,
  snapshot,
  letterhead,
  approvedSnapshot,
  approvedVersionNumber,
  shareLinks,
}: {
  projectId: string;
  projectName: string;
  snapshot: BoqSnapshot;
  letterhead: Letterhead;
  approvedSnapshot: BoqSnapshot | null;
  approvedVersionNumber: number | null;
  shareLinks: { id: string; name: string; email: string; url: string }[];
}) {
  const { message, toast } = useToast();
  const [pendingCols, startColsTransition] = useTransition();
  // Held locally so the preview below re-renders the moment a box is ticked,
  // rather than waiting on the round trip.
  const [cols, setCols] = useState(snapshot.meta.cols);

  const applyCols = (next: typeof cols) => {
    setCols(next);
    startColsTransition(async () => {
      const result = await updateClientColumns(projectId, next);
      toast(result.ok ? "Client columns updated" : "Could not save that — try again");
    });
  };

  const shown: BoqSnapshot = { ...snapshot, meta: { ...snapshot.meta, cols } };
  const diff = diffSnapshots(shown, approvedSnapshot, CLIENT_VISIBLE_FIELDS);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Share link copied");
    } catch {
      toast("Copy failed — select the link and copy it manually");
    }
  };

  return (
    <>
      <ProjectBar
        projectId={projectId}
        projectName={projectName}
        active="clientview"
        right={
          <PdfButton
            snapshot={shown}
            letterhead={letterhead}
            mode="client"
            label="Client PDF"
            className="btn primary"
            onError={toast}
          />
        }
      />

      <ClientBoqView
        snapshot={shown}
        letterhead={letterhead}
        diff={approvedSnapshot ? diff : null}
        banner={
          <div className="cv-banner">
            <span>
              Preview of what your client sees — no cost or margin data, no version history.
              {approvedVersionNumber
                ? ` Highlights are measured against approved V${approvedVersionNumber}.`
                : " Nothing has been approved yet, so nothing is highlighted."}
            </span>
            <Link href={`/projects/${projectId}`} className="btn small" style={{ whiteSpace: "nowrap" }}>
              Manage client access →
            </Link>
          </div>
        }
        beforeContent={
          <div className="cv-controls">
            <div className="cv-controls-head">
              What the client can see
              {pendingCols ? <span className="cv-controls-saving">saving…</span> : null}
            </div>
            <ClientColumnToggles cols={cols} onChange={applyCols} variant="light" disabled={pendingCols} />
            <p className="col-toggle-note">
              Same setting as the Summary panel on Build BOQ — applies here, to the Client PDF and to the Internal PDF.
            </p>
          </div>
        }
        footer={
          <div style={{ marginTop: 20 }}>
            <div className="settings-section">
              <h3>
                Client links <span className="note">— each one is scoped to this project only</span>
              </h3>
              {shareLinks.length === 0 ? (
                <div className="mini-empty">
                  No client contacts yet. Add one on{" "}
                  <Link href={`/projects/${projectId}`}>Versions &amp; Approvals</Link> to generate a share link.
                </div>
              ) : (
                shareLinks.map((link) => (
                  <div key={link.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {link.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{link.email}</span>
                    </div>
                    <div className="share-link">
                      <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
                      <button className="btn light small" onClick={() => void copy(link.url)}>
                        Copy
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        }
      />

      <Toast message={message} />
    </>
  );
}
