"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { teamAction, type TeamFormState } from "@/actions/team";
import { fmtDate } from "@/lib/boq";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  projectCount: number;
  versionCount: number;
};

function Submit({
  label,
  busy,
  className = "btn primary small",
  title,
}: {
  label: string;
  busy: string;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} title={title}>
      {pending ? busy : label}
    </button>
  );
}

export default function TeamManager({
  currentUserId,
  members,
}: {
  currentUserId: string;
  members: TeamMember[];
}) {
  // One action, one state, one message — always the result of the last thing done.
  const [state, action] = useActionState<TeamFormState, FormData>(teamAction, {});

  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.active);
  const inactiveMembers = members.filter((m) => !m.active);
  const adminCount = activeMembers.filter((m) => m.role === "ADMIN").length;

  const row = (member: TeamMember) => {
    const isSelf = member.id === currentUserId;
    const lastAdmin = member.role === "ADMIN" && adminCount === 1;

    return (
      <tr key={member.id} style={member.active ? undefined : { opacity: 0.6 }}>
        <td>
          <b>{member.name}</b>
          {isSelf ? <span className="approval-pill pending" style={{ marginLeft: 6 }}>You</span> : null}
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
            Added {fmtDate(member.createdAt)}
            {member.projectCount > 0 || member.versionCount > 0
              ? ` · ${member.projectCount} project${member.projectCount === 1 ? "" : "s"}, ${member.versionCount} version${member.versionCount === 1 ? "" : "s"}`
              : ""}
          </div>
        </td>
        <td>{member.email}</td>
        <td>
          {member.active ? (
            <form action={action} style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <input type="hidden" name="intent" value="role" />
              <input type="hidden" name="userId" value={member.id} />
              <input type="hidden" name="role" value={member.role === "ADMIN" ? "MEMBER" : "ADMIN"} />
              <span className={`approval-pill ${member.role === "ADMIN" ? "approved" : "pending"}`}>
                {member.role === "ADMIN" ? "Admin" : "Team Member"}
              </span>
              <Submit
                className="cv-mini-btn"
                label={member.role === "ADMIN" ? "Demote" : "Promote"}
                busy="…"
              />
            </form>
          ) : (
            <span className="approval-pill pending">{member.role === "ADMIN" ? "Admin" : "Team Member"}</span>
          )}
        </td>
        <td>
          {member.active ? (
            <span className="approval-pill approved">Active</span>
          ) : (
            <span className="approval-pill rejected">
              Deactivated{member.deactivatedAt ? ` ${fmtDate(member.deactivatedAt)}` : ""}
            </span>
          )}
        </td>
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {member.active ? (
            <>
              <button
                className="cv-mini-btn"
                style={{ marginRight: 5 }}
                onClick={() => setResetFor(resetFor === member.id ? null : member.id)}
              >
                Reset password
              </button>
              <form action={action} style={{ display: "inline-block" }}>
                <input type="hidden" name="intent" value="active" />
                <input type="hidden" name="userId" value={member.id} />
                <input type="hidden" name="active" value="false" />
                <Submit
                  className="cv-mini-btn"
                  label="Deactivate"
                  busy="…"
                  title={
                    isSelf
                      ? "You can't deactivate your own account"
                      : lastAdmin
                        ? "Promote another Admin first"
                        : undefined
                  }
                />
              </form>
            </>
          ) : (
            <form action={action} style={{ display: "inline-block" }}>
              <input type="hidden" name="intent" value="active" />
              <input type="hidden" name="userId" value={member.id} />
              <input type="hidden" name="active" value="true" />
              <Submit className="cv-mini-btn on-approve" label="Restore access" busy="…" />
            </form>
          )}

          {resetFor === member.id ? (
            <form action={action} style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <input type="hidden" name="intent" value="password" />
              <input type="hidden" name="userId" value={member.id} />
              <input
                name="password"
                type="text"
                minLength={8}
                required
                autoFocus
                placeholder="New password (min 8)"
                style={{
                  padding: "5px 8px",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  fontSize: 12,
                  background: "#fff",
                }}
              />
              <Submit className="cv-mini-btn" label="Set" busy="…" />
            </form>
          ) : null}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="settings-section">
        <h3>
          Team members{" "}
          <span className="note">
            — Admins edit the rate card and manage this page; Team Members build BOQs
          </span>
        </h3>

        {state.error ? <div className="flash err">{state.error}</div> : null}
        {state.ok ? <div className="flash ok">{state.ok}</div> : null}

        <table className="mini-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>{activeMembers.map(row)}</tbody>
        </table>

        {addOpen ? (
          <form action={action} style={{ marginTop: 16 }}>
            <input type="hidden" name="intent" value="add" />
            <div className="inline-form">
              <div className="f">
                <label htmlFor="tm-name">Name</label>
                <input id="tm-name" name="name" required autoFocus />
              </div>
              <div className="f">
                <label htmlFor="tm-email">Email</label>
                <input id="tm-email" name="email" type="email" required />
              </div>
              <div className="f">
                <label htmlFor="tm-password">Initial password</label>
                <input id="tm-password" name="password" type="text" minLength={8} required placeholder="min 8 characters" />
              </div>
              <div className="f" style={{ flex: "0 0 160px" }}>
                <label htmlFor="tm-role">Role</label>
                <select id="tm-role" name="role" defaultValue="MEMBER">
                  <option value="MEMBER">Team Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <Submit label="Add member" busy="Adding…" />
              <button type="button" className="btn light small" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
            </div>
            <p className="hint-text">
              You set the password here and pass it to them directly — there&apos;s no email sending yet. They can
              change it themselves under Rate Card &amp; Settings once they&apos;re in.
            </p>
          </form>
        ) : (
          <button className="btn primary small" style={{ marginTop: 16 }} onClick={() => setAddOpen(true)}>
            ＋ Add team member
          </button>
        )}
      </div>

      {inactiveMembers.length > 0 ? (
        <div className="settings-section">
          <h3>
            Deactivated{" "}
            <span className="note">— can&apos;t sign in; everything they built stays on the record</span>
          </h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>{inactiveMembers.map(row)}</tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
