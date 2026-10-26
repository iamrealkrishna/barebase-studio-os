import type { SessionUser } from "./auth";
import type { BoqSnapshot } from "./boq";

/**
 * Who may see cost price, margin and internal notes.
 *
 * Admins today. P0-8 moves this behind `can(user, "see", "cost")`, which adds
 * the Design lead (decision 20). Until then every check goes through here so
 * that change lands in one place.
 */
export function canSeeCost(user: Pick<SessionUser, "role">): boolean {
  return user.role === "ADMIN";
}

/**
 * The same BOQ without cost or internal notes (decisions 20 and 25).
 *
 * Applied on the server before a snapshot reaches anyone who can't see cost:
 * hiding a column in the browser would still ship the data. `saveBoq` keeps
 * the stored cost and note when such a user's blanks come back.
 */
export function withoutPrivateFields(snapshot: BoqSnapshot): BoqSnapshot {
  return {
    ...snapshot,
    sections: snapshot.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, cost: 0, note: "" })),
    })),
  };
}

/** The snapshot as this user may see it. */
export function snapshotFor(user: Pick<SessionUser, "role">, snapshot: BoqSnapshot): BoqSnapshot {
  return canSeeCost(user) ? snapshot : withoutPrivateFields(snapshot);
}
