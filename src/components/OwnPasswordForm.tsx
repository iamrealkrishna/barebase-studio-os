"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changeOwnPassword, type PasswordState } from "@/actions/org";

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
  const [state, action] = useActionState<PasswordState, FormData>(changeOwnPassword, {});

  return (
    <div className="settings-section">
      <h3>Your password</h3>
      {state.error ? <div className="flash err">{state.error}</div> : null}
      {state.ok ? <div className="flash ok">{state.ok}</div> : null}
      <form action={action}>
        <div className="inline-form">
          <div className="f">
            <label htmlFor="pw-current">Current password</label>
            <input id="pw-current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div className="f">
            <label htmlFor="pw-next">New password</label>
            <input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <Submit />
        </div>
      </form>
    </div>
  );
}
