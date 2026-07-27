"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BoqStatus, Prisma } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { DEFAULT_TERMS, FIXED_SECTIONS, type BoqItem } from "@/lib/boq";
import { prisma } from "@/lib/db";
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

export type SaveBoqInput = {
  projectId: string;
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
    cols: { material: boolean; finish: boolean; unit: boolean; rate: boolean };
  };
  sections: { name: string; items: BoqItem[] }[];
};

/**
 * Persist the live BOQ.
 *
 * Item ids are assigned client-side (`new:` prefix for anything added since the
 * last save) and rewritten to real cuids here. Keeping ids stable across saves
 * is what makes version diffing — and therefore change orders — work at all,
 * so existing rows are updated in place rather than deleted and recreated.
 */
export async function saveBoq(input: SaveBoqInput): Promise<{ ok: boolean; idMap: Record<string, string> }> {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, orgId: user.orgId },
    include: { sections: { include: { items: { select: { id: true } } } } },
  });
  if (!project) return { ok: false, idMap: {} };

  const knownItemIds = new Set(project.sections.flatMap((s) => s.items.map((i) => i.id)));
  const idMap: Record<string, string> = {};

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
        colUnit: input.meta.cols.unit,
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
        const data = toLineItemData(item, itemPosition);
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
  });

  // Deliberately no revalidatePath: this fires on every autosave, and the
  // builder already holds the authoritative state. Other routes are
  // force-dynamic, so they pick up the new data when navigated to.
  return { ok: true, idMap };
}

export async function saveVersion(
  projectId: string,
  status: BoqStatus,
  note?: string,
): Promise<{ ok: boolean; number?: number; error?: string }> {
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

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, number: version.number };
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
        colUnit: snapshot.meta.cols.unit,
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
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/build`);
}
