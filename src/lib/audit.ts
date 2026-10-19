import type { ActorType, Prisma } from "@prisma/client";

import { prisma } from "./db";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Every approval, rejection, comment and change order is timestamped and
 * attributed (APPROVALS_SPEC §4). This log is internal-only — it's the thing
 * that settles "but I never agreed to that".
 */
export async function recordAudit(
  db: Client,
  input: {
    projectId: string;
    actorType: ActorType;
    actorName: string;
    action: string;
    detail?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.auditEvent.create({
    data: {
      projectId: input.projectId,
      actorType: input.actorType,
      actorName: input.actorName,
      action: input.action,
      detail: input.detail,
    },
  });
}
