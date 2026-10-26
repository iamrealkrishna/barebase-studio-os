"use server";

import { revalidatePath } from "next/cache";

import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export type ProfileState = { ok?: string; error?: string };

/**
 * Edit your own name and email.
 *
 * Email is the sign-in identity, so it's unique across the whole install and
 * changing it changes what you log in with — worth saying out loud rather than
 * letting someone lock themselves out by accident. Role and organisation are
 * deliberately not editable here: nobody promotes themselves.
 */
export async function updateOwnProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) return { error: "Your name can't be blank." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That doesn't look like an email address." };

  if (email !== user.email.toLowerCase()) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== user.id) return { error: "Another account already uses that email." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name, email } });

  // The name is rendered in the top bar and stamped onto versions and audit
  // entries from here on, so every route wants the new value.
  revalidatePath("/", "layout");

  return {
    ok:
      email === user.email.toLowerCase()
        ? "Profile updated."
        : `Profile updated — sign in with ${email} from now on.`,
  };
}

export type PasswordState = { ok?: string; error?: string };

/** Everyone can change their own password; managing other people lives on /team. */
export async function changeOwnPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (confirm !== next) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "That's the password you already have." };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { error: "Could not find your account." };

  if (!(await verifyPassword(current, record.passwordHash))) {
    return { error: "Your current password isn't right." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: "Password updated." };
}
