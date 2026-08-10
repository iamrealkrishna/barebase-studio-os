"use server";

import type { ApprovalStatus } from "@prisma/client";

import { recordClientView } from "@/actions/approvals";
import { recordAudit } from "@/lib/audit";
import { toClientSnapshot, type BoqSnapshot } from "@/lib/boq";
import {
  issueDevicePass,
  resolveClientAccess,
  sameEmail,
  verifyDevicePass,
} from "@/lib/client-access";
import { prisma } from "@/lib/db";
import type { Letterhead } from "@/lib/pdf";
import { toLetterhead } from "@/lib/project-page";
import { parseSnapshot } from "@/lib/serialize";
import { clientDiffBaseline, currentClientVersion } from "@/lib/versions";

export type ClientEstimate = {
  versionId: string;
  contactName: string;
  snapshot: BoqSnapshot;
  letterhead: Letterhead;
  baselineSnapshot: BoqSnapshot | null;
  alreadyApproved: boolean;
  /** When this contact last pressed Done, if they have. */
  submittedAt: string | null;
  approvals: { lineItemId: string; status: ApprovalStatus; comment: string; at: string }[];
};

export type GateResult =
  | { state: "invalid" }
  | { state: "locked"; orgName: string }
  | { state: "not-ready"; orgName: string; contactName: string; projectName: string; pass?: string }
  | { state: "open"; pass?: string; estimate: ClientEstimate };

/**
 * Everything the portal renders, handed over only once the browser has proved
 * it knows the email the link was issued to.
 *
 * The estimate is fetched here rather than server-rendered into the page so an
 * unverified visitor never receives it at all — a gate drawn over data that's
 * already in the HTML would be decorative.
 */
async function openEstimate(token: string, contactId: string): Promise<ClientEstimate | null> {
  const access = await resolveClientAccess(token);
  if (!access || access.contact.id !== contactId) return null;

  const version = await currentClientVersion(access.project.id);
  if (!version) return null;

  await recordClientView(token);

  const [baseline, approvals] = await Promise.all([
    clientDiffBaseline(access.project.id, access.contact.lastApprovedVersionId),
    prisma.itemApproval.findMany({
      where: { versionId: version.id, contactId: access.contact.id },
    }),
  ]);

  return {
    versionId: version.id,
    contactName: access.contact.name,
    // Everything internal — cost, margin, notes — is stripped before it leaves.
    snapshot: toClientSnapshot(parseSnapshot(version.snapshot)),
    letterhead: toLetterhead(access.org),
    baselineSnapshot: baseline ? toClientSnapshot(baseline) : null,
    alreadyApproved: version.status === "APPROVED",
    submittedAt: access.contact.reviewSubmittedAt
      ? access.contact.reviewSubmittedAt.toISOString()
      : null,
    approvals: approvals.map((approval) => ({
      lineItemId: approval.lineItemId,
      status: approval.status,
      comment: approval.comment ?? "",
      at: approval.updatedAt.toISOString(),
    })),
  };
}

/** Called on load with whatever pass this browser has stored, if any. */
export async function openWithPass(token: string, pass: string | null): Promise<GateResult> {
  const access = await resolveClientAccess(token);
  if (!access) return { state: "invalid" };

  if (!(await verifyDevicePass(pass, access.contact.id, token))) {
    return { state: "locked", orgName: access.org.name };
  }

  const estimate = await openEstimate(token, access.contact.id);
  if (!estimate) {
    return {
      state: "not-ready",
      orgName: access.org.name,
      contactName: access.contact.name,
      projectName: access.project.name,
    };
  }
  return { state: "open", estimate };
}

/** Called when the visitor types an email into the gate. */
export async function openWithEmail(token: string, email: string): Promise<GateResult> {
  const access = await resolveClientAccess(token);

  // A wrong email and a dead link give the same answer on purpose — otherwise
  // this page would confirm that a given link exists to anyone who probes it.
  if (!access || !sameEmail(access.contact.email, email)) {
    if (access) {
      await recordAudit(prisma, {
        projectId: access.project.id,
        actorType: "SYSTEM",
        actorName: "Barebase BOQ Studio",
        action: `Failed access check on ${access.contact.name}'s review link`,
      });
    }
    return { state: "invalid" };
  }

  // Issued either way: the estimate not being ready yet is no reason to make
  // them retype their email when it is.
  const pass = await issueDevicePass(access.contact.id, token);
  const estimate = await openEstimate(token, access.contact.id);

  if (!estimate) {
    return {
      state: "not-ready",
      orgName: access.org.name,
      contactName: access.contact.name,
      projectName: access.project.name,
      pass,
    };
  }
  return { state: "open", pass, estimate };
}
