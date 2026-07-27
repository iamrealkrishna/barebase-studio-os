"use server";

import { revalidatePath } from "next/cache";

import { hashPassword, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type OrgFormState = { ok?: string; error?: string };

export async function updateOrganisation(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only an admin can change organisation settings." };

  await prisma.organization.update({
    where: { id: user.orgId },
    data: {
      name: String(formData.get("name") ?? "").trim() || "Barebase",
      legalName: String(formData.get("legalName") ?? "").trim(),
      addressLine: String(formData.get("addressLine") ?? "").trim(),
      pocName: String(formData.get("pocName") ?? "").trim(),
      pocPhone: String(formData.get("pocPhone") ?? "").trim(),
      pocEmail: String(formData.get("pocEmail") ?? "").trim(),
      terms: String(formData.get("terms") ?? ""),
    },
  });

  revalidatePath("/settings");
  return { ok: "Letterhead and default terms saved." };
}

export async function addTeamMember(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only an admin can add team members." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";

  if (!email || !name) return { error: "Name and email are both required." };
  if (password.length < 8) return { error: "Give them a starting password of at least 8 characters." };

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash) return { error: "Someone already uses that email address." };

  await prisma.user.create({
    data: { orgId: user.orgId, email, name, role, passwordHash: await hashPassword(password) },
  });

  revalidatePath("/settings");
  return { ok: `${name} can now sign in with ${email}.` };
}

export async function removeTeamMember(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;

  const id = String(formData.get("userId") ?? "");
  // Never let an admin lock themselves out of their own org.
  if (id === user.id) return;

  await prisma.user.deleteMany({ where: { id, orgId: user.orgId } });
  revalidatePath("/settings");
}

export type PasswordState = { ok?: string; error?: string };

export async function changeOwnPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { error: "Could not find your account." };

  const { verifyPassword } = await import("@/lib/auth");
  if (!(await verifyPassword(current, record.passwordHash))) {
    return { error: "Your current password isn't right." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: "Password updated." };
}
