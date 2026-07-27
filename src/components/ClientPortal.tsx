"use client";

import { useMemo, useState, useTransition } from "react";
import type { ApprovalStatus } from "@prisma/client";

import { approveWholeVersion, submitItemApproval } from "@/actions/approvals";
import ClientBoqView from "@/components/ClientBoqView";
import { PdfButton } from "@/components/PdfButtons";
import { Toast, useToast } from "@/components/Toast";
import { CLIENT_VISIBLE_FIELDS, countItems, diffSnapshots, type BoqItem, type BoqSnapshot } from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";

type ApprovalRecord = { lineItemId: string; status: ApprovalStatus; comment: string };

const BUTTONS: { status: ApprovalStatus; label: string; on: string }[] = [
  { status: "APPROVED", label: "Approve", on: "on-approve" },
  { status: "REVISION_REQUESTED", label: "Request change", on: "on-revision" },
  { status: "REJECTED", label: "Reject", on: "on-reject" },
];

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
  const approvedCount = Object.values(approvals).filter((record) => record.status === "APPROVED").length;
  const done = alreadyApproved || (total > 0 && approvedCount === total);

  const setStatus = (item: BoqItem, status: ApprovalStatus) => {
    const comment = (commentDraft[item.id] ?? approvals[item.id]?.comment ?? "").trim();
    startTransition(async () => {
      const result = await submitItemApproval({ token, versionId, lineItemId: item.id, status, comment });
      if (!result.ok) {
        toast(result.error ?? "Could not save that — please try again");
        return;
      }
      setApprovals((prev) => ({ ...prev, [item.id]: { lineItemId: item.id, status, comment } }));
      setOpenComment(null);
      toast(
        status === "APPROVED"
          ? "Approved"
          : status === "REJECTED"
            ? "Marked as rejected"
            : "Change requested — Barebase will be in touch",
      );
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
      toast("Thank you — the full estimate is approved");
    });
  };

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="mark">{letterhead.name.toUpperCase()}</span>
          <span className="sub">Estimate</span>
        </div>
        <div className="topbar-actions">
          <span style={{ fontSize: 11.5, color: "var(--dark-muted)" }}>
            {done ? "Approved" : `${approvedCount} of ${total} lines approved`}
          </span>
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
                : " Approve the whole estimate, or go line by line."}
            </span>
          </div>
        }
        renderItemActions={(item) => {
          const record = approvals[item.id];
          const status = record?.status ?? "PENDING";
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
                  className="cv-mini-btn"
                  disabled={pending}
                  onClick={() => setOpenComment(openComment === item.id ? null : item.id)}
                >
                  {record?.comment ? "Edit comment" : "Comment"}
                </button>
              </div>

              {openComment === item.id ? (
                <div className="cv-comment">
                  <input
                    autoFocus
                    placeholder="A question or note about this line…"
                    value={commentDraft[item.id] ?? record?.comment ?? ""}
                    onChange={(e) => setCommentDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setStatus(item, status === "PENDING" ? "REVISION_REQUESTED" : status);
                      }
                    }}
                  />
                  <button
                    className="btn light small"
                    disabled={pending}
                    onClick={() => setStatus(item, status === "PENDING" ? "REVISION_REQUESTED" : status)}
                  >
                    Send
                  </button>
                </div>
              ) : null}

              {record?.comment && openComment !== item.id ? (
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
              <button className="btn primary" disabled={pending} onClick={approveAll}>
                {pending ? "Saving…" : "Approve the whole estimate"}
              </button>
            )}
          </div>
        }
      />

      <Toast message={message} />
    </>
  );
}
