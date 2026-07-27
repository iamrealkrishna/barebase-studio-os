"use client";

import { useMemo, useState, useTransition } from "react";

import { resetRateCard, saveRateCard } from "@/actions/rate-card";
import { Toast, useToast } from "@/components/Toast";
import { categoryList, type RateEntry } from "@/lib/rate-card";

const ALL = "__all__";

export default function RateCardEditor({
  canEdit,
  initialEntries,
}: {
  canEdit: boolean;
  initialEntries: RateEntry[];
}) {
  const { message, toast } = useToast();
  const [entries, setEntries] = useState<RateEntry[]>(initialEntries);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => categoryList(entries), [entries]);
  // Default to the first category rather than all 250-odd rows — the whole card
  // at once is a lot of live inputs for a screen the team edits daily.
  const [category, setCategory] = useState<string>(categories[0] ?? ALL);
  const [search, setSearch] = useState("");

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
                  <input value={entry.unit} disabled={!canEdit} onChange={(e) => patch(index, { unit: e.target.value })} />
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
        breadth × height. Anything else (Nos., Lumpsum, Day, Person) takes a typed quantity.
      </p>

      <Toast message={message} />
    </div>
  );
}
