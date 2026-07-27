import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "./db";

/** 32 bytes of entropy in the URL — the only credential a client ever needs. */
export function newClientToken(): string {
  return randomBytes(24).toString("base64url");
}

export type ClientAccess = Awaited<ReturnType<typeof resolveClientAccess>>;

/**
 * Resolve a share token to its contact and project.
 *
 * A contact is scoped to exactly one project and can reach nothing else in the
 * org — no rate card, no other projects, no cost or margin data
 * (APPROVALS_SPEC, "Data model implications").
 */
export async function resolveClientAccess(token: string) {
  if (!token) return null;

  const contact = await prisma.clientContact.findUnique({
    where: { token },
    include: { project: { include: { org: true } } },
  });
  if (!contact || contact.revoked) return null;

  return { contact, project: contact.project, org: contact.project.org };
}
