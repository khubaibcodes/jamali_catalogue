/**
 * Staff invitations, from the owner's side.
 *
 * An owner invites an address; the database issues a token; the owner passes on
 * the resulting link. The invitee sets their own password at /join/<token> and
 * a profile is created for them by the sign-up trigger — see
 * supabase/migrations/0006_staff_invites.sql, which is where the actual rules
 * live. Nothing here grants access; it only creates and cancels invitations.
 *
 * Every query in this file reads zero rows for a staff session. The invites
 * table has one policy and it requires is_owner(), so this is safe to call
 * without checking the role first — though the UI checks anyway, to show
 * something honest rather than an empty page.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, InviteRow, ProfileRow } from "./supabase/database.types";
import type { StaffRole } from "./supabase/database.types";

type Client = SupabaseClient<Database>;

export type InviteState = "pending" | "accepted" | "revoked" | "expired";

export interface Invite extends InviteRow {
  state: InviteState;
}

/** A member of the shop, with their address when we know it. */
export interface Member {
  id: string;
  fullName: string;
  role: StaffRole;
  /** Known only for people who joined through an invitation. */
  email: string | null;
  joinedAt: number;
}

export function inviteState(row: InviteRow, now: number = Date.now()): InviteState {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (Date.parse(row.expires_at) <= now) return "expired";
  return "pending";
}

/** The link to hand to the invitee. */
export function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/join/${token}`;
}

export async function listInvites(supabase: Client): Promise<Invite[]> {
  const { data, error } = await supabase
    .from("staff_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw describe(error, "load the invitations");
  return (data ?? []).map((row) => ({ ...row, state: inviteState(row) }));
}

export async function listMembers(supabase: Client): Promise<Member[]> {
  const [profiles, invites] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("staff_invites").select("email, accepted_by").not("accepted_by", "is", null),
  ]);

  if (profiles.error) throw describe(profiles.error, "load the team");

  // profiles holds no email — auth.users isn't readable from the client. For
  // anyone who joined by invitation the address is on their invite, which is
  // enough to tell two people apart in the list.
  const emailFor = new Map<string, string>();
  for (const row of invites.data ?? []) {
    if (row.accepted_by) emailFor.set(row.accepted_by, row.email);
  }

  return (profiles.data ?? []).map((row: ProfileRow) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    email: emailFor.get(row.id) ?? null,
    joinedAt: Date.parse(row.created_at),
  }));
}

export async function createInvite(
  supabase: Client,
  input: { email: string; fullName: string; role: StaffRole },
): Promise<Invite> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("An email address is required.");

  const { data, error } = await supabase
    .from("staff_invites")
    .insert({
      email,
      full_name: input.fullName.trim(),
      role: input.role,
      // The token and expiry are the database's to set, not the browser's.
    })
    .select("*")
    .single();

  if (error) throw describe(error, "create the invitation");
  return { ...data, state: inviteState(data) };
}

/**
 * Cancels an invitation that hasn't been used.
 *
 * Revoking rather than deleting keeps the record of who was invited and when.
 * The partial unique index only counts live invitations, so the same address
 * can be invited again straight afterwards.
 */
export async function revokeInvite(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase
    .from("staff_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null);

  if (error) throw describe(error, "cancel the invitation");
}

export async function setMemberRole(
  supabase: Client,
  id: string,
  role: StaffRole,
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw describe(error, "change that role");
}

/**
 * Removes someone's access.
 *
 * This deletes their profile, not their login. Deleting an auth user needs the
 * service role key, which this app deliberately does not hold — and it isn't
 * needed, because a login without a profile can read nothing: is_staff() is
 * false, every policy denies it, and the admin pages turn it away.
 */
export async function removeMember(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw describe(error, "remove that person");
}

function describe(error: { code?: string; message: string }, action: string): Error {
  if (error.code === "23505") {
    return new Error("That address already has an invitation waiting.");
  }
  if (error.code === "42501" || error.code === "PGRST301") {
    return new Error("Only the owner can manage the team.");
  }
  return new Error(`Couldn't ${action}. ${error.message}`);
}
