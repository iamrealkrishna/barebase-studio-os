"use server";

import { redirect } from "next/navigation";

import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message either way — don't leak which addresses exist.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match." };
  }

  await createSession(user.id);
  redirect("/projects");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
