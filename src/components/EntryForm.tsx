"use client";

import { useRef } from "react";

import { computeQty, dimsForUnit, fmt, type BoqItem } from "@/lib/boq";
import { readAndCompressImage } from "@/lib/image";
import {
  descOptions,
  finishOptions,
  findRateRow,
  materialOptions,
  type RateEntry,
} from "@/lib/rate-card";

export const CUSTOM_CATEGORY = "__custom__";

/**
 * Build a blank draft sitting on the first rate-card row, so the form opens
 * already usable rather than on an empty cascade.
 */
export function freshDraft(entries: RateEntry[], categories: string[]): BoqItem {
  const category = categories[0] ?? CUSTOM_CATEGORY;
  const first = entries.find((e) => e.category === category);
  return {
    id: `new:${Math.random().toString(36).slice(2, 11)}`,
    category,
    custom: !first,
    desc: first?.name ?? "",
    material: first?.material ?? "",
    finish: first?.finish ?? "",
    rate: first?.rate ?? 0,
    cost: first?.cost ?? 0,
    unit: first?.unit ?? "",
    dims: { l: "", b: "", h: "" },
    qty: 0,
    description: "",
    note: "",
    image: null,
  };
}

type Props = {
  draft: BoqItem;
  onChange: (next: BoqItem) => void;
  onConfirm: () => void;
  onCancel: () => void;
  sectionName: string;
  entries: RateEntry[];
  categories: string[];
  showCost: boolean;
  onError: (message: string) => void;
};

