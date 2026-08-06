"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { openWithEmail, openWithPass, type GateResult } from "@/actions/client-portal";
import ClientPortal from "@/components/ClientPortal";

const passKey = (token: string) => `bb_client_pass_${token}`;

function readPass(token: string): string | null {
  try {
    return window.localStorage.getItem(passKey(token));
  } catch {
    // Private browsing with storage blocked — the email check just runs again.
    return null;
  }
}

function writePass(token: string, pass: string) {
  try {
    window.localStorage.setItem(passKey(token), pass);
  } catch {
    // Not being able to remember is survivable; failing the visit isn't.
  }
}

function clearPass(token: string) {
  try {
    window.localStorage.removeItem(passKey(token));
  } catch {
    /* nothing to do */
  }
}

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="mark">{title}</div>
        <div className="sub">{sub}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * Stands in front of the estimate and asks for the email the link was sent to.
 *
 * This is a check, not a login — anyone holding both the link and the address
 * still gets in. What it buys is that a link forwarded on to someone else
 * doesn't just open for them. Proper protection is a one-time code emailed to
 * the contact, which needs email sending the app doesn't have yet.
 *
 * The estimate itself is never rendered into the page server-side; it's fetched
 * only after the check passes, so an unverified visitor never receives it.
 */
export default function ClientGate({ token }: { token: string }) {
  const [result, setResult] = useState<GateResult | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  const adopt = useCallback(
    (next: GateResult) => {
      if ((next.state === "open" || next.state === "not-ready") && next.pass) writePass(token, next.pass);
      setResult(next);
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await openWithPass(token, readPass(token));
      if (cancelled) return;
      // A stored pass that no longer works — a reissued link, or an expired one.
      if (next.state === "locked") clearPass(token);
      setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startCheck(async () => {
      const next = await openWithEmail(token, email);
      if (next.state === "invalid") {
        setError("This link isn't valid for that email.");
        return;
      }
      adopt(next);
    });
  };

  if (result === null) {
    return (
      <Shell title="BAREBASE" sub="Estimate">
        <p className="auth-note" style={{ marginTop: 0 }}>
          Opening your estimate…
        </p>
      </Shell>
    );
  }

  if (result.state === "invalid") {
    return (
      <Shell title="BAREBASE" sub="Estimate">
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          This review link isn&apos;t active any more. Please ask your Barebase contact for a fresh one.
        </p>
      </Shell>
    );
  }

  if (result.state === "not-ready") {
    return (
      <Shell title={result.orgName.toUpperCase()} sub="Estimate">
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          Hi {result.contactName} — your estimate for {result.projectName} isn&apos;t ready to review yet.
          You&apos;ll get an update as soon as it is.
        </p>
      </Shell>
    );
  }

  if (result.state === "locked") {
    return (
      <Shell title={result.orgName.toUpperCase()} sub="Estimate">
        <p className="auth-note" style={{ marginTop: 0, marginBottom: 16 }}>
          To open this estimate, confirm the email address it was sent to.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="gate-email">Your email</label>
            <input
              id="gate-email"
              type="email"
              autoFocus
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%", padding: 10 }} disabled={checking}>
            {checking ? "Checking…" : "Open my estimate"}
          </button>
        </form>

        <p className="auth-note">
          We&apos;ll remember this browser for 30 days so you don&apos;t have to type it again. If your email
          isn&apos;t recognised, ask your Barebase contact to check which address the link was sent to.
        </p>
      </Shell>
    );
  }

  const { estimate } = result;
  return (
    <ClientPortal
      token={token}
      pass={readPass(token)}
      versionId={estimate.versionId}
      contactName={estimate.contactName}
      snapshot={estimate.snapshot}
      letterhead={estimate.letterhead}
      baselineSnapshot={estimate.baselineSnapshot}
      alreadyApproved={estimate.alreadyApproved}
      initialApprovals={estimate.approvals}
      onExpired={() => {
        clearPass(token);
        setResult({ state: "locked", orgName: estimate.letterhead.name });
      }}
    />
  );
}
