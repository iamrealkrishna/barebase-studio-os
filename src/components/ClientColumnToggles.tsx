"use client";

import type { BoqMeta } from "@/lib/boq";

export type ClientCols = BoqMeta["cols"];

export const CLIENT_COLUMN_LABELS: [keyof ClientCols, string][] = [
  ["material", "Material"],
  ["finish", "Finish"],
  ["qty", "Qty"],
  ["rate", "Rate per unit"],
];

/**
 * Which per-line details the client is allowed to see.
 *
 * Rendered both in the builder's Summary panel and on the Client View page, so
 * the setting can be changed from wherever you happen to notice it — the two
 * write to the same per-project fields.
 */
export default function ClientColumnToggles({
  cols,
  onChange,
  variant = "dark",
  disabled = false,
}: {
  cols: ClientCols;
  onChange: (next: ClientCols) => void;
  variant?: "dark" | "light";
  disabled?: boolean;
}) {
  return (
    <div className={variant === "light" ? "col-toggles-light" : undefined}>
      {CLIENT_COLUMN_LABELS.map(([key, label]) => (
        <label className="col-toggle-row" key={key}>
          <input
            type="checkbox"
            checked={cols[key]}
            disabled={disabled}
            onChange={(e) => onChange({ ...cols, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
