"use server";

import { revalidatePath } from "next/cache";
import type { ApprovalStatus, BoqStatus, Prisma } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { approvalLabel, countItems, statusLabel } from "@/lib/boq";
import { newClientToken, resolveClientAccess } from "@/lib/client-access";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/serialize";

// ------------------------------------------------------------------ team side

export async function addClientContact(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name || !email) return;

  const project = await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId } });
  if (!project) return;

  await prisma.clientContact.create({
    data: { projectId, name, email, token: newClientToken() },
  });

  await recordAudit(prisma, {
    projectId,
    actorType: "TEAM",
    actorName: user.name,
    action: `Gave ${name} (${email}) access to this BOQ`,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function revokeClientContact(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");

  const project = await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId } });
  if (!project) return;

  const contact = await prisma.clientContact.findFirst({ where: { id: contactId, projectId } });
  if (!contact) return;

  await prisma.clientContact.update({ where: { id: contactId }, data: { revoked: true } });
  await recordAudit(prisma, {
    projectId,
    actorType: "TEAM",
    actorName: user.name,
    action: `Revoked ${contact.name}'s access link`,
  });

  revalidatePath(`/projects/${projectId}`);
}

/** Manual status override on a version — the design's per-row status dropdown. */
export async function setVersionStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const status = String(formData.get("status") ?? "") as BoqStatus;

  if (!["DRAFT", "SENT_TO_CLIENT", "APPROVED"].includes(status)) return;

  const project = await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId } });
  const version = await prisma.version.findFirst({ where: { id: versionId, projectId } });
  if (!project || !version) return;

  await prisma.$transaction(async (tx) => {
    await tx.version.update({
      where: { id: versionId },
      data: {
        status,
        approvedAt: status === "APPROVED" ? version.approvedAt ?? new Date() : null,
        approvedByContact: status === "APPROVED" ? version.approvedByContact ?? user.name : null,
      },
    });

    // The project's own status follows its newest version.
    const newest = await tx.version.findFirst({ where: { projectId }, orderBy: { number: "desc" } });
    if (newest) await tx.project.update({ where: { id: projectId }, data: { status: newest.status } });

    await recordAudit(tx, {
      projectId,
      actorType: "TEAM",
      actorName: user.name,
      action: `Set V${version.number} to ${statusLabel(status)}`,
    });
  });

  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------- client side

export type ClientActionResult = { ok: boolean; error?: string; status?: ApprovalStatus };

/**
 * When every line a client can see is approved, the version itself becomes
 * Approved — and that version becomes the baseline their next diff is measured
 * against (BOQ_BUILDER_V2_SPEC §3).
 */
async function settleVersionApproval(
  tx: Prisma.TransactionClient,
  args: { versionId: string; projectId: string; contactId: string; contactName: string; totalItems: number },
) {
  const approved = await tx.itemApproval.count({
    where: { versionId: args.versionId, contactId: args.contactId, status: "APPROVED" },
  });
  if (args.totalItems === 0 || approved < args.totalItems) return false;

  await tx.version.update({
    where: { id: args.versionId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedByContact: args.contactName },
  });
  await tx.clientContact.update({
    where: { id: args.contactId },
    data: { lastApprovedVersionId: args.versionId },
  });

  const newest = await tx.version.findFirst({ where: { projectId: args.projectId }, orderBy: { number: "desc" } });
  if (newest?.id === args.versionId) {
    await tx.project.update({ where: { id: args.projectId }, data: { status: "APPROVED" } });
  }

  await recordAudit(tx, {
    projectId: args.projectId,
    actorType: "CLIENT",
    actorName: args.contactName,
    action: "Approved the full BOQ",
    detail: { versionId: args.versionId },
  });

  return true;
}

/**
 * A version can't stay Approved once the client turns round and rejects one of
 * its lines — that's the sort of contradiction the audit trail exists to
 * prevent. Roll it back to Sent to Client and drop the contact's approval
 * baseline, so their next diff is measured against whatever they genuinely
 * approved before this.
 */
