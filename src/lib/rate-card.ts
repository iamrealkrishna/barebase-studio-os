import { RATE_CATEGORIES } from "./default-rate-card";

export type RateEntry = {
  id: string;
  category: string;
  name: string;
  material: string;
  finish: string;
  unit: string;
  rate: number;
  cost: number;
  /** Boilerplate scope of work copied onto a BOQ line when this item is added. */
  defaultScope: string;
};

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Units offered in the rate card dropdown.
 *
 * The first three drive the entry form's dimension inputs (see `dimsForUnit`);
 * everything else takes a typed quantity. Anything already stored on an item is
 * merged in on top of this, and a Custom option lets a new one be typed — so
 * this list is a convenience, never a restriction.
 */
export const STANDARD_UNITS = ["SQFT", "RFT", "CFT", "Nos.", "Set", "Lumpsum", "Day", "Person", "Kg", "Litre"];

/** How a unit behaves, for the dropdown label. */
export function unitHint(unit: string): string {
  const u = unit.trim().toUpperCase();
  if (u === "SQFT") return "length × breadth";
  if (u === "RFT") return "single length";
  if (u === "CFT") return "length × breadth × height";
  return "typed quantity";
}

/** Standard units plus whatever the rate card already uses, in a stable order. */
export function unitOptions(entries: { unit: string }[]): string[] {
  const used = entries.map((e) => e.unit.trim()).filter(Boolean);
  return uniq([...STANDARD_UNITS, ...used.sort((a, b) => a.localeCompare(b))]);
}

/**
 * Categories in the order the team expects them, with any category they've
 * since added in Settings appended rather than dropped.
 */
export function categoryList(entries: RateEntry[]): string[] {
  const present = uniq(entries.map((e) => e.category));
  const known = RATE_CATEGORIES.filter((c) => present.includes(c));
  const extra = present.filter((c) => !RATE_CATEGORIES.includes(c)).sort();
  return [...known, ...extra];
}

// The cascade: Category -> Description -> Material -> Finish, each level
// narrowing the rate-card rows still in play.

export function descOptions(entries: RateEntry[], category: string): string[] {
  return uniq(entries.filter((e) => e.category === category).map((e) => e.name));
}

export function materialOptions(entries: RateEntry[], category: string, name: string): string[] {
  return uniq(entries.filter((e) => e.category === category && e.name === name).map((e) => e.material));
}

export function finishOptions(
  entries: RateEntry[],
  category: string,
  name: string,
  material: string,
): string[] {
  return uniq(
    entries
      .filter((e) => e.category === category && e.name === name && e.material === material)
      .map((e) => e.finish),
  );
}

/**
 * Best matching rate row, degrading gracefully: exact match first, then ignore
 * finish, then ignore material — so a partly-filled cascade still fills in a
 * rate rather than silently leaving zero.
 */
export function findRateRow(
  entries: RateEntry[],
  category: string,
  name: string,
  material: string,
  finish: string,
): RateEntry | undefined {
  return (
    entries.find(
      (e) => e.category === category && e.name === name && e.material === material && e.finish === finish,
    ) ??
    entries.find((e) => e.category === category && e.name === name && e.material === material) ??
    entries.find((e) => e.category === category && e.name === name)
  );
}

// --------------------------------------------------------------- suggestions

/**
 * What to offer in a field's dropdown, narrowed by the levels above it.
 *
 * The point is spelling, not restriction: these feed a text box someone can
 * always type past. The nearest existing wording is one click away, so
 * "Gypsum Board" doesn't quietly become a second material called "Gypsom
 * Board" — which is how one item turns into two that can never be told apart.
 *
 * Narrowed suggestions are better when there are any, but a brand-new category
 * would narrow to nothing and leave someone typing blind, so an empty result
 * falls back to every value the column uses.
 */
function scopedValues(
  entries: RateEntry[],
  pick: (entry: RateEntry) => string,
  within: (entry: RateEntry) => boolean,
): string[] {
  const narrowed = uniq(entries.filter(within).map(pick).filter(Boolean));
  if (narrowed.length > 0) return narrowed.sort((a, b) => a.localeCompare(b));
  return uniq(entries.map(pick).filter(Boolean)).sort((a, b) => a.localeCompare(b));
}

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function categorySuggestions(entries: RateEntry[]): string[] {
  return uniq(entries.map((e) => e.category).filter(Boolean)).sort((a, b) => a.localeCompare(b));
}

export function descriptionSuggestions(entries: RateEntry[], category: string): string[] {
  return scopedValues(entries, (e) => e.name, (e) => eq(e.category, category));
}

