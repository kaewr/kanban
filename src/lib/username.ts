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

/**
 * People log in by picking their Thai name (BR-20), so the username is internal only.
 * New accounts get a random one that satisfies BR-22, e.g. "u_3f9a1c7b".
 */
export function generateUsername(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `u_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
