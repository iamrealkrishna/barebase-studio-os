"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
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

// Your own password and profile live in src/actions/account.ts, alongside the
// rest of the account page — this file is organisation-wide settings only.
