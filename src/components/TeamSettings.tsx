"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { addTeamMember, changeOwnPassword, removeTeamMember, type OrgFormState, type PasswordState } from "@/actions/org";
import { fmtDate } from "@/lib/boq";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary small" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

export default function TeamSettings({
  canEdit,
  currentUserId,
  members,
}: {
  canEdit: boolean;
  currentUserId: string;
  members: { id: string; name: string; email: string; role: string; createdAt: Date }[];
}) {
  const [addState, addAction] = useActionState<OrgFormState, FormData>(addTeamMember, {});
  const [pwState, pwAction] = useActionState<PasswordState, FormData>(changeOwnPassword, {});
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="settings-section">
        <h3>
          Team <span className="note">— admins can edit the rate card; members build BOQs</span>
        </h3>

        {addState.error ? <div className="flash err">{addState.error}</div> : null}
        {addState.ok ? <div className="flash ok">{addState.ok}</div> : null}

        <table className="mini-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>{member.role === "ADMIN" ? "Admin" : "Team member"}</td>
                <td>{fmtDate(member.createdAt)}</td>
                <td style={{ textAlign: "right" }}>
                  {canEdit && member.id !== currentUserId ? (
                    <form action={removeTeamMember}>
                      <input type="hidden" name="userId" value={member.id} />
                      <button type="submit" className="rm-btn" title={`Remove ${member.name}`}>
                        ✕
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {canEdit ? (
          addOpen ? (
            <form action={addAction} style={{ marginTop: 14 }}>
              <div className="inline-form">
                <div className="f">
                  <label htmlFor="tm-name">Name</label>
                  <input id="tm-name" name="name" required />
                </div>
                <div className="f">
                  <label htmlFor="tm-email">Email</label>
                  <input id="tm-email" name="email" type="email" required />
                </div>
                <div className="f">
                  <label htmlFor="tm-password">Starting password</label>
                  <input id="tm-password" name="password" type="text" minLength={8} required />
                </div>
                <div className="f" style={{ flex: "0 0 150px" }}>
                  <label htmlFor="tm-role">Role</label>
                  <select id="tm-role" name="role" defaultValue="MEMBER">
                    <option value="MEMBER">Team member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <Submit label="Add member" busy="Adding…" />
                <button type="button" className="btn light small" onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button className="btn light small" style={{ marginTop: 14 }} onClick={() => setAddOpen(true)}>
              + Add team member
            </button>
          )
        ) : null}
      </div>

      <div className="settings-section">
        <h3>Your password</h3>
        {pwState.error ? <div className="flash err">{pwState.error}</div> : null}
        {pwState.ok ? <div className="flash ok">{pwState.ok}</div> : null}
        <form action={pwAction}>
          <div className="inline-form">
            <div className="f">
              <label htmlFor="pw-current">Current password</label>
              <input id="pw-current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="f">
              <label htmlFor="pw-next">New password</label>
              <input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <Submit label="Change password" busy="Saving…" />
          </div>
        </form>
      </div>
    </>
  );
}
