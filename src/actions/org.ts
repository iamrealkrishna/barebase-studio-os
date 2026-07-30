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
