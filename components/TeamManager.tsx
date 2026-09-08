"use client";

/**
 * The owner's view of who can get into the catalogue.
 *
 * Invitations are created here and handed over as a link. There is no email
 * sending: this app holds no service-role key and no mail credentials, and
 * Supabase's built-in mailer is rate-limited to a handful of messages an hour —
 * quietly failing to deliver an invitation would be worse than not pretending
 * to send one. The owner copies the link and passes it on however they already
 * talk to their staff.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import {
  createInvite,
  inviteLink,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  setMemberRole,
  type Invite,
  type InviteState,
  type Member,
} from "@/lib/invites";
import { browserClient } from "@/lib/supabase/clients";
import type { StaffRole } from "@/lib/supabase/database.types";
import type { Session } from "@/lib/types";
import { useToast } from "@/hooks/useToast";
import { ConfirmDialog, EmptyState, Field, ToastHost } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

const STATE_LABEL: Record<InviteState, string> = {
  pending: "Waiting to be used",
  accepted: "Joined",
  revoked: "Cancelled",
  expired: "Expired",
};

const STATE_STYLE: Record<InviteState, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-shell-100 text-shell-600",
  revoked: "bg-shell-100 text-shell-500",
  expired: "bg-shell-100 text-shell-500",
};

export function TeamManager({ session }: { session: Session }) {
  const { toast, show, dismiss, attempt } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);

  /** The invitation just created, kept up so its link can be copied. */
  const [fresh, setFresh] = useState<Invite | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "revoke"; id: string; who: string } | { kind: "remove"; id: string; who: string } | null
  >(null);

  const load = useCallback(async () => {
    const supabase = browserClient();
    const [nextMembers, nextInvites] = await Promise.all([
      listMembers(supabase),
      listInvites(supabase),
    ]);
    setMembers(nextMembers);
    setInvites(nextInvites);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (live) show(e instanceof Error ? e.message : "Couldn't load the team.", "error");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [load, show]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    await attempt(async () => {
      const created = await createInvite(browserClient(), { email, fullName, role });
      setFresh(created);
      setEmail("");
      setFullName("");
      setRole("staff");
      await load();
    }, "Invitation created — copy the link below.");
    setBusy(false);
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      show("Link copied.", "success");
    } catch {
      show("Couldn't copy — select the link and copy it by hand.", "error");
    }
  }

  const pending = invites.filter((i) => i.state === "pending");
  const past = invites.filter((i) => i.state !== "pending");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-shell-200 bg-shell-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <div className="flex-1">
            <p className="wordmark text-lg text-ink-800 sm:text-xl">{brand.name}</p>
            <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.2em] text-amber-700">
              Team
            </p>
          </div>
          <Link href="/admin" className="btn btn-quiet btn-sm">
            <Icon name="chevron" size={15} />
            <span className="max-sm:sr-only">Back to the catalogue</span>
          </Link>
        </div>
        <div className="rule-amber" />
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        {/* ------------------------------------------------------- invite */}
        <section className="plate p-6">
          <h1 className="text-2xl">Invite someone</h1>
          <p className="mt-1 text-sm leading-relaxed text-shell-600">
            They&apos;ll set their own password. Staff can add and edit articles; they can never
            see wholesale or reseller rates, and they can&apos;t delete anything.
          </p>

          <form onSubmit={invite} className="mt-5 space-y-4">
            <Field label="Email address" hint="They must sign up with this exact address.">
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  type="email"
                  className="input"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>

            <Field label="Name" hint="Optional — shown in the team list.">
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  type="text"
                  className="input"
                  autoComplete="off"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              )}
            </Field>

            <Field label="Access">
              {({ id }) => (
                <select
                  id={id}
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                >
                  <option value="staff">Staff — add and edit articles</option>
                  <option value="owner">Owner — everything, including rates</option>
                </select>
              )}
            </Field>

            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              <Icon name="plus" size={16} />
              {busy ? "Creating…" : "Create invitation"}
            </button>
          </form>

          {fresh && (
            <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-800">
                Send this link to {fresh.email}
              </p>
              <p className="mt-2 break-all rounded bg-white/70 p-2 font-mono text-xs text-ink-800">
                {inviteLink(window.location.origin, fresh.token)}
              </p>
              <button
                type="button"
                className="btn btn-amber btn-sm mt-3"
                onClick={() => void copy(inviteLink(window.location.origin, fresh.token))}
              >
                <Icon name="copy" size={15} />
                Copy link
              </button>
              <p className="mt-2 text-xs text-amber-800">
                Anyone who opens it can only join as {fresh.email} — it&apos;s useless to anyone
                else. It expires in 14 days.
              </p>
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- people */}
        <section className="mt-8">
          <h2 className="text-lg">Who has access</h2>
          {loading ? (
            <p className="mt-3 text-sm text-shell-500">Loading…</p>
          ) : (
            <ul className="mt-3 divide-y divide-shell-200 rounded-xl border border-shell-200 bg-white">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-800">
                      {member.fullName || member.email || "Unnamed"}
                      {member.id === session.userId && (
                        <span className="ml-2 text-xs text-shell-500">(you)</span>
                      )}
                    </p>
                    {member.email && member.fullName && (
                      <p className="truncate text-xs text-shell-500">{member.email}</p>
                    )}
                  </div>

                  {/* An owner may not demote or remove themselves — that is the
                      one action that could leave the shop with no owner at all. */}
                  {member.id === session.userId ? (
                    <span className="rounded-full bg-shell-100 px-2.5 py-1 text-xs text-shell-600">
                      {member.role}
                    </span>
                  ) : (
                    <>
                      <select
                        className="input h-9 w-auto py-0 text-xs"
                        aria-label={`Access for ${member.fullName || member.email || "this person"}`}
                        value={member.role}
                        onChange={(e) =>
                          void attempt(async () => {
                            await setMemberRole(
                              browserClient(),
                              member.id,
                              e.target.value as StaffRole,
                            );
                            await load();
                          }, "Access updated.")
                        }
                      >
                        <option value="staff">Staff</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setConfirm({
                            kind: "remove",
                            id: member.id,
                            who: member.fullName || member.email || "this person",
                          })
                        }
                      >
                        <Icon name="trash" size={15} />
                        <span className="sr-only">Remove access</span>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------------ invites */}
        <section className="mt-8">
          <h2 className="text-lg">Invitations</h2>

          {!loading && pending.length === 0 && past.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon="sparkle"
                title="No invitations yet"
                body="Invite someone above and hand them the link."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-shell-200 rounded-xl border border-shell-200 bg-white">
              {[...pending, ...past].map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-800">{entry.email}</p>
                    <p className="text-xs text-shell-500">
                      {entry.role === "owner" ? "Owner" : "Staff"}
                      {entry.state === "pending" &&
                        ` · expires ${new Date(entry.expires_at).toLocaleDateString("en-GB")}`}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${STATE_STYLE[entry.state]}`}
                  >
                    {STATE_LABEL[entry.state]}
                  </span>

                  {entry.state === "pending" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => void copy(inviteLink(window.location.origin, entry.token))}
                      >
                        <Icon name="copy" size={15} />
                        <span className="max-sm:sr-only">Copy link</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setConfirm({ kind: "revoke", id: entry.id, who: entry.email })
                        }
                      >
                        <Icon name="close" size={15} />
                        <span className="sr-only">Cancel invitation</span>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "remove" ? "Remove access?" : "Cancel invitation?"}
        body={
          confirm?.kind === "remove"
            ? `${confirm.who} will be signed out of the catalogue and won't be able to get back in. Their login still exists, but it can no longer see anything.`
            : `The link sent to ${confirm?.who ?? ""} will stop working. You can invite them again afterwards.`
        }
        confirmLabel={confirm?.kind === "remove" ? "Remove" : "Cancel it"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const target = confirm;
          setConfirm(null);
          if (!target) return;
          void attempt(
            async () => {
              const supabase = browserClient();
              if (target.kind === "remove") await removeMember(supabase, target.id);
              else await revokeInvite(supabase, target.id);
              await load();
            },
            target.kind === "remove" ? "Access removed." : "Invitation cancelled.",
          );
        }}
      />

      <ToastHost toast={toast} onDismiss={dismiss} />
    </div>
  );
}
