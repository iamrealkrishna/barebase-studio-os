"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { createProject } from "@/actions/projects";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary small" style={{ padding: "9px 18px" }} disabled={pending}>
      {pending ? "Creating…" : "Create project"}
    </button>
  );
}

export default function NewProjectForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div style={{ marginBottom: 18 }}>
        <button className="btn primary small" style={{ padding: "9px 18px" }} onClick={() => setOpen(true)}>
          ＋ Add project
        </button>
      </div>
    );
  }

  return (
    <form className="settings-section" action={createProject}>
      <h3>New project</h3>
      <div className="inline-form">
        <div className="f">
          <label htmlFor="np-name">Property / project</label>
          <input id="np-name" name="name" placeholder="e.g. Heritage Firefly, 3BHK" required autoFocus />
        </div>
        <div className="f">
          <label htmlFor="np-client">Client name</label>
          <input id="np-client" name="clientName" placeholder="e.g. Priyanka &amp; Pareekshat" />
        </div>
        <SubmitButton />
        <button type="button" className="btn light small" style={{ padding: "9px 14px" }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
