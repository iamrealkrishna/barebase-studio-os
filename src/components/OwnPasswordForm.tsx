"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import { changeOwnPassword, type PasswordState } from "@/actions/account";
import PasswordInput from "@/components/PasswordInput";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary small" disabled={pending}>
      {pending ? "Saving…" : "Change password"}
    </button>
  );
}

/** Everyone can change their own password; managing other people lives on /team. */
export default function OwnPasswordForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<PasswordState, FormData>(async (prev, formData) => {
    const result = await changeOwnPassword(prev, formData);
    // Don't leave three filled password boxes sitting on screen after a success.
    if (result.ok) form.current?.reset();
    return result;
  }, {});

  return (
    <div className="settings-section">
      <h3>
        Your password <span className="note">— at least {MIN_PASSWORD_LENGTH} characters</span>
      </h3>

      {state.error ? <div className="flash err">{state.error}</div> : null}
      {state.ok ? <div className="flash ok">{state.ok}</div> : null}

      <form action={action} ref={form}>
        <div className="inline-form">
          <div className="f">
            <label htmlFor="pw-current">Current password</label>
            <PasswordInput id="pw-current" name="current" autoComplete="current-password" required />
          </div>
          <div className="f">
            <label htmlFor="pw-next">New password</label>
            <PasswordInput id="pw-next" name="next" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
          </div>
          <div className="f">
            <label htmlFor="pw-confirm">Confirm new password</label>
            <PasswordInput id="pw-confirm" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
          </div>
          <Submit />
        </div>
      </form>

      <p className="hint-text">
        Changing your password doesn&apos;t sign out sessions that are already open — those last 30 days from sign-in.
        If you think someone else is signed in as you, change it here and ask an admin to deactivate your account: that
        blocks every open session on the next request, and they can restore you straight after.
      </p>
    </div>
  );
}
