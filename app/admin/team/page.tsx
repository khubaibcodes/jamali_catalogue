import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TeamManager } from "@/components/TeamManager";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Team · JAMAALI Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await currentSession();
  if (!session) redirect("/login?next=/admin/team");

  // Owners only. The database says the same thing — the invites table has a
  // single policy and it requires is_owner() — so a staff member who reached
  // this URL would see an empty page anyway. Redirecting is simply the honest
  // version of that.
  if (session.role !== "owner") redirect("/admin");

  return <TeamManager session={session} />;
}
