import "server-only";

import type { BoqStatus, Prisma } from "@prisma/client";

import { CLIENT_VISIBLE_FIELDS, diffSnapshots, type BoqSnapshot } from "./boq";
import { recordAudit } from "./audit";
import { BULK_TX, prisma } from "./db";
import { parseSnapshot, toSnapshot, type ProjectWithBoq } from "./serialize";

export const projectInclude = {
  sections: { include: { items: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
} satisfies Prisma.ProjectInclude;

export async function loadProject(projectId: string, orgId: string): Promise<ProjectWithBoq | null> {
  return prisma.project.findFirst({
    where: { id: projectId, orgId },
    include: projectInclude,
  });
}

/** The latest version this project has had approved, if any. */
export async function latestApprovedVersion(projectId: string) {
  return prisma.version.findFirst({
    where: { projectId, status: "APPROVED" },
    orderBy: { number: "desc" },
  });
}

/**
 * Baseline a client's diff is measured against: the version *that specific
 * contact* last approved, falling back to the project's last approved version
 * when the contact is new (BOQ_BUILDER_V2_SPEC §3).
 */
export async function clientDiffBaseline(
  projectId: string,
  lastApprovedVersionId: string | null,
): Promise<BoqSnapshot | null> {
  if (lastApprovedVersionId) {
    const version = await prisma.version.findUnique({ where: { id: lastApprovedVersionId } });
    if (version) return parseSnapshot(version.snapshot);
  }
  const approved = await latestApprovedVersion(projectId);
  return approved ? parseSnapshot(approved.snapshot) : null;
}

export type CreateVersionInput = {
  project: ProjectWithBoq;
  status: BoqStatus;
  actorName: string;
  actorId?: string | null;
  note?: string | null;
};

/**
 * Snapshot the live BOQ as a new version and move the project's status.
 *
 * Versions are status-driven, not manual saves (BOQ_BUILDER_V2_SPEC §4). If an
 * approved version already exists, every approved line that has since changed
 * — or gone missing, or been added alongside — is written out as a ChangeOrder
 * so approved scope is never quietly overwritten (APPROVALS_SPEC §3).
 */
export async function createVersion({
  project,
  status,
  actorName,
  actorId,
  note,
}: CreateVersionInput) {
  const snapshot = toSnapshot(project);

  return prisma.$transaction(async (tx) => {
    const last = await tx.version.findFirst({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;

    const version = await tx.version.create({
      data: {
        projectId: project.id,
        number,
        status,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        note: note ?? null,
        createdById: actorId ?? null,
        createdByName: actorName,
      },
    });

    const approved = await tx.version.findFirst({
      where: { projectId: project.id, status: "APPROVED" },
      orderBy: { number: "desc" },
    });

    if (approved) {
      const baseline = parseSnapshot(approved.snapshot);
      const diff = diffSnapshots(snapshot, baseline, CLIENT_VISIBLE_FIELDS);
      const sectionOf = new Map<string, string>();
      for (const sec of snapshot.sections) for (const item of sec.items) sectionOf.set(item.id, sec.name);

      const orders: Prisma.ChangeOrderCreateManyInput[] = [];

      for (const sec of snapshot.sections) {
        for (const item of sec.items) {
          const entry = diff.byItem.get(item.id);
          if (!entry || entry.kind === "unchanged") continue;
          orders.push({
            projectId: project.id,
            versionId: version.id,
            lineItemId: item.id,
            lineItemName: item.desc || "(untitled item)",
            sectionName: sec.name,
            kind: entry.kind === "new" ? "ADDED" : "MODIFIED",
            changes: entry.changes as unknown as Prisma.InputJsonValue,
            createdByName: actorName,
          });
        }
      }

      for (const gone of diff.removed) {
        orders.push({
          projectId: project.id,
          versionId: version.id,
          lineItemId: gone.item.id,
          lineItemName: gone.item.desc || "(untitled item)",
          sectionName: gone.section,
          kind: "REMOVED",
          changes: [] as unknown as Prisma.InputJsonValue,
          createdByName: actorName,
        });
      }

      if (orders.length > 0) {
        await tx.changeOrder.createMany({ data: orders });
        await recordAudit(tx, {
          projectId: project.id,
          actorType: "SYSTEM",
          actorName: "Barebase BOQ Studio",
          action: `Raised ${orders.length} change order${orders.length === 1 ? "" : "s"} against V${approved.number}`,
          detail: { versionId: version.id, approvedVersion: approved.number },
        });
      }
    }

    await tx.project.update({ where: { id: project.id }, data: { status } });

    await recordAudit(tx, {
      projectId: project.id,
      actorType: "TEAM",
      actorName,
      action: `Saved V${number} as ${status === "SENT_TO_CLIENT" ? "Sent to Client" : status === "APPROVED" ? "Approved" : "Draft"}`,
      detail: { versionId: version.id, number },
    });

    return version;
  }, BULK_TX);
}

/** The version a client link should show: the newest one they've been sent. */
export async function currentClientVersion(projectId: string) {
  return prisma.version.findFirst({
    where: { projectId, status: { in: ["SENT_TO_CLIENT", "APPROVED"] } },
    orderBy: { number: "desc" },
  });
}

/**
 * How many lines of the version currently with the client came back rejected,
 * with a change requested, or with a note — the number on the Client Review tab.
 *
 * Counted per line, not per response: two contacts rejecting the same item is
 * one thing for the team to deal with.
 */
export async function reviewAttentionCount(projectId: string): Promise<number> {
  const version = await currentClientVersion(projectId);
  if (!version) return 0;

  const flagged = await prisma.itemApproval.findMany({
    where: {
      versionId: version.id,
      OR: [
        { status: { in: ["REJECTED", "REVISION_REQUESTED"] } },
        { AND: [{ comment: { not: null } }, { comment: { not: "" } }] },
      ],
    },
    select: { lineItemId: true },
  });

  return new Set(flagged.map((row) => row.lineItemId)).size;
}
