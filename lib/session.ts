/**
 * Who is signed in, and what they may do.
 *
 * Role comes from the profiles table rather than anything the client sends, so
 * a tampered cookie can't grant rate access. The database enforces this
 * independently — these flags only decide what the interface bothers to show.
 */

import { serverClient } from "./supabase/clients";
import type { Session } from "./types";

export async function currentSession(): Promise<Session | null> {
  const supabase = await serverClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  /**
   * No profile means not staff — signed in, but not a member of this shop.
   *
   * This used to fall back to "staff", which was the wrong half of the
   * question: a profile row is precisely what is_staff() tests, so anyone who
   * could create an account was treated as staff by the interface. Sign-ups
   * are open on the Supabase project, so that was reachable by anybody. The
   * database now refuses to hand out a profile without an invitation, and this
   * returns null so the admin pages send the account straight back out.
   */
  if (!profile) return null;
  const role = profile.role;

  return {
    userId: user.id,
    email: user.email ?? "",
    role,
    canSeeTradeRates: role === "owner",
    canDelete: role === "owner",
  };
}