async function unsettleVersionApproval(
  tx: Prisma.TransactionClient,
  args: { versionId: string; projectId: string; contactId: string; contactName: string; itemName: string },
) {
  const version = await tx.version.findUnique({ where: { id: args.versionId } });
  if (!version || version.status !== "APPROVED") return;

  await tx.version.update({
    where: { id: args.versionId },
    data: { status: "SENT_TO_CLIENT", approvedAt: null, approvedByContact: null },
  });

  const contact = await tx.clientContact.findUnique({ where: { id: args.contactId } });
  if (contact?.lastApprovedVersionId === args.versionId) {
    const earlier = await tx.version.findFirst({
      where: { projectId: args.projectId, status: "APPROVED", number: { lt: version.number } },
      orderBy: { number: "desc" },
      select: { id: true },
    });
    await tx.clientContact.update({
      where: { id: args.contactId },
      data: { lastApprovedVersionId: earlier?.id ?? null },
    });
  }

  const newest = await tx.version.findFirst({ where: { projectId: args.projectId }, orderBy: { number: "desc" } });
  if (newest?.id === args.versionId) {
    await tx.project.update({ where: { id: args.projectId }, data: { status: "SENT_TO_CLIENT" } });
  }

  await recordAudit(tx, {
    projectId: args.projectId,
    actorType: "SYSTEM",
    actorName: "Barebase BOQ Studio",
    action: `V${version.number} is no longer approved — ${args.contactName} raised an issue on ${args.itemName}`,
    detail: { versionId: args.versionId },
  });
}

export async function submitItemApproval(input: {
  token: string;
  versionId: string;
  lineItemId: string;
  status: ApprovalStatus;
  comment?: string;
}): Promise<ClientActionResult> {
  const access = await resolveClientAccess(input.token);
  if (!access) return { ok: false, error: "This link is no longer active." };

  const version = await prisma.version.findFirst({
    where: { id: input.versionId, projectId: access.project.id, status: { in: ["SENT_TO_CLIENT", "APPROVED"] } },
  });
  if (!version) return { ok: false, error: "That version isn't available for review." };

  const snapshot = parseSnapshot(version.snapshot);
  const item = snapshot.sections.flatMap((s) => s.items).find((i) => i.id === input.lineItemId);
  if (!item) return { ok: false, error: "That line item isn't part of this version." };

  const comment = input.comment?.trim() || null;
  const itemName = item.desc || "(untitled item)";

  await prisma.$transaction(async (tx) => {
    await tx.itemApproval.upsert({
      where: {
        versionId_contactId_lineItemId: {
          versionId: version.id,
          contactId: access.contact.id,
          lineItemId: input.lineItemId,
        },
      },
      create: {
        versionId: version.id,
        contactId: access.contact.id,
        lineItemId: input.lineItemId,
        lineItemName: item.desc,
        status: input.status,
        comment,
      },
      update: { status: input.status, comment, lineItemName: item.desc },
    });

    await recordAudit(tx, {
      projectId: access.project.id,
      actorType: "CLIENT",
      actorName: access.contact.name,
      action: `${approvalLabel(input.status)} — ${itemName}${comment ? `: “${comment}”` : ""}`,
      detail: { versionId: version.id, lineItemId: input.lineItemId, comment },
    });

    if (input.status === "REJECTED" || input.status === "REVISION_REQUESTED") {
      await unsettleVersionApproval(tx, {
        versionId: version.id,
        projectId: access.project.id,
        contactId: access.contact.id,
        contactName: access.contact.name,
        itemName,
      });
      return;
    }

    await settleVersionApproval(tx, {
      versionId: version.id,
      projectId: access.project.id,
      contactId: access.contact.id,
      contactName: access.contact.name,
      totalItems: countItems(snapshot),
    });
  });

  revalidatePath(`/c/${input.token}`);
  revalidatePath(`/projects/${access.project.id}`);
  revalidatePath(`/projects/${access.project.id}/review`);
  return { ok: true };
}

/**
 * Leave a note on a line without changing its verdict.
 *
 * A client should be able to flag something on an item they're otherwise happy
 * to approve — "fine, but can we see a sample first" — without that being read
 * as a rejection. Saving a note on an untouched line leaves it Pending rather
 * than quietly deciding for them.
 */
