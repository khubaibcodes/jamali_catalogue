import { redirect } from "next/navigation";

/**
 * Phase 3 turns this into the public customer catalogue. Until then the only
 * surface is the manager, so send people straight there.
 */
export default function Page() {
  redirect("/admin");
}
