"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { BULK_TX, prisma } from "@/lib/db";
import { DEFAULT_RATE_CARD } from "@/lib/default-rate-card";
import { describeKey, newDuplicateGroups, type RateEntry } from "@/lib/rate-card";

export type RateCardResult = { ok: boolean; error?: string };

function clean(entry: RateEntry, position: number) {
  return {
    category: entry.category.trim(),
    name: entry.name.trim(),
    material: entry.material.trim(),
    finish: entry.finish.trim(),
    unit: entry.unit.trim(),
    rate: Number.isFinite(entry.rate) ? entry.rate : 0,
    cost: Number.isFinite(entry.cost) ? entry.cost : 0,
    defaultScope: entry.defaultScope ?? "",
    position,
  };
}

/**
 * Replace the org's rate card with what the Settings screen is holding.
 *
 * Rows keep their ids so an edit is an update, not a delete-and-recreate —
 * which matters because the rate card is shared team-wide and edited live.
 */
export async function saveRateCard(entries: RateEntry[]): Promise<RateCardResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: "Only an admin can edit the rate card." };

  const usable = entries.filter((entry) => entry.category.trim() && entry.name.trim());

  /**
   * Refuse clashes this save would introduce.
   *
   * Category + Description + Material + Finish is what identifies an item, and
   * `findRateRow` takes the first match — so a second row under the same four
   * columns is unreachable, and its price can never be quoted.
   *
   * Measured against what's stored rather than against zero: the card already
   * carries clashes from before this rule existed, and rejecting every save
   * until they were all resolved would simply stop the screen working. The
   * guard is that a save can't add one.
   */
  const stored = await prisma.rateItem.findMany({
    where: { orgId: user.orgId },
    select: { category: true, name: true, material: true, finish: true, unit: true, rate: true, cost: true },
  });
  const added = newDuplicateGroups(
    usable,
    stored.map((row) => ({ ...row, id: "", defaultScope: "" })),
  );
  if (added.length > 0) {
    const first = describeKey(added[0].entries[0]);
    return {
      ok: false,
      error:
        added.length === 1
          ? `Two rows describe the same item: ${first}. Change the Finish or Material so they can be told apart, or delete one.`
          : `${added.length} items would end up with more than one row, starting with ${first}. Each needs a different Finish or Material.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.rateItem.findMany({ where: { orgId: user.orgId }, select: { id: true } });
    const existingIds = new Set(existing.map((row) => row.id));
    const kept: string[] = [];

    for (const [position, entry] of usable.entries()) {
      const data = clean(entry, position);
      if (existingIds.has(entry.id)) {
        await tx.rateItem.update({ where: { id: entry.id }, data });
        kept.push(entry.id);
      } else {
        const created = await tx.rateItem.create({ data: { ...data, orgId: user.orgId } });
        kept.push(created.id);
      }
    }

    await tx.rateItem.deleteMany({
      where: { orgId: user.orgId, id: { notIn: kept.length ? kept : ["-"] } },
    });
  }, BULK_TX);

  revalidatePath("/settings");
  return { ok: true };
}

export async function resetRateCard(): Promise<RateCardResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: "Only an admin can edit the rate card." };

  await prisma.$transaction(async (tx) => {
    await tx.rateItem.deleteMany({ where: { orgId: user.orgId } });
    await tx.rateItem.createMany({
      data: DEFAULT_RATE_CARD.map((item, position) => ({ ...item, orgId: user.orgId, position })),
    });
  }, BULK_TX);

  revalidatePath("/settings");
  return { ok: true };
}
