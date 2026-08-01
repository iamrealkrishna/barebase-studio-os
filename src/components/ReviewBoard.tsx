"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApprovalStatus, BoqStatus } from "@prisma/client";

import { saveVersion } from "@/actions/projects";
import InlineItemRow from "@/components/InlineItemRow";
import ProjectBar from "@/components/ProjectBar";
import { Toast, useToast } from "@/components/Toast";
import {
  approvalLabel,
  CLIENT_VISIBLE_FIELDS,
  diffSnapshots,
  fmt,
  fmtDate,
  sectionTotal,
  statusLabel,
  type BoqSnapshot,
} from "@/lib/boq";
import { categoryList, type RateEntry } from "@/lib/rate-card";
import { useBoqEditor } from "@/lib/use-boq-editor";

export type ReviewApproval = {
  lineItemId: string;
  lineItemName: string;
  status: ApprovalStatus;
  comment: string;
  contactName: string;
  at: string;
};

type Filter = "attention" | "all";

const PILL_CLASS: Record<ApprovalStatus, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  REVISION_REQUESTED: "revision",
  PENDING: "pending",
};

/** Verdicts the team has to do something about. */
function needsAttention(records: ReviewApproval[]): boolean {
  return records.some(
    (r) => r.status === "REJECTED" || r.status === "REVISION_REQUESTED" || r.comment.trim() !== "",
  );
}

/**
 * What the client said, laid over the BOQ itself.
 *
 * Deliberately shaped like Build BOQ rather than a flat list of responses: the
 * team reads a rejection in the context of the section it sits in, and acts on
 * it in place. Editing here goes through the same hook — and therefore the same
 * autosave and the same live BOQ — as Build BOQ, so a change to an approved line
 * raises a Change Order on the next version exactly as it would there.
 */
