import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { requireUser } from "./auth";
import { prisma } from "./db";

/**
 * The project the ProjectShell is showing, loaded once per request and scoped to
 * the signed-in person's organisation. Anything else is a 404 (PS 18). Project
 * membership joins this query in Phase 0 (P0-7).
 */
export const loadShellProject = cache(async (id: string) => {
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: { id, orgId: user.orgId },
    select: { id: true, name: true, clientName: true },
  });
  if (!project) notFound();
  return { user, project };
});
