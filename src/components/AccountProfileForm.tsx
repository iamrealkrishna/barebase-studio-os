"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateOwnProfile, type ProfileState } from "@/actions/account";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary small" disabled={pending}>
      {pending ? "Saving…" : "Save details"}
    </button>
  );
}

export default function AccountProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateOwnProfile, {});

  return (
    <div className="settings-section">
      <h3>
        Your details <span className="note">— the name that goes on versions, audit entries and PDFs</span>
      </h3>

      {state.error ? <div className="flash err">{state.error}</div> : null}
      {state.ok ? <div className="flash ok">{state.ok}</div> : null}

      <form action={action}>
        <div className="inline-form">
          <div className="f">
            <label htmlFor="acc-name">Full name</label>
            <input id="acc-name" name="name" type="text" defaultValue={name} required autoComplete="name" />
          </div>
          <div className="f">
            <label htmlFor="acc-email">Email</label>
            <input id="acc-email" name="email" type="email" defaultValue={email} required autoComplete="email" />
          </div>
          <Submit />
        </div>
      </form>

      <p className="hint-text">
        Your email is also your sign-in — change it here and it&apos;s what you log in with next time. Your role and
        organisation aren&apos;t editable from this page; an admin sets those on the Team page.
      </p>
    </div>
  );
}
