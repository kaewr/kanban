// Guard for scripts and test runners that create and delete users. They must only
// ever talk to the local Supabase stack (npm run db:start), never to production.
// Set ALLOW_REMOTE_TESTS=1 to override on purpose.
export function assertLocalSupabase(url: string | undefined): void {
  if (process.env.ALLOW_REMOTE_TESTS === "1") return;
  let host = "";
  try {
    host = new URL(url ?? "").hostname;
  } catch {
    // fall through to the error below
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not local (${host || "missing"}). ` +
        "Tests create and delete users, so they only run against `npm run db:start`.",
    );
  }
}
