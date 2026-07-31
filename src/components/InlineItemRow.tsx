"use client";

import { useState } from "react";

import {
  categoryLabel,
  computeQty,
  CUSTOM_CATEGORY,
  dimsForUnit,
  dimSummary,
  fieldLabel,
  fmt,
  fmtPlain,
  setDimension,
  setTypedQty,
  type BoqItem,
  type FieldChange,
} from "@/lib/boq";
import { readAndCompressImage } from "@/lib/image";
import { descOptions, finishOptions, findRateRow, materialOptions, type RateEntry } from "@/lib/rate-card";

/**
 * A row in the compact list, which expands in place when edited.
 *
 * Editing happens here rather than in the entry form above so several rows can
 * be open at once and land in a single save. The full cascade is available —
 * changing Category re-drives Description, Material, Finish and the rate,
 * exactly as it does when adding a new item.
 */
export default function InlineItemRow({
  item,
  draft,
  index,
  entries,
  categories,
  showCost,
  diffKind,
  diffChanges,
  tone,
  annotation,
  onStartEdit,
  onChange,
  onSave,
  onDiscard,
  onRemove,
}: {
  item: BoqItem;
  /** Non-null while this row is being edited; the uncommitted copy. */
  draft: BoqItem | null;
  index: number;
  entries: RateEntry[];
  categories: string[];
  showCost: boolean;
  diffKind: "new" | "changed" | "unchanged";
  diffChanges: FieldChange[];
  /** Extra class on the row — the Client Review screen colours by verdict. */
  tone?: string;
  /**
   * Rendered with the row in both modes: the Client Review screen puts the
   * client's verdict and comment here, so it stays beside the item while the
   * team edits it.
   */
  annotation?: React.ReactNode;
  onStartEdit: () => void;
  onChange: (next: BoqItem) => void;
  /** Commit just this row. */
  onSave: () => void;
  onDiscard: () => void;
  /** Omitted where deleting doesn't belong — the Client Review screen. */
  onRemove?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const editing = draft !== null;
  const row = draft ?? item;
  const qty = computeQty(row);
  const amount = qty * (row.rate || 0);

  if (!editing) {
    const spec = [row.material, row.finish].filter(Boolean).join(" · ");
    const dimText = dimSummary(row);

    return (
      <div
        className={`compact-row${diffKind === "new" ? " is-new" : diffKind === "changed" ? " is-changed" : ""}${
          tone ? ` ${tone}` : ""
        }`}
      >
        <span className="cr-num">{String(index + 1).padStart(2, "0")}</span>
        <div className="cr-desc">
          <div className="main-line">
            {row.desc || "(untitled item)"}
            {row.image ? <span className="photo-chip">photo</span> : null}
            {diffKind === "new" ? <span className="co-flag">New since approval</span> : null}
            {diffKind === "changed" ? (
              <span
                className="co-flag"
                title={diffChanges.map((c) => `${fieldLabel(c.field)}: ${c.from || "—"} → ${c.to || "—"}`).join("\n")}
              >
                Change order
              </span>
            ) : null}
          </div>
          <div className="sub-line">
            {[categoryLabel(row.category), spec, dimText].filter(Boolean).join(" · ")}
            {row.note ? ` · note: ${row.note}` : ""}
          </div>
          {annotation}
        </div>
        <div className="cr-qty">
          {qty || 0} {row.unit} @ {fmtPlain(row.rate || 0)}
        </div>
        <div className="cr-amt">{fmt(amount)}</div>
        <div className="cr-actions">
          <button className="icon-btn" title="Edit this row" onClick={onStartEdit}>
            ✎
          </button>
          {onRemove ? (
            <button className="icon-btn danger" title="Remove" onClick={onRemove}>
              ✕
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- edit mode
  const patch = (changes: Partial<BoqItem>) => onChange({ ...row, ...changes });

  const applyRate = (next: BoqItem): BoqItem => {
    const match = findRateRow(entries, next.category, next.desc, next.material, next.finish);
    return match ? { ...next, rate: match.rate, cost: match.cost, unit: match.unit } : next;
  };

  const onCategoryChange = (category: string) => {
    if (category === CUSTOM_CATEGORY) {
      patch({ category, custom: true });
      return;
    }
    const descs = descOptions(entries, category);
    if (descs.length === 0) {
      patch({ category, custom: true });
      return;
    }
    const desc = descs[0];
    const material = materialOptions(entries, category, desc)[0] ?? "";
    const finish = finishOptions(entries, category, desc, material)[0] ?? "";
    onChange(applyRate({ ...row, category, custom: false, desc, material, finish }));
  };

  const onDescChange = (value: string) => {
    if (value === "custom") {
      patch({ custom: true });
      return;
    }
    const material = materialOptions(entries, row.category, value)[0] ?? "";
    const finish = finishOptions(entries, row.category, value, material)[0] ?? "";
    onChange(applyRate({ ...row, custom: false, desc: value, material, finish }));
  };

  const onMaterialChange = (material: string) => {
    const finish = finishOptions(entries, row.category, row.desc, material)[0] ?? "";
    onChange(applyRate({ ...row, material, finish }));
  };

  const isCustomCategory = row.category === CUSTOM_CATEGORY || row.custom;
  const dims = dimsForUnit(row.unit);
  const materials = materialOptions(entries, row.category, row.desc);
  const finishes = finishOptions(entries, row.category, row.desc, row.material);

  return (
    <div className={`compact-row editing-row${tone ? ` ${tone}` : ""}`}>
      <span className="cr-num">{String(index + 1).padStart(2, "0")}</span>

      <div className="inline-edit">
        {annotation ? <div className="inline-edit-annotation">{annotation}</div> : null}
        <div className="inline-edit-line">
          <div className="item-field grow2">
            <label>Category</label>
            <select value={row.category} onChange={(e) => onCategoryChange(e.target.value)}>
              <option value={CUSTOM_CATEGORY}>Other (custom item)</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="item-field grow2">
            <label>Description</label>
            {isCustomCategory ? (
              <input type="text" value={row.desc} placeholder="Item description" onChange={(e) => patch({ desc: e.target.value })} />
            ) : (
              <select value={row.custom ? "custom" : row.desc} onChange={(e) => onDescChange(e.target.value)}>
                <option value="custom">Custom item…</option>
                {descOptions(entries, row.category).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="item-field">
            <label>Material</label>
            {!isCustomCategory && (materials.length > 1 || (materials.length === 1 && materials[0])) ? (
              <select value={row.material} onChange={(e) => onMaterialChange(e.target.value)}>
                {materials.map((m) => (
                  <option key={m} value={m}>
                    {m || "—"}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={row.material} onChange={(e) => patch({ material: e.target.value })} />
            )}
          </div>

          <div className="item-field">
            <label>Finish</label>
            {!isCustomCategory && finishes.length > 0 ? (
              <select value={row.finish} onChange={(e) => onChange(applyRate({ ...row, finish: e.target.value }))}>
                {finishes.map((f) => (
                  <option key={f} value={f}>
                    {f || "—"}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={row.finish} onChange={(e) => patch({ finish: e.target.value })} />
            )}
          </div>

          <div className="item-field narrow">
            <label>Unit</label>
            {isCustomCategory ? (
              <input type="text" value={row.unit} onChange={(e) => patch({ unit: e.target.value })} />
            ) : (
              <span className="unit-badge">{row.unit || "—"}</span>
            )}
          </div>
        </div>

        <div className="inline-edit-line">
          {dims.includes("L") ? (
            <div className="item-field dim">
              <label>Length ft</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="num"
                value={row.dims.l}
                onChange={(e) => onChange(setDimension(row, "l", e.target.value))}
              />
            </div>
          ) : null}
          {dims.includes("B") ? (
            <div className="item-field dim">
              <label>Breadth ft</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="num"
                value={row.dims.b}
                onChange={(e) => onChange(setDimension(row, "b", e.target.value))}
              />
            </div>
          ) : null}
          {dims.includes("H") ? (
            <div className="item-field dim">
              <label>Height ft</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="num"
                value={row.dims.h}
                onChange={(e) => onChange(setDimension(row, "h", e.target.value))}
              />
            </div>
          ) : null}

          <div className="item-field dim" style={{ flex: "0 0 104px", minWidth: 104 }}>
            <label>
              Qty{row.unit ? ` (${row.unit})` : ""}
              {dims.length > 0 && row.qtyOverride ? <span className="qty-manual-flag">typed</span> : null}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`num${dims.length > 0 && !row.qtyOverride ? " qty-computed" : ""}`}
              value={row.qtyOverride || dims.length === 0 ? (row.qty || "") : qty || 0}
              title={
                dims.length > 0 && !row.qtyOverride
                  ? "Calculated from the dimensions — type here to override it"
                  : undefined
              }
              onChange={(e) => onChange(setTypedQty(row, e.target.value))}
            />
          </div>

          <div className="item-field dim" style={{ flex: "0 0 96px", minWidth: 96 }}>
            <label>Rate ₹</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="num"
              value={row.rate}
              onChange={(e) => patch({ rate: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {showCost ? (
            <div className="item-field dim" style={{ flex: "0 0 96px", minWidth: 96 }}>
              <label>Cost ₹</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="num"
                value={row.cost}
                onChange={(e) => patch({ cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
          ) : null}

          <div className="amount-block">
            <span className="amt-label">Amount</span>
            <span className="amt">{fmt(amount)}</span>
          </div>

          {/* Save sits on the row, next to what's being changed. The bar at the
              bottom of the screen commits every open row at once, but it's a
              long way from here when you're part-way down a long BOQ. */}
          <div className="inline-edit-actions">
            <button className="cv-mini-btn" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? "Hide scope & notes" : row.description || row.note || row.image ? "Scope & notes •" : "Scope & notes"}
            </button>
            <button className="cv-mini-btn" title="Discard this row's edits" onClick={onDiscard}>
              Cancel
            </button>
            <button className="btn primary small row-save" title="Save this row" onClick={onSave}>
              ✓ Save
            </button>
          </div>
        </div>

        {showDetails ? (
          <div className="inline-edit-details">
            <div className="item-field" style={{ flex: "1 1 100%" }}>
              <label>Scope of work — what the client reads</label>
              <textarea rows={2} value={row.description} onChange={(e) => patch({ description: e.target.value })} />
            </div>
            <div className="item-field" style={{ flex: "1 1 100%" }}>
              <label>Internal note — never shown to the client</label>
              <textarea rows={1} value={row.note} onChange={(e) => patch({ note: e.target.value })} />
            </div>
            <div className="img-cell">
              {row.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="img-thumb" src={row.image} alt="Reference" />
                  <button className="rm-btn" title="Remove image" onClick={() => patch({ image: null })}>
                    ✕
                  </button>
                </>
              ) : (
                <label className="img-add" title="Attach reference image">
                  ＋
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        patch({ image: await readAndCompressImage(file) });
                      } catch {
                        // Ignore — the row keeps whatever image it had.
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
