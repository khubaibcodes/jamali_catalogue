/**
 * Supabase clients.
 *
 * The publishable key is safe in the browser: it grants exactly what row level
 * security allows, which for a signed-out visitor is the published catalogue
 * and nothing more. Trade rates are unreachable with it regardless of what the
 * client asks for.
 */

import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill it in.",
    );
  }
  return { url, key };
}

/**
 * For the public shopfront. Deliberately ignores cookies.
 *
 * Two reasons, both learned the hard way:
 *
 *  1. A stale or invalid session cookie — a signed-out staff member, a deleted
 *     account, an expired token — makes Postgrest reject the request, and the
 *     catalogue renders completely empty for that visitor.
 *  2. Reading cookies makes the response vary per visitor, which is at odds
 *     with caching a page that is identical for everyone.
 *
 * Public pages only ever show published rows, so there is nothing a session
 * could usefully add.
 */
export function anonClient() {
  const { url, key } = config();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** For client components. Reads and writes the session cookie. */
export function browserClient() {
  const { url, key } = config();
  return createBrowserClient<Database>(url, key);
}

/**
 * For server components, route handlers and server actions.
 *
 * `cookies()` is async in Next 16, so this is too. Server components may not
 * write cookies, hence the swallowed setAll — the proxy refreshes the session
 * instead, and that's the only place it needs to happen.
 */
export async function serverClient() {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const { url, key } = config();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only.
        }
      },
    },
  });
}
