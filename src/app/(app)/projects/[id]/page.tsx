import { addClientContact, revokeClientContact, setVersionStatus } from "@/actions/approvals";
import { restoreVersion } from "@/actions/projects";
import AuditLogButton from "@/components/AuditLogButton";
import ProjectBar from "@/components/ProjectBar";
import ProjectDetailsForm from "@/components/ProjectDetailsForm";
import SaveVersionButton from "@/components/SaveVersionButton";
import ShareLinkRow from "@/components/ShareLinkRow";
import { clientLink } from "@/lib/app-url";
import {
  approvalLabel,
  computeTotals,
  countItems,
  fieldLabel,
  fmt,
  fmtDate,
  statusClass,
  statusLabel,
} from "@/lib/boq";
import { prisma } from "@/lib/db";
import { getProjectPageData, toSnapshot } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { reviewAttentionCount } from "@/lib/versions";

export const dynamic = "force-dynamic";

export default async function ProjectVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, letterhead } = await getProjectPageData(id);

  const [versions, contacts, changeOrders, auditEvents, reviewFlag] = await Promise.all([
    prisma.version.findMany({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
      include: { approvals: { include: { contact: { select: { name: true } } } } },
    }),
    prisma.clientContact.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    prisma.changeOrder.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.auditEvent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    reviewAttentionCount(project.id),
  ]);

  const live = toSnapshot(project);
  const liveTotals = computeTotals(live);
  const approvedVersion = versions.find((version) => version.status === "APPROVED") ?? null;

  return (
    <>
      <ProjectBar projectId={project.id} projectName={project.name} active="versions" reviewFlag={reviewFlag} />

      <div className="settings-wrap">
        {approvedVersion ? (
          <div style={{ marginBottom: 16 }}>
            <span className="status-badge approved">
              ✓ V{approvedVersion.number} approved
              {approvedVersion.approvedByContact ? ` by ${approvedVersion.approvedByContact}` : ""} ·{" "}
              {fmtDate(approvedVersion.approvedAt ?? approvedVersion.createdAt)}
            </span>
          </div>
        ) : null}

        <ProjectDetailsForm
          projectId={project.id}
          initial={{
            name: project.name,
            clientName: project.clientName,
            preparedBy: project.preparedBy,
            quoteDate: project.quoteDate,
            terms: project.terms,
          }}
        />

        {/* ------------------------------------------------------- versions */}
        <div className="settings-section">
          <h3>
            Version history <span className="note">— internal only, never shown to the client</span>
          </h3>

          <div style={{ marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SaveVersionButton projectId={project.id} />
            <span className="hint-text" style={{ marginTop: 0 }}>
              Live BOQ: {countItems(live)} item{countItems(live) === 1 ? "" : "s"} ·{" "}
              <span className="tabular">{fmt(liveTotals.grand)}</span>
            </span>
          </div>

          {versions.length === 0 ? (
            <div className="no-versions">
              No versions yet. Save one here, or use “Save version &amp; continue to Client View” on Build BOQ.
            </div>
          ) : (
            versions.map((version) => {
              const snapshot = parseSnapshot(version.snapshot);
              const totals = computeTotals(snapshot);
              const items = countItems(snapshot);
              const approvedLines = version.approvals.filter((a) => a.status === "APPROVED").length;
              const pct = items > 0 ? Math.round((approvedLines / items) * 100) : 0;

              return (
                <div className="version-row" key={version.id} style={{ flexWrap: "wrap" }}>
                  <span className="v-num">V{version.number}</span>
                  <span className={`status-badge ${statusClass(version.status)}`}>{statusLabel(version.status)}</span>
                  <span style={{ minWidth: 150 }}>
                    <span className="v-time">{fmtDate(version.createdAt)}</span>{" "}
                    <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                      {version.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="v-meta">
                    {items} item{items === 1 ? "" : "s"} · <span className="tabular">{fmt(totals.grand)}</span> · by{" "}
                    {version.createdByName || "—"}
                    {version.approvals.length > 0 ? (
                      <span className="rollup" style={{ marginTop: 4 }}>
                        <span className="bar">
                          <i style={{ width: `${pct}%` }} />
                        </span>
                        {approvedLines}/{items} lines approved
                      </span>
                    ) : null}
                  </span>

                  <form action={setVersionStatus} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="versionId" value={version.id} />
                    <select name="status" defaultValue={version.status} className="v-status">
                      <option value="DRAFT">Draft</option>
                      <option value="SENT_TO_CLIENT">Sent to Client</option>
                      <option value="APPROVED">Approved</option>
                    </select>
                    <button type="submit" className="btn light small">
                      Set
                    </button>
                  </form>

                  <form action={restoreVersion}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="versionId" value={version.id} />
                    <button type="submit" className="btn light small">
                      Open
                    </button>
                  </form>

                  {version.approvals.filter((a) => a.comment).length > 0 ? (
                    <div style={{ flexBasis: "100%", marginTop: 8 }}>
                      {version.approvals
                        .filter((a) => a.comment)
                        .map((approval) => (
                          <div key={approval.id} className="cv-comment-note">
                            <b>{approval.contact.name}</b> on <b>{approval.lineItemName || "a line item"}</b> (
                            {approvalLabel(approval.status)}): {approval.comment}
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* ------------------------------------------------- client contacts */}
        <div className="settings-section">
          <h3>
            Client access <span className="note">— a link per contact, scoped to this project only</span>
          </h3>

          {contacts.length === 0 ? (
            <div className="mini-empty">No client contacts yet. Add one to share a review link.</div>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Last viewed</th>
                  <th>Last approved</th>
                  <th>Link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const lastApproved = versions.find((v) => v.id === contact.lastApprovedVersionId);
                  return (
                    <tr key={contact.id} style={contact.revoked ? { opacity: 0.5 } : undefined}>
                      <td>{contact.name}</td>
                      <td>{contact.email}</td>
                      <td>{contact.lastViewedAt ? fmtDate(contact.lastViewedAt) : "—"}</td>
                      <td>{lastApproved ? `V${lastApproved.number}` : "—"}</td>
                      <td style={{ minWidth: 260 }}>
                        {contact.revoked ? (
                          <span style={{ color: "var(--muted)" }}>Revoked</span>
                        ) : (
                          <ShareLinkRow url={clientLink(contact.token)} />
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {contact.revoked ? null : (
                          <form action={revokeClientContact}>
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="contactId" value={contact.id} />
                            <button type="submit" className="rm-btn" title="Revoke this link">
                              ✕
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <form action={addClientContact} style={{ marginTop: 14 }}>
            <input type="hidden" name="projectId" value={project.id} />
            <div className="inline-form">
              <div className="f">
                <label htmlFor="cc-name">Contact name</label>
                <input id="cc-name" name="name" placeholder="e.g. Priyanka" required />
              </div>
              <div className="f">
                <label htmlFor="cc-email">Email</label>
                <input id="cc-email" name="email" type="email" placeholder="name@example.com" required />
              </div>
              <button type="submit" className="btn primary small">
                Create review link
              </button>
            </div>
          </form>
        </div>

        {/* --------------------------------------------------- change orders */}
        <div className="settings-section">
          <h3>
            Change orders <span className="note">— raised automatically when approved scope moves</span>
          </h3>

          {changeOrders.length === 0 ? (
            <div className="mini-empty">
              Nothing yet. Once a version is approved, any later edit to an approved line is recorded here.
            </div>
          ) : (
            changeOrders.map((order) => (
              <div className="co-row" key={order.id}>
                <div className="co-head">
                  <span className={`co-kind ${order.kind.toLowerCase()}`}>{order.kind}</span>
                  <span className="co-name">{order.lineItemName}</span>
                  <span className="co-where">in {order.sectionName}</span>
                  <span className="co-when">
                    {fmtDate(order.createdAt)} · {order.createdByName}
                  </span>
                </div>
                {Array.isArray(order.changes) && order.changes.length > 0 ? (
                  <div className="co-changes">
                    {(order.changes as { field: string; from: string; to: string }[]).map((change, i) => (
                      <div className="co-change" key={`${order.id}-${i}`}>
                        <b>{fieldLabel(change.field)}:</b> <span className="from">{change.from || "—"}</span> →{" "}
                        <span className="to">{change.to || "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* ---------------------------------------------------- audit trail */}
        <div className="settings-section">
          <h3>
            Audit trail <span className="note">— internal only</span>
            <span className="right">
              <AuditLogButton
                projectName={project.name}
                letterhead={letterhead}
                events={auditEvents.map((event) => ({
                  when: event.createdAt.toISOString(),
                  actorType: event.actorType,
                  actorName: event.actorName,
                  action: event.action,
                }))}
              />
            </span>
          </h3>

          {auditEvents.length === 0 ? (
            <div className="mini-empty">Nothing recorded yet.</div>
          ) : (
            auditEvents.map((event) => (
              <div className="audit-row" key={event.id}>
                <span className="a-when">
                  {fmtDate(event.createdAt)}{" "}
                  {event.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="a-who">
                  <span className={`actor-tag ${event.actorType.toLowerCase()}`}>{event.actorType}</span>
                  {event.actorName}
                </span>
                <span className="a-what">{event.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
