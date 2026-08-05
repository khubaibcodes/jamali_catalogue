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

  // No profile yet means the sign-up trigger hasn't run. Treat that as the
  // least privilege we have rather than assuming anything.
  const role = profile?.role ?? "staff";

  return {
    userId: user.id,
    email: user.email ?? "",
    role,
    canSeeTradeRates: role === "owner",
    canDelete: role === "owner",
  };
}
