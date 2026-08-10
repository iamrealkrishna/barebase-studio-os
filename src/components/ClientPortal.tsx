"use client";

import { useMemo, useState, useTransition } from "react";
import type { ApprovalStatus } from "@prisma/client";

import {
  approveWholeVersion,
  submitClientReview,
  submitItemApproval,
  submitItemComment,
} from "@/actions/approvals";
import ClientBoqView from "@/components/ClientBoqView";
import { PdfButton } from "@/components/PdfButtons";
import { Toast, useToast } from "@/components/Toast";
import { CLIENT_VISIBLE_FIELDS, countItems, diffSnapshots, type BoqItem, type BoqSnapshot } from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";

type ApprovalRecord = { lineItemId: string; status: ApprovalStatus; comment: string; at?: string };

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

const SAVED_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Change requested",
  PENDING: "Note saved",
};

function clockTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientPortal({
  token,
  pass,
  versionId,
  contactName,
  snapshot,
  letterhead,
  baselineSnapshot,
  alreadyApproved,
  initialApprovals,
  initialSubmittedAt,
  onExpired,
}: {
  token: string;
  /** Device pass from the email check; every write carries it. */
  pass: string | null;
  versionId: string;
  contactName: string;
  snapshot: BoqSnapshot;
  letterhead: Letterhead;
  baselineSnapshot: BoqSnapshot | null;
  alreadyApproved: boolean;
  initialApprovals: ApprovalRecord[];
  /** Set if this contact has already pressed Done on a previous visit. */
  initialSubmittedAt: string | null;
  onExpired: () => void;
}) {
  const { message, toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>(() =>
    Object.fromEntries(initialApprovals.map((record) => [record.lineItemId, record])),
  );
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);
  /** Ids that just saved, so the tick reads as "that click landed". */
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(initialSubmittedAt);

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

  /** Session-expired is the one error worth sending back to the gate. */
  const handleFailure = (error: string | undefined) => {
    if (error && error.startsWith("Please confirm your email")) {
      toast(error);
      onExpired();
      return;
    }
    toast(error ?? "Could not save that — please try again");
  };

  const markSaved = (id: string, at: string) => {
    setJustSaved((prev) => ({ ...prev, [id]: true }));
    // The tick fades but the timestamp stays, so there's always a record on
    // screen that the click was actually saved.
    window.setTimeout(() => setJustSaved((prev) => ({ ...prev, [id]: false })), 4000);
    return at;
  };

  const setStatus = (item: BoqItem, status: ApprovalStatus) => {
    const comment = draftFor(item).trim();

    // Rejecting without saying why helps nobody — record the verdict, then ask.
    if (WANTS_REASON.includes(status) && !comment) setOpenComment(item.id);

    startTransition(async () => {
      const result = await submitItemApproval({ token, pass, versionId, lineItemId: item.id, status, comment });
      if (!result.ok) {
        handleFailure(result.error);
        return;
      }
      const at = new Date().toISOString();
      setApprovals((prev) => ({ ...prev, [item.id]: { lineItemId: item.id, status, comment, at } }));
      markSaved(item.id, at);
      if (!WANTS_REASON.includes(status) || comment) setOpenComment(null);
    });
  };

  /** Save a note without touching the verdict. */
  const saveComment = (item: BoqItem) => {
    const comment = draftFor(item).trim();
    startTransition(async () => {
      const result = await submitItemComment({ token, pass, versionId, lineItemId: item.id, comment });
      if (!result.ok) {
        handleFailure(result.error);
        return;
      }
      const at = new Date().toISOString();
      setApprovals((prev) => ({
        ...prev,
        [item.id]: {
          lineItemId: item.id,
          status: prev[item.id]?.status ?? result.status ?? "PENDING",
          comment,
          at,
        },
      }));
      markSaved(item.id, at);
      setOpenComment(null);
    });
  };

  const approveAll = () => {
    startTransition(async () => {
      const result = await approveWholeVersion({ token, pass, versionId });
      if (!result.ok) {
        handleFailure(result.error);
        return;
      }
      const at = new Date().toISOString();
      const all = Object.fromEntries(
        snapshot.sections.flatMap((section) =>
          section.items.map((item) => [
            item.id,
            {
              lineItemId: item.id,
              status: "APPROVED" as ApprovalStatus,
              comment: approvals[item.id]?.comment ?? "",
              at,
            },
          ]),
        ),
      );
      setApprovals(all);
      setOpenComment(null);
      setConfirmingAll(false);
      toast("Thank you — the full estimate is approved");
    });
  };

  const finishReview = () => {
    startTransition(async () => {
      const result = await submitClientReview({ token, pass });
      if (!result.ok) {
        handleFailure(result.error);
        return;
      }
      setSubmittedAt(new Date().toISOString());
      toast("Sent — Barebase knows you've finished");
    });
  };

  const headline = done
    ? "Approved"
    : flaggedCount > 0
      ? `${approvedCount} of ${total} approved · ${flaggedCount} flagged`
      : `${approvedCount} of ${total} lines approved`;

  /**
   * The one irreversible-feeling thing on this page: it overwrites every line,
   * including ones the client has deliberately rejected. So it's visually loud,
   * and it asks first — naming how many flags it would clear.
   */
  const approveBar = () => (
    <div className="cv-approve-block top">
      {done ? (
        <span className="cv-approved-stamp">✓ Approved — thank you. Barebase has been notified.</span>
      ) : confirmingAll ? (
        <div className="cv-confirm">
          <div className="cv-confirm-text">
            {flaggedCount > 0 ? (
              <>
                <b>
                  This will approve all {total} line{total === 1 ? "" : "s"} — including the {flaggedCount} you
                  flagged.
                </b>{" "}
                Your notes are kept, but {flaggedCount === 1 ? "that line" : "those lines"} will no longer be marked
                as needing changes.
              </>
            ) : (
              <>
                <b>
                  Approve all {total} line{total === 1 ? "" : "s"}?
                </b>{" "}
                Barebase will take this as your sign-off on the estimate.
              </>
            )}
          </div>
          <div className="cv-confirm-actions">
            <button className="btn light" disabled={pending} onClick={() => setConfirmingAll(false)}>
              Cancel
            </button>
            <button className="btn cv-approve-all" disabled={pending} onClick={approveAll}>
              {pending ? "Saving…" : `Yes, approve all ${total}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="btn cv-approve-all"
            disabled={pending}
            onClick={() => setConfirmingAll(true)}
          >
            ✓ Approve the whole estimate
          </button>
          <span className="cv-approve-hint">
            {flaggedCount > 0
              ? `You've flagged ${flaggedCount} line${flaggedCount === 1 ? "" : "s"} — approving everything would clear ${flaggedCount === 1 ? "that flag" : "those flags"}.`
              : "Or go line by line below — each click saves on its own."}
          </span>
        </>
      )}
    </div>
  );

  const respondedCount = records.filter((r) => r.status !== "PENDING" || r.comment.trim() !== "").length;
  const untouched = total - respondedCount;

  /**
   * The end of the client's journey.
   *
   * Nothing here is a save — every line saved when they clicked it, and the
   * summary says so rather than implying their work was sitting unsaved. What
   * the button adds is a definite finish: something to press that says "I'm
   * done", which is also the only way the team can tell a client who hasn't
   * started from one who is waiting on them.
   */
  const finishBlock = () => (
    <div className="cv-finish-block">
      {submittedAt ? (
        <div className="cv-finish-done">
          <span className="cv-finish-tick">✓</span>
          <div>
            <b>Thanks — your review is with Barebase.</b>
            <div className="cv-finish-sub">
              Sent {new Date(submittedAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . You can still change any line above; press Done again if you do.
            </div>
          </div>
          <button className="btn light small" disabled={pending} onClick={() => setSubmittedAt(null)}>
            Make more changes
          </button>
        </div>
      ) : (
        <>
          <div className="cv-finish-summary">
            <b>
              {done
                ? "Everything approved."
                : respondedCount === 0
                  ? "You haven't responded to any lines yet."
                  : `You've responded to ${respondedCount} of ${total} line${total === 1 ? "" : "s"}.`}
            </b>
            <span className="cv-finish-counts">
              {approvedCount > 0 ? <span className="ok">{approvedCount} approved</span> : null}
              {flaggedCount > 0 ? <span className="flag">{flaggedCount} flagged</span> : null}
              {untouched > 0 ? <span className="rest">{untouched} not answered</span> : null}
            </span>
            <span className="cv-finish-note">
              Every answer above is already saved. Press Done to let Barebase know you&apos;ve finished.
            </span>
          </div>
          <button
            className="btn cv-finish-btn"
            disabled={pending || respondedCount === 0}
            title={
              respondedCount === 0
                ? "Approve, reject or comment on at least one line first"
                : "Tell Barebase you've finished reviewing"
            }
            onClick={finishReview}
          >
            {pending ? "Sending…" : "Done — send my review"}
          </button>
        </>
      )}
    </div>
  );

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
        beforeContent={approveBar()}
        renderItemActions={(item) => {
          const record = approvals[item.id];
          const status = record?.status ?? "PENDING";
          const isOpen = openComment === item.id;
          const saved = justSaved[item.id];

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

                {/* Proof the click landed. The tick is momentary; the "saved at"
                    stays, so there's no doubt later either. */}
                {record?.at ? (
                  <span className={`cv-saved${saved ? " flash-in" : ""}`}>
                    <b>✓ {SAVED_LABEL[status] ?? "Saved"}</b>
                    <span className="cv-saved-at">saved at {clockTime(record.at)}</span>
                  </span>
                ) : null}
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
        footer={finishBlock()}
      />

      <Toast message={message} />
    </>
  );
}
