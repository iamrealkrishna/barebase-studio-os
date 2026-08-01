"use client";

import { useMemo, useState, useTransition } from "react";
import type { ApprovalStatus } from "@prisma/client";

import { approveWholeVersion, submitItemApproval, submitItemComment } from "@/actions/approvals";
import ClientBoqView from "@/components/ClientBoqView";
import { PdfButton } from "@/components/PdfButtons";
import { Toast, useToast } from "@/components/Toast";
import { CLIENT_VISIBLE_FIELDS, countItems, diffSnapshots, type BoqItem, type BoqSnapshot } from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";

type ApprovalRecord = { lineItemId: string; status: ApprovalStatus; comment: string };

const BUTTONS: { status: ApprovalStatus; label: string; on: string }[] = [
  { status: "APPROVED", label: "Approve", on: "on-approve" },
  { status: "REJECTED", label: "Reject", on: "on-reject" },
  { status: "REVISION_REQUESTED", label: "Request change", on: "on-revision" },
];

/** Statuses we ask for a reason on — the comment box opens by itself. */
const WANTS_REASON: ApprovalStatus[] = ["REJECTED", "REVISION_REQUESTED"];

const PROMPT: Record<string, string> = {
  REJECTED: "What's wrong with this one? Barebase will see your note.",
  REVISION_REQUESTED: "What would you like changed?",
  APPROVED: "Anything to flag on this one? It stays approved.",
  PENDING: "A question or note about this line…",
};

