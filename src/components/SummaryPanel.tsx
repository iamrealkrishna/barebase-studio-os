"use client";

import { computeTotals, fmt, fmtSigned, sectionTotal, type BoqMeta, type BoqSnapshot } from "@/lib/boq";

const GST_PRESETS = ["5", "12", "18", "28"];

export default function SummaryPanel({
  snapshot,
  activeSection,
  showCost,
  onMetaChange,
  footer,
}: {
  snapshot: BoqSnapshot;
  activeSection: string | null;
  showCost: boolean;
  onMetaChange: (changes: Partial<BoqMeta>) => void;
  footer?: React.ReactNode;
}) {
  const totals = computeTotals(snapshot);
  const custom = !GST_PRESETS.includes(String(snapshot.meta.gstRate));

  return (
    <div className="summary">
      <h3>Summary</h3>

      <div>
        {snapshot.sections
          .filter((section) => section.items.length > 0)
          .map((section) => {
            const isActive = section.name === activeSection;
            return (
              <div className="sum-row" key={section.name}>
                <span style={isActive ? { color: "var(--dark-paper)", fontWeight: 600 } : undefined}>
                  {section.name}
                </span>
                <span className="amt tabular" style={isActive ? { fontWeight: 600 } : undefined}>
                  {fmt(sectionTotal(section))}
                </span>
              </div>
            );
          })}
      </div>

      <div className="sum-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <span>Subtotal</span>
        <span className="amt tabular">{fmt(totals.subtotal)}</span>
      </div>

      <div className="discount-row">
        <span>Discount</span>
        <span style={{ display: "flex", gap: 5 }}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={snapshot.meta.discountValue || 0}
            onChange={(e) => onMetaChange({ discountValue: parseFloat(e.target.value) || 0 })}
          />
          <select
            value={snapshot.meta.discountType}
            onChange={(e) => onMetaChange({ discountType: e.target.value === "amt" ? "amt" : "pct" })}
          >
            <option value="pct">%</option>
            <option value="amt">₹</option>
          </select>
        </span>
      </div>

      {totals.discountAmount > 0 ? (
        <div className="sum-row subtle">
          <span>Discount applied</span>
          <span className="amt tabular">{fmtSigned(-totals.discountAmount)}</span>
        </div>
      ) : null}

      <div className="gst-toggle">
        <input
          type="checkbox"
          id="gstToggle"
          checked={snapshot.meta.gstOn}
          onChange={(e) => onMetaChange({ gstOn: e.target.checked })}
        />
        <label htmlFor="gstToggle">Add GST</label>
        <select
          style={{ marginLeft: 6 }}
          value={custom ? "custom" : String(snapshot.meta.gstRate)}
          onChange={(e) => {
            if (e.target.value === "custom") onMetaChange({ gstRate: snapshot.meta.gstRate });
            else onMetaChange({ gstRate: parseFloat(e.target.value) });
          }}
        >
          {GST_PRESETS.map((rate) => (
            <option key={rate} value={rate}>
              {rate}%
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {custom ? (
          <input
            type="number"
            min="0"
            step="0.1"
            style={{ width: 52, marginLeft: 6, textAlign: "right" }}
            value={snapshot.meta.gstRate}
            onChange={(e) => onMetaChange({ gstRate: parseFloat(e.target.value) || 0 })}
          />
        ) : null}
      </div>

      {totals.gstOn ? (
        <>
          <div className="sum-row subtle">
            <span>CGST @ {totals.gstRate / 2}%</span>
            <span className="amt tabular">{fmt(totals.cgst)}</span>
          </div>
          <div className="sum-row subtle">
            <span>SGST @ {totals.gstRate / 2}%</span>
            <span className="amt tabular">{fmt(totals.sgst)}</span>
          </div>
        </>
      ) : null}

      <div className="sum-row total">
        <span>Grand total</span>
        <span className="amt tabular">{fmt(totals.grand)}</span>
      </div>

      {showCost ? (
        <div className="cost-summary-block" style={{ display: "block" }}>
          <h4>Cost &amp; margin — internal</h4>
          <div className="sum-row subtle">
            <span>Internal cost</span>
            <span className="amt tabular">{fmt(totals.totalCost)}</span>
          </div>
          <div className="sum-row margin">
            <span>Margin</span>
            <span className="amt tabular">{fmt(totals.margin)}</span>
          </div>
          <div className="sum-row margin">
            <span>Margin %</span>
            <span className="amt tabular">{Math.round(totals.marginPct * 10) / 10}%</span>
          </div>
        </div>
      ) : null}

      {footer}
    </div>
  );
}
