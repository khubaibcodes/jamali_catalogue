/**
 * Session refresh and the gate on /admin.
 *
 * Next 16 renamed the `middleware` convention to `proxy` — this file would be
 * silently ignored if it were still called middleware.ts.
 *
 * Supabase access tokens are short-lived. Without a refresh on each request the
 * session dies mid-session and the manager starts throwing permission errors
 * that look like bugs. This is the only place cookies are written.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() revalidates against Supabase. getSession() only reads the cookie,
  // which a client could have tampered with, so it must not be trusted here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Match the /admin *route*, not merely the prefix. `startsWith("/admin")`
  // also swallowed /admin.webmanifest — which broke installing the admin PWA,
  // because the browser fetches the manifest and got a redirect to HTML.
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");

  if (!user && isAdminRoute) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    // Send them back where they were headed once they've signed in.
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (user && path === "/login") {
    const admin = request.nextUrl.clone();
    admin.pathname = "/admin";
    admin.search = "";
    return NextResponse.redirect(admin);
  }

  return response;
}

export const config = {
  // Skip static assets and image files; they don't need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)"],
};
