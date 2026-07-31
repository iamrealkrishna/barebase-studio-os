"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BoqStatus, Prisma } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { DEFAULT_TERMS, FIXED_SECTIONS, type BoqItem } from "@/lib/boq";
import { BULK_TX, prisma } from "@/lib/db";
import { findRateRow, type RateEntry } from "@/lib/rate-card";
import { toLineItemData } from "@/lib/serialize";
import { createVersion, loadProject } from "@/lib/versions";

export async function createProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();

  if (!name) return;

  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });

  const project = await prisma.project.create({
    data: {
      orgId: user.orgId,
      name,
      clientName,
      preparedBy: user.name,
      quoteDate: new Date().toISOString().slice(0, 10),
      terms: org?.terms || DEFAULT_TERMS,
      createdById: user.id,
      // Fixed sections always come first, in order (BOQ_BUILDER_V2_SPEC §1).
      sections: { create: FIXED_SECTIONS.map((sectionName, i) => ({ name: sectionName, position: i })) },
    },
  });

  await recordAudit(prisma, {
    projectId: project.id,
    actorType: "TEAM",
    actorName: user.name,
    action: "Created project",
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}/build`);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("projectId") ?? "");
  await prisma.project.deleteMany({ where: { id, orgId: user.orgId } });
  revalidatePath("/projects");
  redirect("/projects");
}

export type ProjectMetaInput = {
  projectId: string;
  name: string;
  clientName: string;
  preparedBy: string;
  quoteDate: string;
  terms: string;
};

export async function updateProjectMeta(input: ProjectMetaInput): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const result = await prisma.project.updateMany({
    where: { id: input.projectId, orgId: user.orgId },
    data: {
      name: input.name.trim() || "Untitled project",
      clientName: input.clientName,
      preparedBy: input.preparedBy,
      quoteDate: input.quoteDate,
      terms: input.terms,
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
  return { ok: result.count > 0 };
}

export type ClientColumns = { material: boolean; finish: boolean; qty: boolean; rate: boolean };

/**
 * Set which per-line details the client sees, from the Client View page.
 *
 * Separate from the builder's autosave so it can be changed while looking at
 * exactly what the client will get. Both write the same per-project fields; a
 * builder tab left open elsewhere will notice via the updatedAt check and ask
 * to reload rather than quietly putting the old values back.
 */
export async function updateClientColumns(
  projectId: string,
  cols: ClientColumns,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const result = await prisma.project.updateMany({
    where: { id: projectId, orgId: user.orgId },
    data: {
      colMaterial: cols.material,
      colFinish: cols.finish,
      colQty: cols.qty,
      colRate: cols.rate,
    },
  });

  revalidatePath(`/projects/${projectId}/client-view`);
  return { ok: result.count > 0 };
}

export type LoadedBoq = { snapshot: import("@/lib/boq").BoqSnapshot; updatedAt: string };

/**
 * Read the live BOQ straight from the database.
 *
 * The builder calls this on mount to check the props it was rendered with are
 * actually current. Next's client router cache can replay a stale RSC payload
 * on a back/forward navigation, and without this the builder would sit there
 * showing an out-of-date BOQ — then autosave it over the real one.
 */
export async function loadBoq(projectId: string): Promise<LoadedBoq | null> {
  const user = await requireUser();
  const project = await loadProject(projectId, user.orgId);
  if (!project) return null;
  const { toSnapshot } = await import("@/lib/serialize");
  return { snapshot: toSnapshot(project), updatedAt: project.updatedAt.toISOString() };
}

export type SaveBoqInput = {
  projectId: string;
  /** project.updatedAt the client last saw. Guards against writing over newer data. */
  expectedUpdatedAt: string;
  meta: {
    client: string;
    property: string;
    preparedBy: string;
    date: string;
    terms: string;
    discountType: "pct" | "amt";
    discountValue: number;
    gstOn: boolean;
    gstRate: number;
    cols: { material: boolean; finish: boolean; qty: boolean; rate: boolean };
  };
  sections: { name: string; items: BoqItem[] }[];
};

export type SaveBoqResult = {
  ok: boolean;
  idMap: Record<string, string>;
  /** New project.updatedAt to carry into the next save. */
  updatedAt?: string;
  /** The client's view was out of date; nothing was written. */
  conflict?: boolean;
  error?: string;
};

/**
 * Persist the live BOQ.
 *
 * Item ids are assigned client-side (`new:` prefix for anything added since the
 * last save) and rewritten to real cuids here. Keeping ids stable across saves
 * is what makes version diffing — and therefore change orders — work at all,
 * so existing rows are updated in place rather than deleted and recreated.
 *
 * The write is refused outright unless the caller's `expectedUpdatedAt` still
 * matches the row. This save deletes any line the payload omits, so a client
 * holding a stale snapshot — a replayed router-cache payload, a second tab, a
 * colleague mid-edit — would otherwise wipe work it never saw.
 *
 * Internal cost is admin-only and never reaches a team member's browser, so a
 * member's payload carries zeros. Those are discarded rather than written —
 * see `resolveCost`.
 */
export async function saveBoq(input: SaveBoqInput): Promise<SaveBoqResult> {
  const user = await requireUser();
  const canSetCost = user.role === "ADMIN";

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, orgId: user.orgId },
    include: {
      sections: {
        include: {
          items: { select: { id: true, category: true, name: true, material: true, finish: true, cost: true } },
        },
      },
    },
  });
  if (!project) return { ok: false, idMap: {}, error: "Project not found." };

  if (input.expectedUpdatedAt && project.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    return {
      ok: false,
      idMap: {},
      conflict: true,
      error: "This BOQ changed somewhere else since it was opened here.",
    };
  }

  const stored = new Map(project.sections.flatMap((s) => s.items).map((item) => [item.id, item]));
  const knownItemIds = new Set(stored.keys());
  const idMap: Record<string, string> = {};

  // Only loaded when it's needed — an admin's payload is taken at face value.
  const rateCard: RateEntry[] = canSetCost
    ? []
    : (
        await prisma.rateItem.findMany({
          where: { orgId: user.orgId },
          select: { id: true, category: true, name: true, material: true, finish: true, unit: true, rate: true, cost: true },
        })
      );

  /**
   * What to actually store as this line's internal cost.
   *
   * A team member's browser has no cost figures, so anything it sends back is a
   * zero we must not write. For a line already on record we keep exactly what's
   * stored. For a new line — or one a member re-pointed at a different rate-card
   * item — we look the cost up from the rate card, falling back to whatever was
   * there before. The result is that a member can build and edit freely without
   * ever seeing margin, and without erasing it either.
   */
  const resolveCost = (item: BoqItem): number => {
    if (canSetCost) return item.cost;

    const previous = stored.get(item.id);
    const unchangedIdentity =
      previous !== undefined &&
      previous.category === item.category &&
      previous.name === item.desc &&
      previous.material === item.material &&
      previous.finish === item.finish;
    if (unchangedIdentity) return previous.cost;

    const row = findRateRow(rateCard, item.category, item.desc, item.material, item.finish);
    return row?.cost ?? previous?.cost ?? 0;
  };

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        name: input.meta.property.trim() || project.name,
        clientName: input.meta.client,
        preparedBy: input.meta.preparedBy,
        quoteDate: input.meta.date,
        terms: input.meta.terms,
        discountType: input.meta.discountType,
        discountValue: input.meta.discountValue,
        gstOn: input.meta.gstOn,
        gstRate: input.meta.gstRate,
        colMaterial: input.meta.cols.material,
        colFinish: input.meta.cols.finish,
        colQty: input.meta.cols.qty,
        colRate: input.meta.cols.rate,
      },
    });

    const keptSectionIds: string[] = [];
    const keptItemIds: string[] = [];

    for (const [position, section] of input.sections.entries()) {
      const row = await tx.section.upsert({
        where: { projectId_name: { projectId: project.id, name: section.name } },
        create: { projectId: project.id, name: section.name, position },
        update: { position },
      });
      keptSectionIds.push(row.id);

      for (const [itemPosition, item] of section.items.entries()) {
        const data = { ...toLineItemData(item, itemPosition), cost: resolveCost(item) };
        if (knownItemIds.has(item.id)) {
          await tx.lineItem.update({ where: { id: item.id }, data: { ...data, sectionId: row.id } });
          keptItemIds.push(item.id);
        } else {
          const created = await tx.lineItem.create({ data: { ...data, sectionId: row.id } });
          idMap[item.id] = created.id;
          keptItemIds.push(created.id);
        }
      }
    }

    await tx.lineItem.deleteMany({
      where: { section: { projectId: project.id }, id: { notIn: keptItemIds.length ? keptItemIds : ["-"] } },
    });
    await tx.section.deleteMany({
      where: { projectId: project.id, id: { notIn: keptSectionIds.length ? keptSectionIds : ["-"] } },
    });
  }, BULK_TX);

  const saved = await prisma.project.findUnique({
    where: { id: project.id },
    select: { updatedAt: true },
  });

  // Deliberately no revalidatePath: this fires on every autosave, and the
  // builder already holds the authoritative state. Other routes are
  // force-dynamic, so they pick up the new data when navigated to.
  return { ok: true, idMap, updatedAt: saved?.updatedAt.toISOString() };
}

export async function saveVersion(
  projectId: string,
  status: BoqStatus,
  note?: string,
): Promise<{ ok: boolean; number?: number; updatedAt?: string; error?: string }> {
  const user = await requireUser();
  const project = await loadProject(projectId, user.orgId);
  if (!project) return { ok: false, error: "Project not found." };

  const itemCount = project.sections.reduce((n, s) => n + s.items.length, 0);
  if (itemCount === 0) return { ok: false, error: "Add at least one line item before saving a version." };

  const version = await createVersion({
    project,
    status,
    actorName: user.name,
    actorId: user.id,
    note: note ?? null,
  });

  // Versioning moves the project's status, which bumps updatedAt — hand the new
  // value back so the builder's next autosave doesn't read as a conflict.
  const saved = await prisma.project.findUnique({ where: { id: projectId }, select: { updatedAt: true } });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, number: version.number, updatedAt: saved?.updatedAt.toISOString() };
}

/** Copy an old version's snapshot back over the live BOQ. */
export async function restoreVersion(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");

  const project = await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId } });
  const version = await prisma.version.findFirst({ where: { id: versionId, projectId } });
  if (!project || !version) return;

  const { parseSnapshot } = await import("@/lib/serialize");
  const snapshot = parseSnapshot(version.snapshot);

  await prisma.$transaction(async (tx) => {
    await tx.section.deleteMany({ where: { projectId } });
    await tx.project.update({
      where: { id: projectId },
      data: {
        clientName: snapshot.meta.client,
        preparedBy: snapshot.meta.preparedBy,
        quoteDate: snapshot.meta.date,
        terms: snapshot.meta.terms,
        discountType: snapshot.meta.discountType,
        discountValue: snapshot.meta.discountValue,
        gstOn: snapshot.meta.gstOn,
        gstRate: snapshot.meta.gstRate,
        colMaterial: snapshot.meta.cols.material,
        colFinish: snapshot.meta.cols.finish,
        colQty: snapshot.meta.cols.qty,
        colRate: snapshot.meta.cols.rate,
      },
    });

    for (const [position, section] of snapshot.sections.entries()) {
      await tx.section.create({
        data: {
          projectId,
          name: section.name,
          position,
          // Reuse the snapshot's item ids so history and diffs stay continuous.
          items: {
            create: section.items.map((item, i) => ({ id: item.id || undefined, ...toLineItemData(item, i) })),
          },
        },
      });
    }

    await recordAudit(tx, {
      projectId,
      actorType: "TEAM",
      actorName: user.name,
      action: `Restored V${version.number} into the live BOQ`,
      detail: { versionId } as Prisma.InputJsonValue,
    });
  }, BULK_TX);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/build`);
}
