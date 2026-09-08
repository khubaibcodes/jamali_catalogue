import Link from "next/link";
import type { Metadata } from "next";
import { JoinForm } from "@/components/JoinForm";
import { brand } from "@/lib/brand";
import { anonClient } from "@/lib/supabase/clients";

export const metadata: Metadata = {
  title: "Join · JAMAALI",
  robots: { index: false, follow: false },
};

/** The invitation is checked on every visit; nothing here may be cached. */
export const dynamic = "force-dynamic";

/**
 * Accepting an invitation.
 *
 * Public by design — the invitee has no account yet, so this cannot sit behind
 * the /admin gate. What it shows comes from `invite_preview`, a security
 * definer function that returns the invited address and nothing else, and only
 * for a token that is still live. The invites table itself stays unreadable to
 * anyone but an owner.
 *
 * Knowing the token is not what grants access. The address does: a profile is
 * only ever created for a sign-up whose email matches the invitation, so a
 * forwarded link is useless to anyone who can't receive mail there.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  // Route params are Promises in Next 16.
  const { token } = await params;

  const supabase = anonClient();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const invite = data?.[0] ?? null;

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

        {invite ? (
          <JoinForm
            token={token}
            email={invite.email}
            fullName={invite.full_name}
            role={invite.role}
          />
        ) : (
          <div className="plate p-6 text-center">
            <h1 className="text-2xl">This invitation isn&apos;t valid</h1>
            <p className="mt-2 text-sm leading-relaxed text-shell-600">
              It may have expired, been cancelled, or already been used. Ask the owner to send
              you a new link.
            </p>
            <Link href="/" className="btn btn-quiet mt-6 w-full">
              Back to the catalogue
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
