"use client";

/**
 * Setting a password against an invitation.
 *
 * The address is fixed by the invitation and is not editable — signing up as
 * someone else is the one thing this form must not allow. Everything that
 * decides access happens in the database: the sign-up trigger creates a profile
 * only when the new account's email matches a live invitation.
 *
 * Two routes lead here, and both are handled:
 *
 *  - No account yet. Sign up. If the project confirms addresses by email
 *    (it does), Supabase returns no session, so we say so plainly rather than
 *    bouncing them to a page they can't use yet.
 *  - An account already exists. The trigger never fires for them, so they sign
 *    in and `redeem_staff_invite` attaches the profile instead.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/clients";
import type { StaffRole } from "@/lib/supabase/database.types";
import { Field } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

const MIN_PASSWORD = 8;

type Mode = "new" | "existing";

export function JoinForm({
  token,
  email,
  fullName,
  role,
}: {
  token: string;
  email: string;
  fullName: string;
  role: StaffRole;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("new");
  const [name, setName] = useState(fullName);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "new" && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setBusy(true);
    const supabase = browserClient();

    if (mode === "existing") {
      const { error: failure } = await supabase.auth.signInWithPassword({ email, password });
      if (failure) {
        setError("That password doesn't match this address.");
        setBusy(false);
        return;
      }
      // The trigger only runs at sign-up, so an existing account claims its
      // invitation explicitly.
      const { error: redeem } = await supabase.rpc("redeem_staff_invite", { p_token: token });
      if (redeem) {
        setError(redeem.message || "This invitation is no longer valid.");
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
      return;
    }

    const { data, error: failure } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (failure) {
      // Supabase reports an existing address here; offer the other route
      // rather than leaving them stuck on a form that can't succeed.
      if (/already/i.test(failure.message)) {
        setMode("existing");
        setPassword("");
        setNotice("You already have an account with this address — sign in and it'll be linked.");
      } else {
        setError(failure.message);
      }
      setBusy(false);
      return;
    }

    if (data.session) {
      router.replace("/admin");
      router.refresh();
      return;
    }

    // Confirmation is on: the account exists and the invitation is already
    // attached, but there is no session until they click the emailed link.
    setNotice(
      `Account created. Check ${email} for a confirmation link, then sign in — your access is already set up.`,
    );
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="plate p-6">
      <h1 className="mb-1 text-2xl">{mode === "new" ? "Join the team" : "Sign in to join"}</h1>
      <p className="mb-5 text-sm leading-relaxed text-shell-600">
        {mode === "new" ? (
          <>
            You&apos;ve been invited to the {role === "owner" ? "owner" : "staff"} catalogue.
            Choose a password to finish.
          </>
        ) : (
          <>Sign in with your existing password and this invitation will be added to it.</>
        )}
      </p>

      <div className="space-y-4">
        <Field label="Email" hint="Fixed by the invitation.">
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              type="email"
              className="input bg-shell-100 text-shell-600"
              value={email}
              readOnly
              // Not merely readOnly: a disabled field wouldn't be submitted,
              // and the value is what the sign-up is keyed on.
              tabIndex={-1}
            />
          )}
        </Field>

        {mode === "new" && (
          <Field label="Your name">
            {({ id }) => (
              <input
                id={id}
                type="text"
                className="input"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        )}

        <Field
          label={mode === "new" ? "Choose a password" : "Your password"}
          hint={mode === "new" ? `At least ${MIN_PASSWORD} characters.` : undefined}
        >
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              type="password"
              className="input"
              autoComplete={mode === "new" ? "new-password" : "current-password"}
              required
              minLength={mode === "new" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger"
        >
          <Icon name="warning" size={15} />
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm leading-relaxed text-amber-900"
        >
          <Icon name="check" size={15} />
          <span>{notice}</span>
        </p>
      )}

      <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
        {busy ? "Working…" : mode === "new" ? "Create my account" : "Sign in and join"}
      </button>

      <p className="mt-4 text-center">
        <Link
          href="/"
          className="text-xs tracking-[0.14em] text-shell-400 uppercase underline-offset-4 transition-colors hover:text-shell-600 hover:underline"
        >
          Back to the catalogue
        </Link>
      </p>
    </form>
  );
}
