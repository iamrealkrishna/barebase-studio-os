"use client";

import {
  computeQty,
  computeTotals,
  dimSummary,
  fmt,
  sectionTotal,
  type BoqItem,
  type BoqSnapshot,
  type SnapshotDiff,
} from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";

/**
 * The read-only, branded view a client sees — the Client PDF made interactive.
 *
 * Never renders cost, margin, internal notes or version history. Lines that
 * differ from the version this client last approved are highlighted, which is
 * the only thing they're told about revisions (BOQ_BUILDER_V2_SPEC §3).
 */
export default function ClientBoqView({
  snapshot,
  letterhead,
  diff,
  banner,
  renderItemActions,
  footer,
}: {
  snapshot: BoqSnapshot;
  letterhead: Letterhead;
  diff: SnapshotDiff | null;
  banner?: React.ReactNode;
  renderItemActions?: (item: BoqItem, sectionName: string) => React.ReactNode;
  footer?: React.ReactNode;
}) {
  const totals = computeTotals(snapshot);
  const cols = snapshot.meta.cols;
  const hasHighlights = Boolean(diff && (diff.added > 0 || diff.changed > 0));
  const contactLine = [letterhead.pocName ? `POC: ${letterhead.pocName}` : "", letterhead.pocPhone, letterhead.pocEmail]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="clientview-wrap">
      {banner}

      <div className="cv-header">
        <div className="co">{letterhead.name.toUpperCase()}</div>
        <div className="addr">
          {[letterhead.addressLine, contactLine].filter(Boolean).join(" · ")}
        </div>
        <div className="meta">
          <div>
            <span>Client</span>
            {snapshot.meta.client || "—"}
          </div>
          <div>
            <span>Property</span>
            {snapshot.meta.property || "—"}
          </div>
          <div>
            <span>Prepared by</span>
            {snapshot.meta.preparedBy || "—"}
          </div>
          <div>
            <span>Date</span>
            {snapshot.meta.date || "—"}
          </div>
        </div>
      </div>

      {hasHighlights ? (
        <div className="cv-legend">
          <span>
            <i className="new" />
            New since you last approved
          </span>
          <span>
            <i className="changed" />
            Changed since you last approved
          </span>
        </div>
      ) : null}

      <div>
        {snapshot.sections.filter((s) => s.items.length > 0).length === 0 ? (
          <div className="empty-sec">No items in this BOQ yet.</div>
        ) : (
          snapshot.sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div className="cv-section" key={section.name}>
                <div className="cv-section-head">
                  <span className="sec-name">{section.name}</span>
                  <span className="sec-amt">{fmt(sectionTotal(section))}</span>
                </div>

                {section.items.map((item) => {
                  const qty = computeQty(item);
                  const amount = qty * (item.rate || 0);
                  const kind = diff?.byItem.get(item.id)?.kind ?? "unchanged";

                  const spec: string[] = [];
                  if (cols.material && item.material) spec.push(item.material);
                  if (cols.finish && item.finish) spec.push(item.finish);
                  const dimText = dimSummary(item);
                  if (dimText) spec.push(dimText);
                  spec.push(cols.unit ? `${qty} ${item.unit}`.trim() : String(qty));
                  if (cols.rate) spec.push(`Rate ${fmt(item.rate || 0)}`);

                  return (
                    <div
                      className={`cv-row${kind === "new" ? " diff-new" : kind === "changed" ? " diff-changed" : ""}`}
                      key={item.id}
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="cv-item-img" src={item.image} alt={item.desc} />
                      ) : null}

                      <div className="cv-row-main">
                        <div className="d1">
                          {item.desc}
                          {kind === "new" ? <span className="cv-tag new">New</span> : null}
                          {kind === "changed" ? <span className="cv-tag changed">Changed</span> : null}
                        </div>
                        <div className="d2">{spec.join(" · ")}</div>
                        {item.description ? <div className="cv-scope">{item.description}</div> : null}
                        {renderItemActions?.(item, section.name)}
                      </div>

                      <div className="cv-amt">{fmt(amount)}</div>
                    </div>
                  );
                })}
              </div>
            ))
        )}
      </div>

      {diff && diff.removed.length > 0 ? (
        <div className="hint-text" style={{ marginBottom: 14 }}>
          {diff.removed.length} item{diff.removed.length === 1 ? "" : "s"} you previously approved{" "}
          {diff.removed.length === 1 ? "has" : "have"} been removed from this scope:{" "}
          {diff.removed.map((r) => r.item.desc).join(", ")}.
        </div>
      ) : null}

      <div className="cv-summary">
        <div className="row">
          <span>Subtotal</span>
          <span className="tabular">{fmt(totals.subtotal)}</span>
        </div>
        {totals.discountAmount > 0 ? (
          <div className="row">
            <span>Discount</span>
            <span className="tabular">−{fmt(totals.discountAmount)}</span>
          </div>
        ) : null}
        {totals.gstOn ? (
          <>
            <div className="row">
              <span>CGST @ {totals.gstRate / 2}%</span>
              <span className="tabular">{fmt(totals.cgst)}</span>
            </div>
            <div className="row">
              <span>SGST @ {totals.gstRate / 2}%</span>
              <span className="tabular">{fmt(totals.sgst)}</span>
            </div>
          </>
        ) : null}
        <div className="row total">
          <span>Grand total</span>
          <span className="tabular">{fmt(totals.grand)}</span>
        </div>
      </div>

      {snapshot.meta.terms ? <div className="cv-notes">{snapshot.meta.terms}</div> : null}

      {footer}
    </div>
  );
}