export function materialSuggestions(entries: RateEntry[], category: string, name: string): string[] {
  return scopedValues(entries, (e) => e.material, (e) => eq(e.category, category) && eq(e.name, name));
}

export function finishSuggestions(
  entries: RateEntry[],
  category: string,
  name: string,
  material: string,
): string[] {
  return scopedValues(
    entries,
    (e) => e.finish,
    (e) => eq(e.category, category) && eq(e.name, name) && eq(e.material, material),
  );
}

/**
 * Whether a typed value is one the saved rate card has never used.
 *
 * Compared against the stored card rather than the rows currently on screen.
 * Two earlier attempts got this wrong in opposite directions: comparing
 * against the live rows found the row's own text and called everything
 * familiar, and skipping that row called every value that happens to appear
 * only once "new" — which is most of them.
 *
 * Drives the "new" marker beside a field. Someone adding a genuinely new
 * finish should see that they are adding one; someone who has just mistyped an
 * existing one sees the same marker and looks twice.
 */
export function isNewValue(
  saved: RateEntry[],
  pick: (entry: RateEntry) => string,
  value: string,
): boolean {
  const typed = value.trim();
  if (!typed) return false;
  return !saved.some((entry) => eq(pick(entry), typed));
}

// ------------------------------------------------------------- item identity
/**
 * What makes two rate card rows the same item.
 *
 * Category + Description + Material + Finish — the four columns the cascade
 * narrows by, so two rows sharing them are indistinguishable once someone is
 * picking an item in a BOQ. Compared trimmed and case-folded, because "Ply"
 * and "ply " are the same material to everyone except a string comparison.
 *
 * The separator is a NUL rather than a space so "A B" + "C" can't collide with
 * "A" + "B C".
 */
export function itemKey(entry: {
  category: string;
  name: string;
  material: string;
  finish: string;
}): string {
  return [entry.category, entry.name, entry.material, entry.finish]
    .map((part) => part.trim().toLowerCase())
    .join("\u0000");
}

export type DuplicateGroup = {
  key: string;
  /** Positions in the array passed in, so the UI can point at the rows. */
  indexes: number[];
  entries: RateEntry[];
  /** True when the copies disagree about what to charge — the costly kind. */
  conflicting: boolean;
};

/**
 * Rows that share an identity, grouped.
 *
 * Duplicates matter beyond tidiness: `findRateRow` takes the first match, so
 * every copy after the first is unreachable from the BOQ cascade. A second
 * price sitting under the same four columns can never be quoted — it just
 * silently isn't the one you get.
 */
export function duplicateGroups(entries: RateEntry[]): DuplicateGroup[] {
  const byKey = new Map<string, number[]>();
  entries.forEach((entry, index) => {
    // A half-typed row isn't a duplicate yet — it's a row being written.
    if (!entry.category.trim() || !entry.name.trim()) return;
    const key = itemKey(entry);
    const list = byKey.get(key);
    if (list) list.push(index);
    else byKey.set(key, [index]);
  });

  const groups: DuplicateGroup[] = [];
  for (const [key, indexes] of byKey) {
    if (indexes.length < 2) continue;
    const rows = indexes.map((i) => entries[i]);
    const first = rows[0];
    groups.push({
      key,
      indexes,
      entries: rows,
      conflicting: rows.some(
        (row) => row.rate !== first.rate || row.cost !== first.cost || row.unit.trim() !== first.unit.trim(),
      ),
    });
  }
  return groups;
}

/** Every row index caught up in a duplicate, for highlighting. */
export function duplicateIndexes(entries: RateEntry[]): Set<number> {
  const out = new Set<number>();
  for (const group of duplicateGroups(entries)) for (const i of group.indexes) out.add(i);
  return out;
}

/**
 * Duplicates this edit is responsible for — a new clashing key, or an existing
 * clash that just got bigger.
 *
 * The card in the database already carries duplicates, so refusing to save
 * while any exist would lock the whole screen until someone cleaned up work
 * they didn't create. The rule that actually helps is narrower: you can't make
 * it worse. Pre-existing clashes stay visible and stay saveable.
 */
export function newDuplicateGroups(entries: RateEntry[], baseline: RateEntry[]): DuplicateGroup[] {
  const before = new Map(duplicateGroups(baseline).map((group) => [group.key, group.indexes.length]));
  return duplicateGroups(entries).filter((group) => group.indexes.length > (before.get(group.key) ?? 1));
}

/** A one-line description of a clash, for a message. */
export function describeKey(entry: {
  category: string;
  name: string;
  material: string;
  finish: string;
}): string {
  return [entry.category, entry.name, entry.material || "—", entry.finish || "—"]
    .map((part) => part.trim())
    .join(" · ");
}
