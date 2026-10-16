"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { resetRateCard, saveRateCard } from "@/actions/rate-card";
import RateCardBulkEdit from "@/components/RateCardBulkEdit";
import { Toast, useToast } from "@/components/Toast";
import {
  categoryList,
  categorySuggestions,
  describeKey,
  descriptionSuggestions,
  duplicateIndexes,
  finishSuggestions,
  isNewValue,
  materialSuggestions,
  newDuplicateGroups,
  unitHint,
  unitOptions,
  type RateEntry,
} from "@/lib/rate-card";

const ALL = "__all__";
const DUPLICATES = "__duplicates__";
const CUSTOM_UNIT = "__custom_unit__";

/**
 * Whether two versions of the card are the same, field by field and in order.
 *
 * Order counts: a row's position in the array is the position it saves with.
 * Ids count too, so swapping a row for a new one reads as a change even when
 * every other field happens to match.
 */
function sameCard(a: RateEntry[], b: RateEntry[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    return (
      row.id === other.id &&
      row.category === other.category &&
      row.name === other.name &&
      row.material === other.material &&
      row.finish === other.finish &&
      row.unit === other.unit &&
      row.rate === other.rate &&
      row.cost === other.cost &&
      row.defaultScope === other.defaultScope
    );
  });
}

/**
 * A text box with the values already on the card offered beneath it.
 *
 * Typable, so a genuinely new material is just typed — the designers were
 * never blocked, they were unassisted. Offering what already exists is what
 * stops "Gypsum Board" acquiring a sibling called "Gypsom Board", which the
 * app would treat as a different material forever.
 *
 * A native datalist rather than a custom menu: it filters as you type, it
 * keeps the keyboard behaviour of a plain input, and there is nothing to get
 * out of step with the value.
 */
