"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { BULK_TX, prisma } from "@/lib/db";
import { matchKey, parseMoney, type RawCsvRow } from "@/lib/rate-card-csv";

export type FieldDelta = {
  field: "category" | "name" | "material" | "finish" | "unit" | "rate" | "cost" | "defaultScope";
  from: string;
  to: string;
};

export type PlannedUpdate = {
  line: number;
  itemId: string;
  category: string;
  name: string;
  material: string;
  finish: string;
  changes: FieldDelta[];
  /** What the DB held when the preview was built — re-checked before writing. */
  expected: { rate: number; cost: number; unit: string; category: string; name: string; material: string; finish: string; defaultScope: string };
  next: { rate: number; cost: number; unit: string; category: string; name: string; material: string; finish: string; defaultScope: string };
};

export type PlannedInsert = {
  line: number;
  category: string;
  name: string;
  material: string;
  finish: string;
  unit: string;
  rate: number;
  cost: number;
  defaultScope: string;
  /** Why this is being added when it wasn't obviously new. Shown in the preview. */
  note?: string;
};

export type RejectedRow = {
  line: number;
  label: string;
  reason: string;
};

export type ImportPlan = {
  updates: PlannedUpdate[];
  inserts: PlannedInsert[];
  rejected: RejectedRow[];
  unchanged: number;
  totalRows: number;
};

function label(row: { category: string; name: string; material: string; finish: string }): string {
  return [row.category, row.name, row.material, row.finish].filter(Boolean).join(" · ") || "(blank row)";
}

/**
 * Work out what an uploaded file would do, without touching anything.
 *
 * Rows are matched by Item ID when the file still carries the one we exported,
 * and by Category + Description + Material + Finish otherwise. The key alone
 * isn't reliable: the seeded rate card has 25 keys covering 53 rows (five
 * different "Accessories · Brand - EBCO/HETTICH" products, Loft at two heights,
 * and so on). Where a key hits more than one item there is no honest way to
 * choose, so the row is rejected and named rather than silently applied to
 * whichever came first.
 */