export default function ReviewBoard({
  projectId,
  projectName,
  canSeeCost,
  initialSnapshot,
  initialUpdatedAt,
  rateEntries,
  approvedSnapshot,
  approvedVersionNumber,
  reviewedVersion,
  approvals,
  contacts,
}: {
  projectId: string;
  projectName: string;
  canSeeCost: boolean;
  initialSnapshot: BoqSnapshot;
  initialUpdatedAt: string;
  rateEntries: RateEntry[];
  approvedSnapshot: BoqSnapshot | null;
  approvedVersionNumber: number | null;
  reviewedVersion: { number: number; status: BoqStatus; sentAt: string; itemCount: number } | null;
  approvals: ReviewApproval[];
  contacts: { id: string; name: string; lastViewedAt: string | null }[];
}) {
  const router = useRouter();
  const { message, toast } = useToast();
  const [filter, setFilter] = useState<Filter>("attention");
  const [sending, setSending] = useState(false);
  const [costOn, setCostOn] = useState(false);
  const showCost = canSeeCost && costOn;

  const categories = useMemo(() => categoryList(rateEntries), [rateEntries]);

  const {
    snapshot,
    flush,
    saveState,
    saveChip,
    adoptUpdatedAt,
    pendingEdits,
    editCount,
    startEdit,
    changeEdit,
    discardEdit,
    cancelAllEdits,
    saveRowEdit,
    saveAllEdits,
  } = useBoqEditor({ projectId, initialSnapshot, initialUpdatedAt });

  /** Every response against a line, keyed by item id — one per contact. */
  const byItem = useMemo(() => {
    const map = new Map<string, ReviewApproval[]>();
    for (const record of approvals) {
      const list = map.get(record.lineItemId);
      if (list) list.push(record);
      else map.set(record.lineItemId, [record]);
    }
    return map;
  }, [approvals]);

  // Change-order flags, same as Build BOQ — editing an approved line here has
  // exactly the same consequence, so it's surfaced the same way.
  const diff = useMemo(
    () => diffSnapshots(snapshot, approvedSnapshot, CLIENT_VISIBLE_FIELDS),
    [snapshot, approvedSnapshot],
  );

  const liveIds = useMemo(
    () => new Set(snapshot.sections.flatMap((s) => s.items).map((i) => i.id)),
    [snapshot],
  );

  const counts = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let revision = 0;
    let pending = 0;
    let commented = 0;
    let attention = 0;

    for (const section of snapshot.sections) {
      for (const item of section.items) {
        const records = byItem.get(item.id) ?? [];
        if (records.length === 0) {
          pending += 1;
          continue;
        }
        if (records.some((r) => r.status === "REJECTED")) rejected += 1;
        else if (records.some((r) => r.status === "REVISION_REQUESTED")) revision += 1;
        else if (records.every((r) => r.status === "APPROVED")) approved += 1;
        else pending += 1;

        if (records.some((r) => r.comment.trim() !== "")) commented += 1;
        if (needsAttention(records)) attention += 1;
      }
    }
    return { approved, rejected, revision, pending, commented, attention };
  }, [snapshot, byItem]);

  /** Lines the client reviewed that have since been deleted from the BOQ. */
  const orphaned = useMemo(
    () => approvals.filter((record) => !liveIds.has(record.lineItemId)),
    [approvals, liveIds],
  );

  const sections = useMemo(
    () =>
      snapshot.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (filter === "all") return true;
            const records = byItem.get(item.id) ?? [];
            // An open editor keeps its row on screen even under the filter —
            // pulling it out from under someone mid-edit would be worse.
            if (pendingEdits[item.id]) return true;
            return needsAttention(records);
          }),
        }))
        .filter((section) => section.items.length > 0),
    [snapshot, byItem, filter, pendingEdits],
  );

  const resend = async () => {
    setSending(true);
    try {
      await flush();
      const result = await saveVersion(projectId, "SENT_TO_CLIENT");
      if (!result.ok) {
        toast(result.error ?? "Could not save that version");
        return;
      }
      if (result.updatedAt) adoptUpdatedAt(result.updatedAt);
      toast(`Saved as V${result.number} — back with the client`);
      router.push(`/projects/${projectId}/client-view`);
    } finally {
      setSending(false);
    }
  };

  const saveRow = (id: string) => {
    saveRowEdit(id);
    toast("Row saved");
  };

  const saveAll = () => {
    if (editCount === 0) return;
    saveAllEdits();
    toast(`${editCount} row${editCount === 1 ? "" : "s"} saved`);
  };

  const viewedBy = contacts.filter((contact) => contact.lastViewedAt);

  return (
    <>
      <ProjectBar
        projectId={projectId}
        projectName={projectName}
        active="review"
        // Per line, not per response — matches what the server counts for the
        // other tabs, so the badge doesn't change as you move between them.
        reviewFlag={counts.attention}
        right={
          <>
            <span className={`saving-chip${saveState === "saved" ? "" : " dirty"}`}>{saveChip}</span>
            {canSeeCost ? (
              <label className="cost-toggle">
                <input type="checkbox" checked={costOn} onChange={(e) => setCostOn(e.target.checked)} /> Cost &amp;
                margin
              </label>
            ) : null}
            <button
              className="btn primary"
              disabled={sending || !reviewedVersion}
              onClick={() => void resend()}
              title="Snapshot the edited BOQ as a new version and send it back"
            >
              {sending ? "Saving…" : "Save version & send back →"}
            </button>
          </>
        }
      />

      {saveState === "conflict" ? (
        <div className="conflict-banner">
          <span>
            <b>This page is out of date.</b> This BOQ has changed somewhere else — another tab, a teammate, or a
            restored version — so saving has stopped rather than overwrite it. Reload to pick up the current BOQ.
            {editCount > 0 ? " Your open row edits will be lost." : ""}
          </span>
          <button className="btn primary small" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      ) : null}

      <div className="settings-wrap">
        {!reviewedVersion ? (
          <div className="review-empty">
            <h3>Nothing has been sent for review yet</h3>
            <p>
              Once you save a version as <b>Sent to Client</b> and a contact opens their link, their line-by-line
              verdicts and comments show up here — laid over the BOQ, editable in place.
            </p>
            <Link className="btn light small" href={`/projects/${projectId}/build`}>
              ← Back to Build BOQ
            </Link>
          </div>
        ) : (
          <>
            <div className="review-head">
              <div className="review-head-main">
                <h2>
                  Client review of V{reviewedVersion.number}
                  <span className={`status-badge ${reviewedVersion.status === "APPROVED" ? "approved" : "sent"}`}>
                    {statusLabel(reviewedVersion.status)}
                  </span>
                </h2>
                <p className="hint-text" style={{ marginTop: 4 }}>
                  Sent {fmtDate(reviewedVersion.sentAt)}.{" "}
                  {viewedBy.length > 0
                    ? `Opened by ${viewedBy.map((c) => `${c.name} (${fmtDate(c.lastViewedAt)})`).join(", ")}.`
                    : "No client has opened the link yet."}{" "}
                  Verdicts are recorded against V{reviewedVersion.number} ({reviewedVersion.itemCount} line
                  {reviewedVersion.itemCount === 1 ? "" : "s"} sent); the rows below are the <b>live BOQ</b>, which is
                  what you edit.
                </p>
              </div>

              <div className="review-counts">
                <span className="rc approved">
                  <b>{counts.approved}</b> approved
                </span>
                <span className="rc rejected">
                  <b>{counts.rejected}</b> rejected
                </span>
                <span className="rc revision">
                  <b>{counts.revision}</b> changes asked
                </span>
                <span className="rc pending">
                  <b>{counts.pending}</b> pending
                </span>
                <span className="rc noted">
                  <b>{counts.commented}</b> with notes
                </span>
              </div>
            </div>

            <div className="review-filter">
              <button
                className={`cv-mini-btn${filter === "attention" ? " on-revision" : ""}`}
                onClick={() => setFilter("attention")}
              >
                Needs attention ({counts.attention})
              </button>
              <button
                className={`cv-mini-btn${filter === "all" ? " on-revision" : ""}`}
                onClick={() => setFilter("all")}
              >
                Every line
              </button>
              <span className="hint-text" style={{ marginTop: 0 }}>
                Edit any row in place — it saves to the live BOQ.
                {approvedVersionNumber
                  ? ` Changing a line approved in V${approvedVersionNumber} raises a change order when you save the next version.`
                  : ""}
              </span>
            </div>

            {sections.length === 0 ? (
              <div className="mini-empty">
                {filter === "attention"
                  ? counts.pending > 0
                    ? "Nothing rejected or commented on so far — the client still has lines to get through."
                    : "Nothing needs attention. Every line the client reviewed came back approved."
                  : "This BOQ has no line items."}
              </div>
            ) : (
              sections.map((section) => (
                <div className="sec-block" key={section.name}>
                  <div className="sec-head">
                    <span className="sec-name">{section.name}</span>
                    <span className="sec-count">
                      {section.items.length} item{section.items.length === 1 ? "" : "s"}
                    </span>
                    <span className="sec-total tabular">{fmt(sectionTotal(section))}</span>
                  </div>

                  <div className="compact-list">
                    {section.items.map((item, index) => {
                      const records = byItem.get(item.id) ?? [];
                      const entry = approvedSnapshot ? diff.byItem.get(item.id) : undefined;
                      const rejected = records.some((r) => r.status === "REJECTED");
                      const revision = records.some((r) => r.status === "REVISION_REQUESTED");
                      const tone = rejected
                        ? "review-rejected"
                        : revision
                          ? "review-revision"
                          : records.some((r) => r.comment.trim())
                            ? "review-noted"
                            : undefined;

                      return (
                        <InlineItemRow
                          key={item.id}
                          item={item}
                          draft={pendingEdits[item.id] ?? null}
                          index={index}
                          entries={rateEntries}
                          categories={categories}
                          showCost={showCost}
                          diffKind={entry?.kind ?? "unchanged"}
                          diffChanges={entry?.changes ?? []}
                          tone={tone}
                          annotation={
                            <div className="review-verdicts">
                              {records.length === 0 ? (
                                <span className="approval-pill pending">Not reviewed yet</span>
                              ) : (
                                records.map((record, i) => (
                                  <div className="review-verdict" key={`${record.contactName}-${i}`}>
                                    <span className={`approval-pill ${PILL_CLASS[record.status]}`}>
                                      {approvalLabel(record.status)}
                                    </span>
                                    <span className="rv-who">
                                      {record.contactName} · {fmtDate(record.at)}
                                    </span>
                                    {record.comment ? (
                                      <span className="rv-comment">“{record.comment}”</span>
                                    ) : null}
                                  </div>
                                ))
                              )}
                            </div>
                          }
                          onStartEdit={() => startEdit(item)}
                          onChange={(next) => changeEdit(item.id, next)}
                          onSave={() => saveRow(item.id)}
                          onDiscard={() => discardEdit(item.id)}
                          // No delete here on purpose: dropping a line the client
                          // has commented on is a scope decision, and it belongs
                          // on Build BOQ where the whole estimate is in view.
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {orphaned.length > 0 ? (
              <div className="settings-section" style={{ marginTop: 20 }}>
                <h3>
                  Reviewed lines no longer in the BOQ{" "}
                  <span className="note">— the client saw these, they&apos;ve since been removed</span>
                </h3>
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Verdict</th>
                      <th>Their note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphaned.map((record, i) => (
                      <tr key={`${record.lineItemId}-${i}`}>
                        <td>
                          <b>{record.lineItemName || "(untitled item)"}</b>
                        </td>
                        <td>
                          <span className={`approval-pill ${PILL_CLASS[record.status]}`}>
                            {approvalLabel(record.status)}
                          </span>{" "}
                          <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{record.contactName}</span>
                        </td>
                        <td>{record.comment || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>

      {editCount > 0 ? (
        <div className="edit-bar">
          <span className="edit-bar-count">
            {editCount} row{editCount === 1 ? "" : "s"} open for editing — not saved yet
          </span>
          <button
            className="btn light small"
            onClick={() => {
              cancelAllEdits();
              toast("Edits discarded");
            }}
          >
            Discard all
          </button>
          <button className="btn primary small" onClick={saveAll}>
            Save {editCount === 1 ? "row" : `all ${editCount} rows`}
          </button>
        </div>
      ) : null}

      <Toast message={message} />
    </>
  );
}
