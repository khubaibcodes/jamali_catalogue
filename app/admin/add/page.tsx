import { redirect } from "next/navigation";
import { QuickAdd } from "@/components/QuickAdd";
import { currentSession } from "@/lib/session";

// Reads the session per request; nothing here may be cached across users.
export const dynamic = "force-dynamic";

export default async function QuickAddPage() {
  // proxy.ts already gates /admin/*. This is the belt to its braces, and it
  // narrows the type so QuickAdd always receives a real session.
  const session = await currentSession();
  if (!session) redirect("/login?next=/admin/add");

  return <QuickAdd session={session} />;
}