export async function previewRateCardImport(rows: RawCsvRow[]): Promise<ImportPlan> {
  const user = await requireAdmin();

  const existing = await prisma.rateItem.findMany({
    where: { orgId: user.orgId },
    orderBy: { position: "asc" },
  });

  const byId = new Map(existing.map((item) => [item.id, item]));
  const byKey = new Map<string, typeof existing>();
  for (const item of existing) {
    const key = matchKey({ category: item.category, name: item.name, material: item.material, finish: item.finish });
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }

  const updates: PlannedUpdate[] = [];
  const inserts: PlannedInsert[] = [];
  const rejected: RejectedRow[] = [];
  let unchanged = 0;

  // Guards against one file trying to touch the same item twice.
  const seenKeys = new Map<string, number>();
  const claimedIds = new Map<string, number>();
  /** Match key of the row that claimed each Item ID, to spot copy-pasted rows. */
  const claimedKeys = new Map<string, string>();

  for (const row of rows) {
    const rowLabel = label(row);

    if (!row.category || !row.name) {
      rejected.push({
        line: row.line,
        label: rowLabel,
        reason: !row.category && !row.name ? "Category and Description are both blank" : !row.category ? "Category is blank" : "Description is blank",
      });
      continue;
    }

    const rate = parseMoney(row.rate);
    if (rate === null) {
      rejected.push({
        line: row.line,
        label: rowLabel,
        reason: row.rate.trim() === "" ? "Rate is blank" : `Rate "${row.rate}" isn't a number`,
      });
      continue;
    }
    if (rate < 0) {
      rejected.push({ line: row.line, label: rowLabel, reason: `Rate ${rate} is negative` });
      continue;
    }

    // Cost is optional — a blank cell means zero, but a typo shouldn't pass.
    let cost = 0;
    if (row.cost.trim() !== "") {
      const parsed = parseMoney(row.cost);
      if (parsed === null) {
        rejected.push({ line: row.line, label: rowLabel, reason: `Cost "${row.cost}" isn't a number` });
        continue;
      }
      if (parsed < 0) {
        rejected.push({ line: row.line, label: rowLabel, reason: `Cost ${parsed} is negative` });
        continue;
      }
      cost = parsed;
    }

    const key = matchKey(row);
    let target = row.id ? byId.get(row.id) : undefined;
    /** Set when a carried-over Item ID was ignored because the row is really new. */
    let carriedOverIdFrom: number | undefined;

    if (row.id && !target) {
      rejected.push({
        line: row.line,
        label: rowLabel,
        reason: `Item ID "${row.id}" is no longer in the rate card — clear the ID column to add it as a new item`,
      });
      continue;
    }

    if (target) {
      const clash = claimedIds.get(target.id);
      if (clash !== undefined) {
        // The same Item ID twice in one file. Almost always someone adding an
        // item the natural way — copy a similar row in Excel, edit it, and not
        // think about the ID column. If this row describes something different
        // from the row that claimed the ID, it's a new item wearing a borrowed
        // ID, so add it instead of dropping it on the floor. Identical rows are
        // still a genuine duplicate and still rejected.
        if (claimedKeys.get(target.id) === key) {
          rejected.push({
            line: row.line,
            label: rowLabel,
            reason: `Identical to line ${clash} — only the first was used`,
          });
          continue;
        }
        carriedOverIdFrom = clash;
        target = undefined;
      } else {
        claimedIds.set(target.id, row.line);
        claimedKeys.set(target.id, key);
      }
    }

    if (!target) {
      const clash = seenKeys.get(key);
      if (clash !== undefined) {
        rejected.push({
          line: row.line,
          label: rowLabel,
          reason: `Duplicates line ${clash} (same Category, Description, Material and Finish) — only the first was used`,
        });
        continue;
      }
      seenKeys.set(key, row.line);
    }

    const matches = target ? [target] : (byKey.get(key) ?? []);

    if (matches.length > 1) {
      rejected.push({
        line: row.line,
        label: rowLabel,
        reason: `Matches ${matches.length} existing items (rates ${matches.map((m) => m.rate).join(", ")}) — these columns don't tell them apart, so edit them in the table above or keep the Item ID column`,
      });
      continue;
    }

    if (matches.length === 0) {
      inserts.push({
        line: row.line,
        category: row.category,
        name: row.name,
        material: row.material,
        finish: row.finish,
        unit: row.unit,
        rate,
        cost,
        defaultScope: row.defaultScope,
        note:
          carriedOverIdFrom === undefined
            ? undefined
            : `Item ID was copied from line ${carriedOverIdFrom} — added as a new item, that one is untouched`,
      });
      continue;
    }

    const item = matches[0];
    // A blank Unit cell leaves the stored unit alone rather than wiping it.
    const unit = row.unit.trim() === "" ? item.unit : row.unit;

    // Wording is editable too, but only for rows still carrying their Item ID.
    // Without an ID the four columns ARE the identity, so a reworded row is a
    // different item — renaming it there would mean overwriting whatever
    // unrelated item happened to share the old wording.
    // A blank scope cell leaves the stored default alone, the same way Unit does
    // — a spreadsheet with the column deleted shouldn't wipe every note.
    const defaultScope = row.defaultScope.trim() === "" ? item.defaultScope : row.defaultScope;
    const matchedById = Boolean(target);
    const category = matchedById ? row.category : item.category;
    const name = matchedById ? row.name : item.name;
    const material = matchedById ? row.material : item.material;
    const finish = matchedById ? row.finish : item.finish;

    const changes: FieldDelta[] = [];
    if (item.category !== category) changes.push({ field: "category", from: item.category, to: category });
    if (item.name !== name) changes.push({ field: "name", from: item.name, to: name });
    if (item.material !== material) changes.push({ field: "material", from: item.material || "—", to: material || "—" });
    if (item.finish !== finish) changes.push({ field: "finish", from: item.finish || "—", to: finish || "—" });
    if (item.unit !== unit) changes.push({ field: "unit", from: item.unit || "—", to: unit || "—" });
    if (item.rate !== rate) changes.push({ field: "rate", from: String(item.rate), to: String(rate) });
    if (item.cost !== cost) changes.push({ field: "cost", from: String(item.cost), to: String(cost) });
    if (item.defaultScope !== defaultScope) {
      changes.push({ field: "defaultScope", from: item.defaultScope || "—", to: defaultScope || "—" });
    }

    if (changes.length === 0) {
      unchanged++;
      continue;
    }

    updates.push({
      line: row.line,
      itemId: item.id,
      category: item.category,
      name: item.name,
      material: item.material,
      finish: item.finish,
      changes,
      expected: {
        rate: item.rate,
        cost: item.cost,
        unit: item.unit,
        category: item.category,
        name: item.name,
        material: item.material,
        finish: item.finish,
        defaultScope: item.defaultScope,
      },
      next: { rate, cost, unit, category, name, material, finish, defaultScope },
    });
  }

  return { updates, inserts, rejected, unchanged, totalRows: rows.length };
}

