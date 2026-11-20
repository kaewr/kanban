import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";
import { LOGIN_REASON_INACTIVE, ROUTES } from "@/lib/routes";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session and enforces the auth gates:
 * - not signed in            -> /login?next=...
 * - no profile / inactive    -> sign out, /login?reason=inactive  (BR-26, FR-06)
 * - signed in on /login      -> /board
 * must_change_password only shows a warning banner (FR-02, changed 2026-11-20).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims (session refresh).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === ROUTES.login;

  // Redirect while keeping any refreshed/cleared auth cookies.
  const redirectTo = (path: string, params?: Record<string, string>): NextResponse => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    for (const [key, value] of Object.entries(params ?? {})) {
      target.searchParams.set(key, value);
    }
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  // API routes only get the session refresh; they check auth themselves and answer 401/403.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (!userId) {
    if (isLogin) return response;
    return redirectTo(ROUTES.login, pathname === "/" ? undefined : { next: `${pathname}${search}` });
  }

  // RLS returns no row when the account is inactive.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Transient failure: let the request through; pages re-check and RLS still applies.
    return response;
  }

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    return redirectTo(ROUTES.login, { reason: LOGIN_REASON_INACTIVE });
  }

  if (isLogin) {
    return redirectTo(ROUTES.home);
  }

  return response;
}
