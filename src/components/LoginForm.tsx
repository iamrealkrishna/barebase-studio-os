"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type SignInState } from "@/actions/auth";
import PasswordInput from "@/components/PasswordInput";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" style={{ width: "100%", padding: "10px" }} disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form className="auth-card" action={formAction}>
      <div className="mark">BAREBASE</div>
      <div className="sub">BOQ Studio</div>

      {state.error ? <div className="auth-error">{state.error}</div> : null}

      <div className="auth-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>

      <SubmitButton />

      <p className="auth-note">
        Barebase team access only. Clients don&apos;t sign in — they get a project-specific link that opens a
        read-only view with no cost or margin data.
      </p>
    </form>
  );
}
