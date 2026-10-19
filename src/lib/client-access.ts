import "server-only";

import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "./db";

/** 32 bytes of entropy in the URL. */
export function newClientToken(): string {
  return randomBytes(24).toString("base64url");
}

const DEVICE_DAYS = 30;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short — set it to a long random string.");
  }
  return new TextEncoder().encode(value);
}

/**
 * Remember that this browser answered the email check.
 *
 * Deliberately modest: the link plus the email address it was issued to. It
 * stops a link forwarded on WhatsApp from opening for whoever receives it, and
 * it is *not* authentication — anyone holding both still gets in. Real
 * protection is a one-time code emailed to the contact, which needs email
 * sending the app doesn't have yet.
 *
 * The pass is bound to the share token as well as the contact, so revoking and
 * reissuing a link invalidates every device that had passed the old one.
 */
export async function issueDevicePass(contactId: string, token: string): Promise<string> {
  return new SignJWT({ sub: contactId, tok: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DEVICE_DAYS}d`)
    .sign(secret());
}

/** True when this pass was issued for exactly this contact and this live link. */
export async function verifyDevicePass(
  pass: string | null | undefined,
  contactId: string,
  token: string,
): Promise<boolean> {
  if (!pass) return false;
  try {
    const { payload } = await jwtVerify(pass, secret());
    return payload.sub === contactId && payload.tok === token;
  } catch {
    return false;
  }
}

/** Same shape of comparison the check uses, so both sides agree on what matches. */
export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