export type CommitResult = {
  ok: boolean;
  updated: number;
  inserted: number;
  /** Rows skipped because someone changed the item between preview and confirm. */
  conflicts: { label: string; reason: string }[];
  error?: string;
};

/**
 * Apply a reviewed plan.
 *
 * Every update is re-checked against the value the preview was built from and
 * skipped if it no longer matches. Without that, an admin confirming a preview
 * built ten minutes ago — from a spreadsheet exported an hour before that —
 * would quietly wipe whatever a colleague changed in the table in between, and
 * nobody would ever see it happen. Skipped rows are reported, not swallowed.
 */
export async function commitRateCardImport(plan: ImportPlan): Promise<CommitResult> {
  const user = await requireAdmin();

  const conflicts: { label: string; reason: string }[] = [];
  let updated = 0;
  let inserted = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const ids = plan.updates.map((update) => update.itemId);
      const current = await tx.rateItem.findMany({
        where: { id: { in: ids.length ? ids : ["-"] }, orgId: user.orgId },
      });
      const byId = new Map(current.map((item) => [item.id, item]));

      for (const update of plan.updates) {
        const item = byId.get(update.itemId);
        const name = [update.category, update.name, update.material, update.finish].filter(Boolean).join(" · ");

        if (!item) {
          conflicts.push({ label: name, reason: "Deleted from the rate card since the preview was generated" });
          continue;
        }

        const drifted: string[] = [];
        if (item.rate !== update.expected.rate) drifted.push(`rate is now ${item.rate}, preview showed ${update.expected.rate}`);
        if (item.cost !== update.expected.cost) drifted.push(`cost is now ${item.cost}, preview showed ${update.expected.cost}`);
        if (item.unit !== update.expected.unit) drifted.push(`unit is now "${item.unit}", preview showed "${update.expected.unit}"`);
        if (item.category !== update.expected.category) drifted.push(`category is now "${item.category}"`);
        if (item.name !== update.expected.name) drifted.push(`description is now "${item.name}"`);
        if (item.material !== update.expected.material) drifted.push(`material is now "${item.material}"`);
        if (item.finish !== update.expected.finish) drifted.push(`finish is now "${item.finish}"`);
        if (item.defaultScope !== update.expected.defaultScope) drifted.push("the default scope note changed");

        if (drifted.length > 0) {
          conflicts.push({ label: name, reason: `Changed by someone else — ${drifted.join("; ")}. Left as-is.` });
          continue;
        }

        await tx.rateItem.update({
          where: { id: item.id },
          data: {
            rate: update.next.rate,
            cost: update.next.cost,
            unit: update.next.unit,
            category: update.next.category,
            name: update.next.name,
            material: update.next.material,
            finish: update.next.finish,
            defaultScope: update.next.defaultScope,
          },
        });
        updated++;
      }

      if (plan.inserts.length > 0) {
        const last = await tx.rateItem.findFirst({
          where: { orgId: user.orgId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        let position = (last?.position ?? -1) + 1;

        await tx.rateItem.createMany({
          data: plan.inserts.map((insert) => ({
            orgId: user.orgId,
            category: insert.category,
            name: insert.name,
            material: insert.material,
            finish: insert.finish,
            unit: insert.unit,
            rate: insert.rate,
            cost: insert.cost,
            defaultScope: insert.defaultScope,
            position: position++,
          })),
        });
        inserted = plan.inserts.length;
      }
    }, BULK_TX);
  } catch {
    return { ok: false, updated: 0, inserted: 0, conflicts: [], error: "Could not apply the import — nothing was changed." };
  }

  revalidatePath("/settings");
  return { ok: true, updated, inserted, conflicts };
}
