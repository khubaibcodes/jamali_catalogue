"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { browserClient } from "@/lib/supabase/clients";
import { Field } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = browserClient();
    const { error: failure } = await supabase.auth.signInWithPassword({ email, password });

    if (failure) {
      // Deliberately vague: saying which half was wrong tells an attacker
      // whether an email is registered.
      setError("That email and password don't match.");
      setBusy(false);
      return;
    }

    // Refresh so the proxy and server components observe the new session.
    router.replace(params.get("next") || "/admin");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="wordmark text-2xl text-ink-800">{brand.name}</p>
          <div className="rule-amber mx-auto mt-3 w-40" />
          <p className="mt-3 text-[0.6875rem] uppercase tracking-[0.2em] text-amber-700">
            {brand.purpose}
          </p>
        </div>

        <form onSubmit={submit} className="plate p-6">
          <h1 className="mb-1 text-2xl">Sign in</h1>
          <p className="mb-5 text-sm text-shell-600">Staff access only.</p>

          <div className="space-y-4">
            <Field label="Email">
              {({ id }) => (
                <input
                  id={id}
                  type="email"
                  className="input"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>

            <Field label="Password">
              {({ id }) => (
                <input
                  id={id}
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  required
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

          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-shell-500">
          Accounts are created by the owner. There is no public sign-up.
        </p>

        {/* A customer who taps the footer link out of curiosity needs a way back. */}
        <p className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs tracking-[0.14em] text-shell-400 uppercase underline-offset-4 transition-colors hover:text-shell-600 hover:underline"
          >
            Back to the catalogue
          </Link>
        </p>
      </div>
    </main>
  );
}
