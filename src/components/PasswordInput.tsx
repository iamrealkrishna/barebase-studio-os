"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * The same eye with a slash through it. Drawing the full eye and one clean
 * diagonal reads better at 16px than breaking the outline into arcs, which
 * turns to mush at this size.
 */
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <path d="M3.6 16.4 16.4 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A password box with the usual show/hide eye.
 *
 * Masked by default everywhere, including the admin's "set someone's initial
 * password" fields on the Team page, which used to be plain `type="text"` —
 * a password shouldn't sit readable on a screen someone else can see, and the
 * toggle gives it back the moment it's actually needed.
 *
 * The button is explicitly `type="button"`: inside a form, the default
 * `submit` would sign you in every time you tried to peek at what you typed.
 */
export default function PasswordInput({
  id,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  return (
    <span className="pw-wrap">
      <input {...props} id={inputId} type={shown ? "text" : "password"} className={className} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((v) => !v)}
        aria-controls={inputId}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        title={shown ? "Hide password" : "Show password"}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </span>
  );
}
