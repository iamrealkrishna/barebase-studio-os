"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { computeQty, type BoqSnapshot } from "@/lib/boq";
import { prisma } from "@/lib/db";
import { toLineItemData, toSnapshot } from "@/lib/serialize";
import { loadProject, projectInclude } from "@/lib/versions";

export type ImportableProject = {
  id: string;
  name: string;
  clientName: string;
  sectionCount: number;
  itemCount: number;
  total: number;
  updatedAt: string;
};

/** Every other project in the org, for the "Import from project" picker. */
export async function listImportableProjects(excludeProjectId: string): Promise<ImportableProject[]> {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { orgId: user.orgId, id: { not: excludeProjectId } },
    orderBy: { updatedAt: "desc" },
    include: {
      sections: {
        select: { items: { select: { rate: true, qty: true, unit: true, dimL: true, dimB: true, dimH: true } } },
      },
    },
  });

  return projects.map((project) => {
    let itemCount = 0;
    let total = 0;
    for (const section of project.sections) {
      itemCount += section.items.length;
      for (const item of section.items) {
        const qty = computeQty({
          unit: item.unit,
          qty: item.qty,
          dims: {
            l: item.dimL === null ? "" : String(item.dimL),
            b: item.dimB === null ? "" : String(item.dimB),
            h: item.dimH === null ? "" : String(item.dimH),
          },
        });
        total += qty * item.rate;
      }
    }
    return {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      sectionCount: project.sections.length,
      itemCount,
      total,
      updatedAt: project.updatedAt.toISOString(),
    };
  });
}

/**
 * Read another project's BOQ so its sections and items can be listed for
 * cherry-picking. Read-only: the copy itself happens client-side, where the
 * chosen items are given fresh ids before being merged in, so an imported line
 * is a genuine copy and editing it later can never reach back to the original.
 */
export async function getProjectForImport(projectId: string): Promise<BoqSnapshot | null> {
  const user = await requireUser();
  const project = await loadProject(projectId, user.orgId);
  return project ? toSnapshot(project) : null;
}

/** Clone a whole project — sections, items and settings — as a new project. */
export async function duplicateProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sourceId = String(formData.get("projectId") ?? "");
  const requestedName = String(formData.get("name") ?? "").trim();
  const requestedClient = String(formData.get("clientName") ?? "").trim();
  const keepClient = String(formData.get("keepClient") ?? "") === "on";

  const source = await prisma.project.findFirst({
    where: { id: sourceId, orgId: user.orgId },
    include: projectInclude,
  });
  if (!source) return;

  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        orgId: user.orgId,
        name: requestedName || `${source.name} (copy)`,
        // Meta the team will almost always replace is left blank unless asked for.
        clientName: keepClient ? source.clientName : requestedClient,
        preparedBy: user.name,
        quoteDate: new Date().toISOString().slice(0, 10),
        terms: source.terms,
        discountType: source.discountType,
        discountValue: source.discountValue,
        gstOn: source.gstOn,
        gstRate: source.gstRate,
        colMaterial: source.colMaterial,
        colFinish: source.colFinish,
        colUnit: source.colUnit,
        colRate: source.colRate,
        createdById: user.id,
        // A duplicate starts as a fresh Draft with no versions, no client
        // contacts and no approvals — none of that belongs to the new project.
        status: "DRAFT",
      },
    });

    for (const section of source.sections) {
      await tx.section.create({
        data: {
          projectId: created.id,
          name: section.name,
          position: section.position,
          items: {
            // No id passed: every line gets a new one, so the two projects
            // never share a row.
            create: section.items.map((item, index) =>
              toLineItemData(
                {
                  id: "",
                  category: item.category,
                  custom: item.isCustom,
                  desc: item.name,
                  material: item.material,
                  finish: item.finish,
                  unit: item.unit,
                  rate: item.rate,
                  cost: item.cost,
                  dims: {
                    l: item.dimL === null ? "" : String(item.dimL),
                    b: item.dimB === null ? "" : String(item.dimB),
                    h: item.dimH === null ? "" : String(item.dimH),
                  },
                  qty: item.qty,
                  description: item.scope,
                  note: item.note,
                  image: item.image,
                },
                index,
              ),
            ),
          },
        },
      });
    }

    await recordAudit(tx, {
      projectId: created.id,
      actorType: "TEAM",
      actorName: user.name,
      action: `Created as a duplicate of "${source.name}"`,
      detail: { sourceProjectId: source.id },
    });

    return created;
  });

  revalidatePath("/projects");
  redirect(`/projects/${copy.id}/build`);
}
