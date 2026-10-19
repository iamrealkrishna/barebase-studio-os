import "server-only";

import { notFound } from "next/navigation";

import { requireUser, type SessionUser } from "./auth";
import { prisma } from "./db";
import type { Letterhead } from "./pdf";
import { toSnapshot, type ProjectWithBoq } from "./serialize";
import { loadProject } from "./versions";

export type ProjectPageData = {
  user: SessionUser;
  project: ProjectWithBoq;
  letterhead: Letterhead;
};

export function toLetterhead(org: {
  name: string;
  legalName: string | null;
  addressLine: string | null;
  pocName: string | null;
  pocPhone: string | null;
  pocEmail: string | null;
}): Letterhead {
  return {
    name: org.name,
    legalName: org.legalName ?? "",
    addressLine: org.addressLine ?? "",
    pocName: org.pocName ?? "",
    pocPhone: org.pocPhone ?? "",
    pocEmail: org.pocEmail ?? "",
  };
}

/** Load a project the signed-in user is allowed to see, or 404. */
export async function getProjectPageData(projectId: string): Promise<ProjectPageData> {
  const user = await requireUser();
  const [project, org] = await Promise.all([
    loadProject(projectId, user.orgId),
    prisma.organization.findUnique({ where: { id: user.orgId } }),
  ]);
  if (!project || !org) notFound();
  return { user, project, letterhead: toLetterhead(org) };
}

export { toSnapshot };
