import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CatalogueManager } from "@/components/CatalogueManager";
import { currentSession } from "@/lib/session";

// Staff tooling has no business in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The session is read per request; nothing here may be cached across users.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await currentSession();
  // The proxy already gated this route; this is the belt to its braces, and
  // narrows the type for everything below.
  if (!session) redirect("/login");

  return <CatalogueManager session={session} />;
}
