"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { resetRateCard, saveRateCard } from "@/actions/rate-card";
import RateCardBulkEdit from "@/components/RateCardBulkEdit";
import { Toast, useToast } from "@/components/Toast";
import { categoryList, unitHint, unitOptions, type RateEntry } from "@/lib/rate-card";

const ALL = "__all__";
const CUSTOM_UNIT = "__custom_unit__";

export default function RateCardEditor({
  canEdit,
  initialEntries,
  orgName,
}: {
  canEdit: boolean;
  initialEntries: RateEntry[];
  orgName: string;
}) {
  const { message, toast } = useToast();
  const [entries, setEntries] = useState<RateEntry[]>(initialEntries);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  /**
   * Adopt fresh server data — after a CSV import, say, which calls
   * router.refresh(). Without this the table kept its first render forever:
   * imported rows never appeared, and worse, "Save rate card" from that stale
   * list would have deleted them, since a save replaces the whole card with
   * whatever the client is holding. Unsaved edits always win over the refresh.
   */
  const lastServerEntries = useRef(initialEntries);
  useEffect(() => {
    if (initialEntries === lastServerEntries.current) return;
    lastServerEntries.current = initialEntries;
    if (!dirty) setEntries(initialEntries);
  }, [initialEntries, dirty]);

  const categories = useMemo(() => categoryList(entries), [entries]);
  // Default to the first category rather than all 250-odd rows — the whole card
  // at once is a lot of live inputs for a screen the team edits daily.
  const [category, setCategory] = useState<string>(categories[0] ?? ALL);
  const [search, setSearch] = useState("");
  /** Row currently typing a unit that isn't in the list yet. */
  const [customUnitRow, setCustomUnitRow] = useState<number | null>(null);

  // Recomputed from the live entries, so a unit typed on one row is offered on
  // every other row straight away.
  const units = useMemo(() => unitOptions(entries), [entries]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (category !== ALL && entry.category !== category) return false;
        if (!needle) return true;
        return [entry.name, entry.material, entry.finish, entry.unit].some((field) =>
          field.toLowerCase().includes(needle),
        );
      });
  }, [entries, category, search]);

  const patch = (index: number, changes: Partial<RateEntry>) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)));
    setDirty(true);
  };

  const removeRow = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const addRow = () => {
    const target = category === ALL ? categories[0] ?? "Other" : category;
    setEntries((prev) => [
      ...prev,
      {
        id: `new:${Math.random().toString(36).slice(2, 11)}`,
        category: target,
        name: "New item",
        material: "",
        finish: "",
        unit: "SQFT",
        rate: 0,
        cost: 0,
      },
    ]);
    setDirty(true);
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveRateCard(entries);
      if (result.ok) {
        setDirty(false);
        toast("Rate card saved for the whole team");
      } else {
        toast(result.error ?? "Could not save the rate card");
      }
    });
  };

  const reset = () => {
    if (!window.confirm("Reset the rate card to Barebase defaults? This discards any custom rates.")) return;
    startTransition(async () => {
      const result = await resetRateCard();
      if (result.ok) {
        toast("Rate card reset — reload to see the defaults");
        window.location.reload();
      } else {
        toast(result.error ?? "Could not reset the rate card");
      }
    });
  };

  return (
    <>
    <div className="settings-section">
      <h3>
        Rate card{" "}
        <span className="note">
          — {entries.length} items, shared with the whole team
          {dirty ? " · unsaved changes" : ""}
        </span>
      </h3>

      <div className="cat-filter">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value={ALL}>All categories ({entries.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c} ({entries.filter((e) => e.category === c).length})
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search description, material, finish…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canEdit ? (
          <>
            <button className="btn light small" onClick={addRow} disabled={pending}>
              + Add rate item
            </button>
            <button className="btn primary small" onClick={save} disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save rate card"}
            </button>
            <button className="btn danger-outline small" onClick={reset} disabled={pending}>
              Reset to defaults
            </button>
          </>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="mini-empty">Nothing matches that filter.</div>
      ) : (
        <table className="ratecard">
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Category</th>
              <th style={{ width: "22%" }}>Description</th>
              <th style={{ width: "19%" }}>Material</th>
              <th style={{ width: "19%" }}>Finish</th>
              <th style={{ width: "8%" }}>Unit</th>
              <th style={{ width: "9%" }}>Rate ₹</th>
              <th style={{ width: "9%" }}>Cost ₹</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ entry, index }) => (
              <tr key={entry.id}>
                <td>
                  <input value={entry.category} disabled={!canEdit} onChange={(e) => patch(index, { category: e.target.value })} />
                </td>
                <td>
                  <input value={entry.name} disabled={!canEdit} onChange={(e) => patch(index, { name: e.target.value })} />
                </td>
                <td>
                  <input value={entry.material} disabled={!canEdit} onChange={(e) => patch(index, { material: e.target.value })} />
                </td>
                <td>
                  <input value={entry.finish} disabled={!canEdit} onChange={(e) => patch(index, { finish: e.target.value })} />
                </td>
                <td>
                  {customUnitRow === index ? (
                    <input
                      autoFocus
                      value={entry.unit}
                      placeholder="e.g. Sqm"
                      disabled={!canEdit}
                      onChange={(e) => patch(index, { unit: e.target.value })}
                      onBlur={() => setCustomUnitRow(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          e.preventDefault();
                          setCustomUnitRow(null);
                        }
                      }}
                    />
                  ) : (
                    <select
                      value={entry.unit}
                      disabled={!canEdit}
                      onChange={(e) => {
                        if (e.target.value === CUSTOM_UNIT) {
                          // Clear it so the field opens empty and ready to type.
                          patch(index, { unit: "" });
                          setCustomUnitRow(index);
                          return;
                        }
                        patch(index, { unit: e.target.value });
                      }}
                    >
                      {entry.unit.trim() === "" ? <option value="">—</option> : null}
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u} — {unitHint(u)}
                        </option>
                      ))}
                      <option value={CUSTOM_UNIT}>Custom unit…</option>
                    </select>
                  )}
                </td>
                <td>
                  <input
                    className="r-num"
                    type="number"
                    value={entry.rate}
                    disabled={!canEdit}
                    onChange={(e) => patch(index, { rate: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    className="r-num"
                    type="number"
                    value={entry.cost}
                    disabled={!canEdit}
                    onChange={(e) => patch(index, { cost: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  {canEdit ? (
                    <button className="rm-btn" title="Delete" onClick={() => removeRow(index)}>
                      ✕
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="hint-text">
        Unit drives the entry form: SQFT asks for length × breadth, RFT for a single length, CFT for length ×
        breadth × height. Everything else takes a typed quantity. Pick <b>Custom unit…</b>{" "}
        to add one that isn&apos;t listed — it then shows up in the dropdown on every other row.
      </p>

      <Toast message={message} />
    </div>

    {canEdit ? <RateCardBulkEdit entries={entries} orgName={orgName} dirty={dirty} /> : null}
    </>
  );
}
