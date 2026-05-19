export const APP_AUTH_COOKIE_NAME = "practice_loop_session";

const TOKEN_PREFIX = "practice-loop-session-v1";

export function isAppAuthEnabled() {
  return Boolean(process.env.PRACTICE_LOOP_APP_PASSWORD);
}

export function appAuthPassword() {
  return process.env.PRACTICE_LOOP_APP_PASSWORD ?? "";
}

export function safeRedirectPath(value: FormDataEntryValue | string | null) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  if (value.startsWith("/api/auth") || value.startsWith("/login")) {
    return "/";
  }

  return value;
}

export async function appAuthSessionToken() {
  const password = process.env.PRACTICE_LOOP_APP_PASSWORD ?? "";
  const sessionSecret = process.env.PRACTICE_LOOP_SESSION_SECRET ?? "";
  const data = new TextEncoder().encode(
    `${TOKEN_PREFIX}:${sessionSecret}:${password}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
