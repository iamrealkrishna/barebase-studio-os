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