export default function EntryForm({
  draft,
  onChange,
  onConfirm,
  onCancel,
  sectionName,
  entries,
  categories,
  showCost,
  onError,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const isCustomCategory = draft.category === CUSTOM_CATEGORY;
  const dims = dimsForUnit(draft.unit);
  const qty = computeQty(draft);
  const amount = qty * (draft.rate || 0);
  const margin = amount - qty * (draft.cost || 0);

  const patch = (changes: Partial<BoqItem>) => onChange({ ...draft, ...changes });

  /** Re-fill rate / cost / unit from the rate card for the current cascade. */
  const applyRate = (next: BoqItem): BoqItem => {
    const row = findRateRow(entries, next.category, next.desc, next.material, next.finish);
    if (!row) return next;
    return { ...next, rate: row.rate, cost: row.cost, unit: row.unit };
  };

  const onCategoryChange = (category: string) => {
    if (category === CUSTOM_CATEGORY) {
      patch({ category, custom: true, desc: "", material: "", finish: "", rate: 0, cost: 0, unit: "" });
      return;
    }
    const descs = descOptions(entries, category);
    if (descs.length === 0) {
      patch({ category, custom: true, desc: "", material: "", finish: "", rate: 0, cost: 0, unit: "" });
      return;
    }
    const desc = descs[0];
    const material = materialOptions(entries, category, desc)[0] ?? "";
    const finish = finishOptions(entries, category, desc, material)[0] ?? "";
    onChange(applyRate({ ...draft, category, custom: false, desc, material, finish }));
  };

  const onDescChange = (value: string) => {
    if (value === "custom") {
      patch({ custom: true, desc: "", material: "", finish: "", rate: 0, cost: 0, unit: "" });
      return;
    }
    const material = materialOptions(entries, draft.category, value)[0] ?? "";
    const finish = finishOptions(entries, draft.category, value, material)[0] ?? "";
    onChange(applyRate({ ...draft, custom: false, desc: value, material, finish }));
  };

  const onMaterialChange = (material: string) => {
    const finish = finishOptions(entries, draft.category, draft.desc, material)[0] ?? "";
    onChange(applyRate({ ...draft, material, finish }));
  };

  const onFinishChange = (finish: string) => {
    onChange(applyRate({ ...draft, finish }));
  };

  const onImagePicked = async (file: File | undefined) => {
    if (!file) return;
    try {
      patch({ image: await readAndCompressImage(file) });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not attach that image.");
    }
  };

  // Enter in any field commits the item — the workflow the team is used to.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
    }
  };

  const categoryOptions = (
    <>
      <option value={CUSTOM_CATEGORY}>Other (custom item)</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );

  let descCell: React.ReactNode;
  let materialCell: React.ReactNode;
  let finishCell: React.ReactNode;
  let unitCell: React.ReactNode;

  if (isCustomCategory) {
    descCell = (
      <input
        type="text"
        value={draft.desc}
        placeholder="Item description"
        onChange={(e) => patch({ desc: e.target.value })}
        onKeyDown={onKeyDown}
      />
    );
    materialCell = (
      <input
        type="text"
        value={draft.material}
        placeholder="Material"
        onChange={(e) => patch({ material: e.target.value })}
        onKeyDown={onKeyDown}
      />
    );
    finishCell = (
      <input
        type="text"
        value={draft.finish}
        placeholder="Finish"
        onChange={(e) => patch({ finish: e.target.value })}
        onKeyDown={onKeyDown}
      />
    );
    unitCell = (
      <input
        type="text"
        value={draft.unit}
        placeholder="Unit"
        onChange={(e) => patch({ unit: e.target.value })}
        onKeyDown={onKeyDown}
      />
    );
  } else {
    const descs = descOptions(entries, draft.category);
    descCell = (
      <select value={draft.custom ? "custom" : draft.desc} onChange={(e) => onDescChange(e.target.value)} onKeyDown={onKeyDown}>
        <option value="custom">Custom item…</option>
        {descs.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    );

    if (draft.custom) {
      materialCell = (
        <input type="text" value={draft.material} onChange={(e) => patch({ material: e.target.value })} onKeyDown={onKeyDown} />
      );
      finishCell = (
        <input type="text" value={draft.finish} onChange={(e) => patch({ finish: e.target.value })} onKeyDown={onKeyDown} />
      );
      unitCell = (
        <input type="text" value={draft.unit} placeholder="Unit" onChange={(e) => patch({ unit: e.target.value })} onKeyDown={onKeyDown} />
      );
    } else {
      const materials = materialOptions(entries, draft.category, draft.desc);
      materialCell =
        materials.length > 1 || (materials.length === 1 && materials[0]) ? (
          <select value={draft.material} onChange={(e) => onMaterialChange(e.target.value)} onKeyDown={onKeyDown}>
            {materials.map((m) => (
              <option key={m} value={m}>
                {m || "—"}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ color: "var(--muted)", padding: "7px 0", display: "block" }}>—</span>
        );

      const finishes = finishOptions(entries, draft.category, draft.desc, draft.material);
      finishCell = finishes.length ? (
        <select value={draft.finish} onChange={(e) => onFinishChange(e.target.value)} onKeyDown={onKeyDown}>
          {finishes.map((f) => (
            <option key={f} value={f}>
              {f || "—"}
            </option>
          ))}
        </select>
      ) : (
        <input type="text" value={draft.finish} onChange={(e) => patch({ finish: e.target.value })} onKeyDown={onKeyDown} />
      );

      unitCell = <span className="unit-badge">{draft.unit || "—"}</span>;
    }
  }

  return (
    <div className="entry-form">
      <div className="entry-form-label">New item — {sectionName}</div>

      <div className="item-row">
        <div className="item-field grow2">
          <label>Category</label>
          <select value={draft.category} onChange={(e) => onCategoryChange(e.target.value)} onKeyDown={onKeyDown}>
            {categoryOptions}
          </select>
        </div>
        <div className="item-field grow2">
          <label>Description</label>
          {descCell}
        </div>
        <div className="item-field">
          <label>Material</label>
          {materialCell}
        </div>
        <div className="item-field">
          <label>Finish</label>
          {finishCell}
        </div>
        <div className="item-field narrow">
          <label>Unit</label>
          {unitCell}
        </div>
      </div>

      <div className="item-row">
        {dims.includes("L") ? (
          <div className="item-field dim">
            <label>Length ft</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="num"
              value={draft.dims.l}
              placeholder="0"
              onChange={(e) => patch({ dims: { ...draft.dims, l: e.target.value } })}
              onKeyDown={onKeyDown}
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
              value={draft.dims.b}
              placeholder="0"
              onChange={(e) => patch({ dims: { ...draft.dims, b: e.target.value } })}
              onKeyDown={onKeyDown}
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
              value={draft.dims.h}
              placeholder="0"
              onChange={(e) => patch({ dims: { ...draft.dims, h: e.target.value } })}
              onKeyDown={onKeyDown}
            />
          </div>
        ) : null}

        <div className="item-field dim" style={{ flex: "0 0 92px", minWidth: 92 }}>
          <label>Qty{draft.unit ? ` (${draft.unit})` : ""}</label>
          {dims.length > 0 ? (
            <input type="text" className="num qty-computed" value={qty || 0} readOnly tabIndex={-1} />
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              className="num"
              value={draft.qty || ""}
              placeholder="0"
              onChange={(e) => patch({ qty: parseFloat(e.target.value) || 0 })}
              onKeyDown={onKeyDown}
            />
          )}
        </div>

        <div className="item-field dim" style={{ flex: "0 0 96px", minWidth: 96 }}>
          <label>Rate ₹</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="num"
            value={draft.rate}
            onChange={(e) => patch({ rate: parseFloat(e.target.value) || 0 })}
            onKeyDown={onKeyDown}
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
              value={draft.cost}
              onChange={(e) => patch({ cost: parseFloat(e.target.value) || 0 })}
              onKeyDown={onKeyDown}
            />
          </div>
        ) : null}

        <div className="amount-block">
          <span className="amt-label">Amount</span>
          <span className="amt">{fmt(amount)}</span>
          {showCost ? <span className="margin">margin {fmt(margin)}</span> : null}
        </div>
      </div>

      <div className="item-row item-desc-row">
        <textarea
          rows={2}
          value={draft.description}
          placeholder="Scope of work — what the client reads for this item…"
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      <div className="item-row item-note-row">
        <textarea
          rows={1}
          value={draft.note}
          placeholder="Internal note — never shown to the client (e.g. “changed on site”)"
          onChange={(e) => patch({ note: e.target.value })}
        />
      </div>

      <div className="item-foot">
        <div className="img-cell">
          {draft.image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="img-thumb"
                src={draft.image}
                alt="Reference"
                title="Click to view full size"
                onClick={() => {
                  const w = window.open("");
                  if (w) {
                    const img = w.document.createElement("img");
                    img.src = draft.image as string;
                    img.style.maxWidth = "100%";
                    w.document.body.appendChild(img);
                  }
                }}
              />
              <button className="rm-btn" title="Remove image" onClick={() => patch({ image: null })}>
                ✕
              </button>
            </>
          ) : (
            <label className="img-add" title="Attach reference image">
              ＋
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  void onImagePicked(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="entry-form-buttons">
          <span className="hint-text" style={{ marginTop: 0 }}>
            Enter in any field adds the item
          </span>
          <button className="btn light small" onClick={onCancel}>
            Close
          </button>
          <button className="btn primary small" style={{ padding: "8px 18px" }} onClick={onConfirm}>
            Add item ↵
          </button>
        </div>
      </div>
    </div>
  );
}