export default function ClientPortal({
  token,
  versionId,
  contactName,
  snapshot,
  letterhead,
  baselineSnapshot,
  alreadyApproved,
  initialApprovals,
}: {
  token: string;
  versionId: string;
  contactName: string;
  snapshot: BoqSnapshot;
  letterhead: Letterhead;
  baselineSnapshot: BoqSnapshot | null;
  alreadyApproved: boolean;
  initialApprovals: ApprovalRecord[];
}) {
  const { message, toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>(() =>
    Object.fromEntries(initialApprovals.map((record) => [record.lineItemId, record])),
  );
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);

  const diff = useMemo(
    () => diffSnapshots(snapshot, baselineSnapshot, CLIENT_VISIBLE_FIELDS),
    [snapshot, baselineSnapshot],
  );

  const total = countItems(snapshot);
  const records = Object.values(approvals);
  const approvedCount = records.filter((record) => record.status === "APPROVED").length;
  const flaggedCount = records.filter(
    (record) => record.status === "REJECTED" || record.status === "REVISION_REQUESTED",
  ).length;
  const done = flaggedCount === 0 && (alreadyApproved || (total > 0 && approvedCount === total));

  const draftFor = (item: BoqItem) => commentDraft[item.id] ?? approvals[item.id]?.comment ?? "";

  const setStatus = (item: BoqItem, status: ApprovalStatus) => {
    const comment = draftFor(item).trim();

    // Rejecting without saying why helps nobody — record the verdict, then ask.
    if (WANTS_REASON.includes(status) && !comment) {
      setApprovals((prev) => ({ ...prev, [item.id]: { lineItemId: item.id, status, comment: "" } }));
      setOpenComment(item.id);
    }

    startTransition(async () => {
      const result = await submitItemApproval({ token, versionId, lineItemId: item.id, status, comment });
      if (!result.ok) {
        toast(result.error ?? "Could not save that — please try again");
        return;
      }
      setApprovals((prev) => ({ ...prev, [item.id]: { lineItemId: item.id, status, comment } }));
      if (!WANTS_REASON.includes(status) || comment) setOpenComment(null);
      toast(
        status === "APPROVED"
          ? comment
            ? "Approved, with your note"
            : "Approved"
          : status === "REJECTED"
            ? "Marked as rejected — add a note so Barebase knows why"
            : "Change requested — Barebase will be in touch",
      );
    });
  };

  /** Save a note without touching the verdict. */
  const saveComment = (item: BoqItem) => {
    const comment = draftFor(item).trim();
    startTransition(async () => {
      const result = await submitItemComment({ token, versionId, lineItemId: item.id, comment });
      if (!result.ok) {
        toast(result.error ?? "Could not save that — please try again");
        return;
      }
      setApprovals((prev) => ({
        ...prev,
        [item.id]: {
          lineItemId: item.id,
          status: prev[item.id]?.status ?? result.status ?? "PENDING",
          comment,
        },
      }));
      setOpenComment(null);
      toast(comment ? "Note saved — Barebase will see it" : "Note removed");
    });
  };

  const approveAll = () => {
    startTransition(async () => {
      const result = await approveWholeVersion({ token, versionId });
      if (!result.ok) {
        toast(result.error ?? "Could not approve — please try again");
        return;
      }
      const all = Object.fromEntries(
        snapshot.sections.flatMap((section) =>
          section.items.map((item) => [
            item.id,
            { lineItemId: item.id, status: "APPROVED" as ApprovalStatus, comment: approvals[item.id]?.comment ?? "" },
          ]),
        ),
      );
      setApprovals(all);
      setOpenComment(null);
      toast("Thank you — the full estimate is approved");
    });
  };

  const headline = done
    ? "Approved"
    : flaggedCount > 0
      ? `${approvedCount} of ${total} approved · ${flaggedCount} flagged`
      : `${approvedCount} of ${total} lines approved`;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="mark">{letterhead.name.toUpperCase()}</span>
          <span className="sub">Estimate</span>
        </div>
        <div className="topbar-actions">
          <span style={{ fontSize: 11.5, color: "var(--dark-muted)" }}>{headline}</span>
          <PdfButton
            snapshot={snapshot}
            letterhead={letterhead}
            mode="client"
            label="Download PDF"
            onError={toast}
          />
        </div>
      </div>

      <ClientBoqView
        snapshot={snapshot}
        letterhead={letterhead}
        diff={baselineSnapshot ? diff : null}
        banner={
          <div className="cv-banner">
            <span>
              Hi {contactName} — here&apos;s your estimate for {snapshot.meta.property || "your project"}.
              {baselineSnapshot && (diff.added > 0 || diff.changed > 0)
                ? " Highlighted lines are new or changed since you last approved."
                : " Approve the whole estimate, or go line by line — you can leave a note on any item."}
            </span>
          </div>
        }
        renderItemActions={(item) => {
          const record = approvals[item.id];
          const status = record?.status ?? "PENDING";
          const isOpen = openComment === item.id;

          return (
            <>
              <div className="cv-row-actions">
                {BUTTONS.map((button) => (
                  <button
                    key={button.status}
                    className={`cv-mini-btn${status === button.status ? ` ${button.on}` : ""}`}
                    disabled={pending}
                    onClick={() => setStatus(item, button.status)}
                  >
                    {button.label}
                  </button>
                ))}
                <button
                  className={`cv-mini-btn${record?.comment ? " has-note" : ""}`}
                  disabled={pending}
                  onClick={() => setOpenComment(isOpen ? null : item.id)}
                >
                  {record?.comment ? "Edit note" : "Add a note"}
                </button>
              </div>

              {isOpen ? (
                <div className="cv-comment">
                  <input
                    autoFocus
                    placeholder={PROMPT[status] ?? PROMPT.PENDING}
                    value={draftFor(item)}
                    onChange={(e) => setCommentDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveComment(item);
                      }
                      if (e.key === "Escape") setOpenComment(null);
                    }}
                  />
                  {/* Saving a note never changes the verdict — a client can flag
                      something on a line they're happy to approve. */}
                  <button className="btn light small" disabled={pending} onClick={() => saveComment(item)}>
                    Save note
                  </button>
                </div>
              ) : null}

              {record?.comment && !isOpen ? (
                <div className="cv-comment-note">Your note: {record.comment}</div>
              ) : null}
            </>
          );
        }}
        footer={
          <div className="cv-approve-bar">
            {done ? (
              <span className="status-badge approved" style={{ padding: "9px 16px" }}>
                ✓ Approved — thank you. Barebase has been notified.
              </span>
            ) : (
              <>
                <button className="btn primary" disabled={pending} onClick={approveAll}>
                  {pending ? "Saving…" : "Approve the whole estimate"}
                </button>
                {flaggedCount > 0 ? (
                  <span className="cv-flagged-note">
                    You&apos;ve flagged {flaggedCount} line{flaggedCount === 1 ? "" : "s"} — Barebase can see{" "}
                    {flaggedCount === 1 ? "it" : "them"} and your notes. Approving everything here would clear{" "}
                    {flaggedCount === 1 ? "that flag" : "those flags"}.
                  </span>
                ) : null}
              </>
            )}
          </div>
        }
      />

      <Toast message={message} />
    </>
  );
}
