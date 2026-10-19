import { redirect } from "next/navigation";

import LoginForm from "@/components/LoginForm";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/projects");

  return (
    <div className="auth-wrap">
      <LoginForm />
    </div>
  );
}
