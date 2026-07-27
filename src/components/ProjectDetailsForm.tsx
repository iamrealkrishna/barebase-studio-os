"use client";

import { useState, useTransition } from "react";

import { updateProjectMeta } from "@/actions/projects";
import { Toast, useToast } from "@/components/Toast";

type Fields = {
  name: string;
  clientName: string;
  preparedBy: string;
  quoteDate: string;
  terms: string;
};

export default function ProjectDetailsForm({ projectId, initial }: { projectId: string; initial: Fields }) {
  const { message, toast } = useToast();
  const [fields, setFields] = useState<Fields>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const patch = (changes: Partial<Fields>) => {
    setFields((prev) => ({ ...prev, ...changes }));
    setDirty(true);
  };

  const save = () => {
    startTransition(async () => {
      const result = await updateProjectMeta({ projectId, ...fields });
      if (result.ok) {
        setDirty(false);
        toast("Project details saved");
      } else {
        toast("Could not save — try again");
      }
    });
  };

  return (
    <div className="settings-section">
      <h3>Project details</h3>

      <div className="settings-grid">
        <div>
          <label htmlFor="pd-client">Client name</label>
          <input
            id="pd-client"
            value={fields.clientName}
            placeholder="e.g. Priyanka &amp; Pareekshat"
            onChange={(e) => patch({ clientName: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="pd-name">Property / project</label>
          <input
            id="pd-name"
            value={fields.name}
            placeholder="e.g. Heritage Firefly, 3BHK"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="pd-prepared">Prepared by</label>
          <input
            id="pd-prepared"
            value={fields.preparedBy}
            placeholder="e.g. Ridhi Bhinde"
            onChange={(e) => patch({ preparedBy: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="pd-date">Date</label>
          <input id="pd-date" type="date" value={fields.quoteDate} onChange={(e) => patch({ quoteDate: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="pd-terms">Terms &amp; exclusions — used in the Client PDF and Client View</label>
          <textarea id="pd-terms" rows={6} value={fields.terms} onChange={(e) => patch({ terms: e.target.value })} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="btn primary small" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : dirty ? "Save project details" : "Saved"}
        </button>
      </div>

      <Toast message={message} />
    </div>
  );
}
