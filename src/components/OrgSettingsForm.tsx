"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateOrganisation, type OrgFormState } from "@/actions/org";

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary small" disabled={disabled || pending}>
      {pending ? "Saving…" : "Save letterhead & terms"}
    </button>
  );
}

export default function OrgSettingsForm({
  canEdit,
  org,
}: {
  canEdit: boolean;
  org: {
    name: string;
    legalName: string;
    addressLine: string;
    pocName: string;
    pocPhone: string;
    pocEmail: string;
    terms: string;
  };
}) {
  const [state, action] = useActionState<OrgFormState, FormData>(updateOrganisation, {});

  return (
    <form className="settings-section" action={action}>
      <h3>
        Letterhead &amp; default terms <span className="note">— used on every PDF and the client view</span>
      </h3>

      {state.error ? <div className="flash err">{state.error}</div> : null}
      {state.ok ? <div className="flash ok">{state.ok}</div> : null}

      <div className="settings-grid">
        <div>
          <label htmlFor="org-name">Studio name</label>
          <input id="org-name" name="name" defaultValue={org.name} disabled={!canEdit} />
        </div>
        <div>
          <label htmlFor="org-legal">Legal entity (signature block)</label>
          <input id="org-legal" name="legalName" defaultValue={org.legalName} disabled={!canEdit} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="org-address">Address line</label>
          <input id="org-address" name="addressLine" defaultValue={org.addressLine} disabled={!canEdit} />
        </div>
        <div>
          <label htmlFor="org-poc">POC name</label>
          <input id="org-poc" name="pocName" defaultValue={org.pocName} disabled={!canEdit} />
        </div>
        <div>
          <label htmlFor="org-phone">POC phone</label>
          <input id="org-phone" name="pocPhone" defaultValue={org.pocPhone} disabled={!canEdit} />
        </div>
        <div>
          <label htmlFor="org-email">POC email</label>
          <input id="org-email" name="pocEmail" defaultValue={org.pocEmail} disabled={!canEdit} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="org-terms">Default terms &amp; exclusions (seeded into new projects)</label>
          <textarea id="org-terms" name="terms" rows={6} defaultValue={org.terms} disabled={!canEdit} />
        </div>
      </div>

      {canEdit ? (
        <div style={{ marginTop: 14 }}>
          <SaveButton disabled={!canEdit} />
        </div>
      ) : null}
    </form>
  );
}
