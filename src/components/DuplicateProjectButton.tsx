"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { duplicateProject } from "@/actions/project-copy";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary small" disabled={pending}>
      {pending ? "Copying…" : "Create copy"}
    </button>
  );
}

export default function DuplicateProjectButton({
  projectId,
  projectName,
  clientName,
}: {
  projectId: string;
  projectName: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="cv-mini-btn"
        title={`Duplicate ${projectName}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        Duplicate
      </button>
    );
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal">
        <div className="modal-head">
          <h3>Duplicate project</h3>
          <button className="icon-btn" onClick={() => setOpen(false)} title="Close">
            ✕
          </button>
        </div>

        <form action={duplicateProject}>
          <div className="modal-body">
            <input type="hidden" name="projectId" value={projectId} />

            <p className="hint-text" style={{ marginTop: 0 }}>
              Copies every section and line item from <b>{projectName}</b>, along with its terms, discount and GST
              settings. The copy starts as a fresh Draft — no versions, client links or approvals carry over.
            </p>

            <div className="item-field" style={{ marginBottom: 12 }}>
              <label>New project name</label>
              <input type="text" name="name" defaultValue={`${projectName} (copy)`} required autoFocus />
            </div>

            <div className="item-field" style={{ marginBottom: 12 }}>
              <label>Client name</label>
              <input type="text" name="clientName" placeholder="Leave blank to fill in later" />
            </div>

            {clientName ? (
              <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" name="keepClient" />
                Keep the original client ({clientName})
              </label>
            ) : null}
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn light small" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <Submit />
          </div>
        </form>
      </div>
    </div>
  );
}
