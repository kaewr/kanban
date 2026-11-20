export const ROUTES = {
  login: "/login",
  changePassword: "/change-password",
  home: "/board",
  board: "/board",
  dashboard: "/dashboard",
  admin: "/admin",
  profile: "/profile",
} as const;

export const LOGIN_REASON_INACTIVE = "inactive";

/** Accept only same-origin relative paths to prevent open redirects. */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return ROUTES.home;
  }
  if (raw === ROUTES.login || raw.startsWith(`${ROUTES.login}?`) || raw === ROUTES.changePassword) {
    return ROUTES.home;
  }
  return raw;
}
