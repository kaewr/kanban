// BR-21 / BR-22 helpers. The internal email is never shown in the UI.

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const AUTH_EMAIL_DOMAIN = "kanban.local";

export function normalizeUsername(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function toAuthEmail(username: string): string {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}
