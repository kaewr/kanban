export const ROUTES = {
  login: "/login",
  home: "/board",
  board: "/board",
  dashboard: "/dashboard",
  admin: "/admin",
  adminUsers: "/admin/users",
  adminCategories: "/admin/categories",
  adminSettings: "/admin/settings",
  profile: "/profile",
} as const;

export const LOGIN_REASON_INACTIVE = "inactive";

/** Board URL (FR-11, FR-12). `user` is left out for the viewer's own board. */
export function boardHref({ user, year }: { user?: string; year?: number }): string {
  const params = new URLSearchParams();
  if (user) params.set("user", user);
  if (year !== undefined) params.set("year", String(year));
  const query = params.toString();
  return query ? `${ROUTES.board}?${query}` : ROUTES.board;
}

/** Accept only same-origin relative paths to prevent open redirects. */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return ROUTES.home;
  }
  if (raw === ROUTES.login || raw.startsWith(`${ROUTES.login}?`)) {
    return ROUTES.home;
  }
  return raw;
}
