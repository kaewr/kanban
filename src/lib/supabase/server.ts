import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Supabase client for Server Components, Server Functions and Route Handlers.
// Acts as the signed-in user (session from cookies), so RLS applies.
export async function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();
  // Auth reads Date.now() (token expiry). With Cache Components that must never
  // happen during a prerender (incl. runtime prefetch), so wait for the real request.
  await connection();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by src/proxy.ts.
        }
      },
    },
  });
}