function ComboField({
  value,
  options,
  disabled,
  isNew,
  newLabel,
  onChange,
}: {
  value: string;
  options: string[];
  disabled: boolean;
  /** Typed something the card has never seen in this column. */
  isNew: boolean;
  newLabel: string;
  onChange: (value: string) => void;
}) {
  // One list per distinct set of options, shared by every row offering them.
  const listId = useMemo(() => `rc-${hashOptions(options)}`, [options]);

  return (
    <div className="combo-cell">
      <input
        value={value}
        list={disabled ? undefined : listId}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
      {!disabled ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
      {isNew ? (
        <span className="new-value-flag" title={`This ${newLabel} isn't on the rate card yet — check the spelling`}>
          new
        </span>
      ) : null}
    </div>
  );
}

/** Stable id for a set of options, so identical lists share one datalist. */
function hashOptions(options: string[]): string {
  let hash = 0;
  const joined = options.join("\u0000");
  for (let i = 0; i < joined.length; i++) {
    hash = (hash * 31 + joined.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export default function RateCardEditor({
  canEdit,
  canSeeCost,
  initialEntries,
  orgName,
}: {
  canEdit: boolean;
  /** Internal cost is admin-only — a member's entries arrive with cost zeroed. */
  canSeeCost: boolean;
  initialEntries: RateEntry[];
  orgName: string;
}) {
  const { message, toast } = useToast();
  const [entries, setEntries] = useState<RateEntry[]>(initialEntries);
  /**
   * The card as the server last sent it.
   *
   * "Unsaved changes" is this compared against what's on screen, rather than a
   * flag set by the act of typing. A latch can't tell an edit from an edit that
   * was undone: adding a row and deleting it again, or typing a character and
   * removing it, left the warning showing over a table identical to the
   * database — and the warning tells people not to upload a CSV, so a false one
   * blocks real work.
   */
  const [baseline, setBaseline] = useState<RateEntry[]>(initialEntries);
  const dirty = useMemo(() => !sameCard(entries, baseline), [entries, baseline]);
  const [pending, startTransition] = useTransition();

  // Read inside the effect below without making it re-run on every edit.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  /**
   * Set just after a save, so the payload that follows is taken wholesale: rows
   * added in this session go up with temporary ids and come back with real
   * ones, which would otherwise read as a difference and block the adoption.
   */
  const adoptNextPayload = useRef(false);

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
    setBaseline(initialEntries);
    if (adoptNextPayload.current || !dirtyRef.current) {
      setEntries(initialEntries);
      adoptNextPayload.current = false;
    }
  }, [initialEntries]);

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

  /** Rows sharing Category + Description + Material + Finish with another row. */
  const clashing = useMemo(() => duplicateIndexes(entries), [entries]);
  /**
   * Only the clashes this session is responsible for block a save. The stored
   * card already carries plenty, and holding someone's unrelated edit hostage
   * to those would just teach them to avoid the screen.
   */
  const blockingGroups = useMemo(() => newDuplicateGroups(entries, baseline), [entries, baseline]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) => {
        if (category === DUPLICATES) {
          if (!clashing.has(index)) return false;
        } else if (category !== ALL && entry.category !== category) {
          return false;
        }
        if (!needle) return true;
        return [entry.category, entry.name, entry.material, entry.finish, entry.unit].some((field) =>
          field.toLowerCase().includes(needle),
        );
      });
  }, [entries, category, search, clashing]);

  const patch = (index: number, changes: Partial<RateEntry>) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)));
  };

  const removeRow = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
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
        defaultScope: "",
      },
    ]);
  };

  /**
   * Copy a row and drop the copy directly beneath it.
   *
   * The common case is a variant: same category, description and material, a
   * different finish at a different price. Copying beats retyping three fields
   * that have to match exactly — retyping them is how the near-miss spellings
   * get in. The copy is a duplicate until its finish is changed, and the
   * warning says so, which is the nudge to change it.
   */
  const duplicateRow = (index: number) => {
    setEntries((prev) => {
      const copy = {
        ...prev[index],
        id: `new:${Math.random().toString(36).slice(2, 11)}`,
      };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };

  const save = () => {
    if (blockingGroups.length > 0) {
      const first = blockingGroups[0];
      toast(
        blockingGroups.length === 1
          ? `Two rows now share the same item: ${describeKey(first.entries[0])}. Change the finish, or delete one.`
          : `${blockingGroups.length} items now have more than one row — the first is ${describeKey(first.entries[0])}.`,
      );
      setCategory(DUPLICATES);
      setSearch("");
      return;
    }
    startTransition(async () => {
      const saved = entries;
      const result = await saveRateCard(saved);
      if (result.ok) {
        // Clears the warning immediately; the revalidated payload that follows
        // is then adopted, bringing real ids for any rows added here.
        setBaseline(saved);
        adoptNextPayload.current = true;
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
          {clashing.size > 0 ? (
            <option value={DUPLICATES}>⚠ Duplicates only ({clashing.size})</option>
          ) : null}
        </select>
        <input
          type="search"
          placeholder="Search category, description, material, finish…"
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

      {canEdit && blockingGroups.length > 0 ? (
        <div className="flash err">
          <b>
            {blockingGroups.length === 1
              ? "Two rows now describe the same item."
              : `${blockingGroups.length} items now have more than one row.`}
          </b>{" "}
          Category, Description, Material and Finish together are what identify an item, so a second row
          with all four the same can never be picked in a BOQ — the first one always wins, and its price is
          the only one anyone gets. Change the Finish (or Material) to tell them apart, or delete one.
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {blockingGroups.slice(0, 5).map((group) => (
              <li key={group.key}>
                {describeKey(group.entries[0])}
                {group.conflicting ? (
                  <>
                    {" "}
                    — priced{" "}
                    {group.entries
                      .map((row) => `₹${row.rate}/${row.unit.trim() || "—"}`)
                      .join(" and ")}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {blockingGroups.length > 5 ? (
            <div style={{ marginTop: 4 }}>…and {blockingGroups.length - 5} more.</div>
          ) : null}
        </div>
      ) : null}

      {canEdit && clashing.size > 0 && blockingGroups.length === 0 ? (
        <div className="hint-text" style={{ marginTop: 0 }}>
          ⚠ {clashing.size} rows already on the card share their Category + Description + Material + Finish
          with another row, so only the first of each is reachable when building a BOQ. They were there
          before this edit, so they don&apos;t block saving —{" "}
          <button
            className="link-button"
            onClick={() => {
              setCategory(DUPLICATES);
              setSearch("");
            }}
          >
            review them
          </button>{" "}
          when you get a chance.
        </div>
      ) : null}

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
              {canSeeCost ? <th style={{ width: "9%" }}>Cost ₹</th> : null}
              <th style={{ width: "13%" }}>Default scope note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ entry, index }) => (
              <tr key={entry.id} className={clashing.has(index) ? "dup-row" : undefined}>
                <td>
                  <ComboField
                    value={entry.category}
                    disabled={!canEdit}
                    options={categorySuggestions(entries)}
                    isNew={isNewValue(baseline, (e) => e.category, entry.category)}
                    newLabel="new category"
                    onChange={(value) => patch(index, { category: value })}
                  />
                </td>
                <td>
                  <ComboField
                    value={entry.name}
                    disabled={!canEdit}
                    options={descriptionSuggestions(entries, entry.category)}
                    isNew={isNewValue(baseline, (e) => e.name, entry.name)}
                    newLabel="new description"
                    onChange={(value) => patch(index, { name: value })}
                  />
                </td>
                <td>
                  <ComboField
                    value={entry.material}
                    disabled={!canEdit}
                    options={materialSuggestions(entries, entry.category, entry.name)}
                    isNew={isNewValue(baseline, (e) => e.material, entry.material)}
                    newLabel="new material"
                    onChange={(value) => patch(index, { material: value })}
                  />
                </td>
                <td>
                  <ComboField
                    value={entry.finish}
                    disabled={!canEdit}
                    options={finishSuggestions(entries, entry.category, entry.name, entry.material)}
                    isNew={isNewValue(baseline, (e) => e.finish, entry.finish)}
                    newLabel="new finish"
                    onChange={(value) => patch(index, { finish: value })}
                  />
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
                {canSeeCost ? (
                  <td>
                    <input
                      className="r-num"
                      type="number"
                      value={entry.cost}
                      disabled={!canEdit}
                      onChange={(e) => patch(index, { cost: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                ) : null}
                <td>
                  <textarea
                    className="scope-cell"
                    rows={1}
                    value={entry.defaultScope}
                    disabled={!canEdit}
                    placeholder="Boilerplate scope…"
                    title={entry.defaultScope || "Copied onto a BOQ line when this item is added"}
                    onChange={(e) => patch(index, { defaultScope: e.target.value })}
                  />
                </td>
                <td>
                  {canEdit ? (
                    <div className="row-actions">
                      <button
                        className="dup-btn"
                        title="Duplicate this row — for a variant with a different finish or price"
                        onClick={() => duplicateRow(index)}
                      >
                        ⧉
                      </button>
                      <button className="rm-btn" title="Delete" onClick={() => removeRow(index)}>
                        ✕
                      </button>
                    </div>
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
        <br />
        <b>Default scope note</b>{" "}
        is boilerplate copied into a BOQ line&apos;s Scope of work when someone adds this item, so common items
        don&apos;t get retyped. It stays editable on the line afterwards, and changing it here never rewrites scope
        text already saved on existing BOQs.
      </p>

      <Toast message={message} />
    </div>

    {canEdit ? <RateCardBulkEdit entries={entries} orgName={orgName} dirty={dirty} /> : null}
    </>
  );
}
