"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@prisma/client";

import { hashPassword, requireAdmin, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export type TeamFormState = { ok?: string; error?: string };

/** Guard against an org ending up with nobody who can administer it. */
async function otherActiveAdminCount(orgId: string, excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: { orgId, role: "ADMIN", active: true, id: { not: excludeUserId } },
  });
}

async function findMember(admin: SessionUser, formData: FormData): Promise<User | null> {
  const userId = String(formData.get("userId") ?? "");
  return prisma.user.findFirst({ where: { id: userId, orgId: admin.orgId } });
}

/**
 * Add a team member by setting their password directly.
 *
 * There's no mail transport yet, so an invite flow would have nowhere to send
 * to. The admin hands over the email and password out of band, which is still a
 * long way better than the whole team sharing one login.
 */
async function addMember(admin: SessionUser, formData: FormData): Promise<TeamFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";

  if (!name) return { error: "Name is required." };
  if (!email) return { error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That doesn't look like an email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Set a starting password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing.orgId === admin.orgId && !existing.active
      ? { error: `${existing.name} already exists but is deactivated — restore their access instead.` }
      : { error: "Someone already uses that email address." };
  }

  await prisma.user.create({
    data: { orgId: admin.orgId, email, name, role, passwordHash: await hashPassword(password) },
  });

  return { ok: `${name} can sign in with ${email} and the password you set.` };
}

async function changeRole(admin: SessionUser, formData: FormData): Promise<TeamFormState> {
  const role = String(formData.get("role") ?? "") === "ADMIN" ? "ADMIN" : "MEMBER";
  const target = await findMember(admin, formData);
  if (!target) return { error: "That team member no longer exists." };

  if (target.role === role) {
    return { ok: `${target.name} is already ${role === "ADMIN" ? "an Admin" : "a Team Member"}.` };
  }

  if (role === "MEMBER" && (await otherActiveAdminCount(admin.orgId, target.id)) === 0) {
    return {
      error:
        target.id === admin.id
          ? "You're the only Admin — promote someone else before demoting yourself."
          : `${target.name} is the only Admin left. Promote someone else first.`,
    };
  }

  await prisma.user.update({ where: { id: target.id }, data: { role } });

  return {
    ok:
      role === "ADMIN"
        ? `${target.name} is now an Admin and can edit the rate card.`
        : `${target.name} is now a Team Member.`,
  };
}

async function changeActive(admin: SessionUser, formData: FormData): Promise<TeamFormState> {
  const active = String(formData.get("active") ?? "") === "true";
  const target = await findMember(admin, formData);
  if (!target) return { error: "That team member no longer exists." };

  if (!active) {
    if (target.id === admin.id) return { error: "You can't deactivate your own account." };
    if (target.role === "ADMIN" && (await otherActiveAdminCount(admin.orgId, target.id)) === 0) {
      return { error: `${target.name} is the only other Admin — promote someone else first.` };
    }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { active, deactivatedAt: active ? null : new Date() },
  });

  return {
    ok: active
      ? `${target.name} can sign in again.`
      : `${target.name} can no longer sign in. Their projects, versions and audit history are untouched.`,
  };
}

async function resetPassword(admin: SessionUser, formData: FormData): Promise<TeamFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const target = await findMember(admin, formData);
  if (!target) return { error: "That team member no longer exists." };

  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(password) } });
  return { ok: `${target.name}'s password has been reset. Pass it on to them directly.` };
}

/**
 * Single entry point for every Team page mutation, dispatched on `intent`.
 *
 * One action means one piece of form state and therefore one message on screen:
 * with a hook per action, each kept its own last result, so promoting someone
 * left the "they can sign in with…" notice from adding them still sitting there
 * next to the new one.
 */
export async function teamAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const admin = await requireAdmin();
  const intent = String(formData.get("intent") ?? "");

  let result: TeamFormState;
  switch (intent) {
    case "add":
      result = await addMember(admin, formData);
      break;
    case "role":
      result = await changeRole(admin, formData);
      break;
    case "active":
      result = await changeActive(admin, formData);
      break;
    case "password":
      result = await resetPassword(admin, formData);
      break;
    default:
      return { error: "Unrecognised action." };
  }

  if (result.ok) revalidatePath("/team");
  return result;
}
