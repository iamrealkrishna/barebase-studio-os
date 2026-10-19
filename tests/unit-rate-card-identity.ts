/**
 * Unit checks for rate card item identity.
 *
 * These are the functions the Settings screen and `saveRateCard` both use to
 * decide what counts as the same item, so they're worth checking directly
 * rather than only through a browser. Run with:
 *
 *   npx tsx tests/unit-rate-card-identity.ts
 */
import {
  duplicateGroups,
  isNewValue,
  itemKey,
  newDuplicateGroups,
  type RateEntry,
} from "../src/lib/rate-card";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n       expected ${b}\n       got      ${a}`);
  }
}

function row(over: Partial<RateEntry> = {}): RateEntry {
  return {
    id: Math.random().toString(36).slice(2),
    category: "Wardrobes",
    name: "Sliding Wardrobe",
    material: "Plywood",
    finish: "Acrylic",
    unit: "SQFT",
    rate: 1850,
    cost: 1200,
    defaultScope: "",
    ...over,
  };
}

console.log("\nitemKey");
check("identical rows share a key", itemKey(row()) === itemKey(row()), true);
check(
  "case and surrounding space are ignored",
  itemKey(row({ material: " plywood " })) === itemKey(row({ material: "Plywood" })),
  true,
);
check(
  "a different finish is a different item",
  itemKey(row({ finish: "Laminate" })) === itemKey(row()),
  false,
);
check(
  "fields can't bleed into each other",
  itemKey(row({ name: "A B", material: "C" })) === itemKey(row({ name: "A", material: "B C" })),
  false,
);

console.log("\nduplicateGroups");
check("a clean card has none", duplicateGroups([row({ finish: "A" }), row({ finish: "B" })]).length, 0);
check("two identical rows are one group", duplicateGroups([row(), row()]).length, 1);
check(
  "the group reports both row positions",
  duplicateGroups([row({ finish: "X" }), row(), row()])[0].indexes,
  [1, 2],
);
check(
  "same price is still a duplicate, just not a conflicting one",
  duplicateGroups([row(), row()])[0].conflicting,
  false,
);
check(
  "a different rate under the same four columns conflicts",
  duplicateGroups([row({ rate: 1850 }), row({ rate: 1950 })])[0].conflicting,
  true,
);
check(
  "a different unit conflicts too",
  duplicateGroups([row({ unit: "SQFT" }), row({ unit: "RFT" })])[0].conflicting,
  true,
);
check(
  "a different cost conflicts too",
  duplicateGroups([row({ cost: 1 }), row({ cost: 2 })])[0].conflicting,
  true,
);
check(
  "a half-typed row is being written, not duplicated",
  duplicateGroups([row({ category: "", name: "" }), row({ category: "", name: "" })]).length,
  0,
);

console.log("\nnewDuplicateGroups — the save guard");
const stored = [row({ finish: "Acrylic", rate: 1850 }), row({ finish: "Acrylic", rate: 1950 })];
check("a clash already in the database doesn't block a save", newDuplicateGroups(stored, stored).length, 0);
check(
  "an unrelated edit alongside that clash still doesn't block",
  newDuplicateGroups([stored[0], { ...stored[1], cost: 99 }], stored).length,
  0,
);
check(
  "adding a third row to an existing clash does block",
  newDuplicateGroups([...stored, row({ finish: "Acrylic" })], stored).length,
  1,
);
check(
  "a brand-new clash blocks",
  newDuplicateGroups(
    [row({ finish: "Laminate" }), row({ finish: "Laminate" })],
    [row({ finish: "Laminate" })],
  ).length,
  1,
);
check(
  "a variant with a different finish is fine",
  newDuplicateGroups([row({ finish: "Laminate" }), row({ finish: "Veneer" })], []).length,
  0,
);
check(
  "a variant differing only by case is not fine",
  newDuplicateGroups([row({ finish: "Laminate" }), row({ finish: "laminate " })], []).length,
  1,
);

console.log("\nisNewValue — measured against the SAVED card");
const saved = [row({ material: "Plywood" }), row({ material: "MDF", finish: "Veneer" })];
check("a spelling the card already uses is not new", isNewValue(saved, (e) => e.material, "Plywood"), false);
check("different case is the same value", isNewValue(saved, (e) => e.material, "plywood"), false);
check("surrounding space is the same value", isNewValue(saved, (e) => e.material, " Plywood "), false);
check("a near miss is new", isNewValue(saved, (e) => e.material, "Plywod"), true);
check("an empty box is not an invention", isNewValue(saved, (e) => e.material, "  "), false);
// The two ways this was wrong before: comparing against the live rows found
// the row's own text and flagged nothing, and skipping that row flagged every
// value that appears only once — which is most of them.
check(
  "a value unique to one saved row is still not new",
  isNewValue(saved, (e) => e.finish, "Veneer"),
  false,
);

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