export async function submitItemComment(input: {
  token: string;
  versionId: string;
  lineItemId: string;
  comment: string;
}): Promise<ClientActionResult> {
  const access = await resolveClientAccess(input.token);
  if (!access) return { ok: false, error: "This link is no longer active." };

  const version = await prisma.version.findFirst({
    where: { id: input.versionId, projectId: access.project.id, status: { in: ["SENT_TO_CLIENT", "APPROVED"] } },
  });
  if (!version) return { ok: false, error: "That version isn't available for review." };

  const snapshot = parseSnapshot(version.snapshot);
  const item = snapshot.sections.flatMap((s) => s.items).find((i) => i.id === input.lineItemId);
  if (!item) return { ok: false, error: "That line item isn't part of this version." };

  const comment = input.comment.trim() || null;

  const existing = await prisma.itemApproval.findUnique({
    where: {
      versionId_contactId_lineItemId: {
        versionId: version.id,
        contactId: access.contact.id,
        lineItemId: input.lineItemId,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.itemApproval.upsert({
      where: {
        versionId_contactId_lineItemId: {
          versionId: version.id,
          contactId: access.contact.id,
          lineItemId: input.lineItemId,
        },
      },
      create: {
        versionId: version.id,
        contactId: access.contact.id,
        lineItemId: input.lineItemId,
        lineItemName: item.desc,
        status: "PENDING",
        comment,
      },
      update: { comment, lineItemName: item.desc },
    });

    await recordAudit(tx, {
      projectId: access.project.id,
      actorType: "CLIENT",
      actorName: access.contact.name,
      action: comment
        ? `Commented on ${item.desc || "(untitled item)"}: “${comment}”`
        : `Removed their note on ${item.desc || "(untitled item)"}`,
      detail: { versionId: version.id, lineItemId: input.lineItemId, comment },
    });
  });

  revalidatePath(`/c/${input.token}`);
  revalidatePath(`/projects/${access.project.id}`);
  revalidatePath(`/projects/${access.project.id}/review`);
  return { ok: true, status: existing?.status ?? "PENDING" };
}

export async function approveWholeVersion(input: {
  token: string;
  versionId: string;
}): Promise<ClientActionResult> {
  const access = await resolveClientAccess(input.token);
  if (!access) return { ok: false, error: "This link is no longer active." };

  const version = await prisma.version.findFirst({
    where: { id: input.versionId, projectId: access.project.id, status: { in: ["SENT_TO_CLIENT", "APPROVED"] } },
  });
  if (!version) return { ok: false, error: "That version isn't available for review." };

  const snapshot = parseSnapshot(version.snapshot);
  const items = snapshot.sections.flatMap((section) => section.items);
  if (items.length === 0) return { ok: false, error: "There's nothing to approve yet." };

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      projectId: access.project.id,
      actorType: "CLIENT",
      actorName: access.contact.name,
      action: `Approved all ${items.length} lines in one click`,
      detail: { versionId: version.id },
    });

    for (const item of items) {
      await tx.itemApproval.upsert({
        where: {
          versionId_contactId_lineItemId: {
            versionId: version.id,
            contactId: access.contact.id,
            lineItemId: item.id,
          },
        },
        create: {
          versionId: version.id,
          contactId: access.contact.id,
          lineItemId: item.id,
          lineItemName: item.desc,
          status: "APPROVED",
        },
        // "Approve the whole estimate" is an explicit, deliberate click, so it
        // does override a line they had previously rejected — and the audit
        // trail keeps both decisions.
        update: { status: "APPROVED", lineItemName: item.desc },
      });
    }

    await settleVersionApproval(tx, {
      versionId: version.id,
      projectId: access.project.id,
      contactId: access.contact.id,
      contactName: access.contact.name,
      totalItems: items.length,
    });
  });

  revalidatePath(`/c/${input.token}`);
  revalidatePath(`/projects/${access.project.id}`);
  revalidatePath(`/projects/${access.project.id}/review`);
  return { ok: true };
}

export async function recordClientView(token: string): Promise<void> {
  const access = await resolveClientAccess(token);
  if (!access) return;
  await prisma.clientContact.update({
    where: { id: access.contact.id },
    data: { lastViewedAt: new Date() },
  });
}
