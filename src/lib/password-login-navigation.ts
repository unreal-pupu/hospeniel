/**
 * Email/password login must never navigate through OAuth callback routes (PKCE only).
 * Guards + helpers to log the stack if anything attempts that during an active password login.
 */

import { coerceNeverAuthCallbackPostLoginPath, type UserRole } from "./roleRouting";

export const PASSWORD_LOGIN_NAV_GUARD_KEY = "__hospineil_pwd_login_nav" as const;
export const AUTH_METHOD_STORAGE_KEY = "__hospineil_auth_method" as const;

/** Set on successful password login so OAuth callback can skip PKCE if hit mistakenly after password sign-in. */
export const PASSWORD_LOGIN_COMPLETION_TS_KEY = "__hospineil_pw_login_completed_at" as const;

export const PASSWORD_LOGIN_CALLBACK_GUARD_MS = 45_000;

export function markPasswordLoginJustCompleted(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PASSWORD_LOGIN_COMPLETION_TS_KEY, String(Date.now()));
}

export function clearPasswordLoginCompletionMarker(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PASSWORD_LOGIN_COMPLETION_TS_KEY);
}

/** Age in ms since password login succeeded, or null if marker absent. */
export function getMsSincePasswordLoginCompletion(): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(PASSWORD_LOGIN_COMPLETION_TS_KEY);
  if (!raw) return null;
  const t = Number(raw);
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

export type TrackedAuthMethod = "email_password" | "oauth_google";

export function setTrackedAuthMethod(method: TrackedAuthMethod): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(AUTH_METHOD_STORAGE_KEY, method);
}

export function clearTrackedAuthMethod(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(AUTH_METHOD_STORAGE_KEY);
}

/** Call when user clicks "Continue with Google" so password-login guards are not active for OAuth redirects. */
export function markOAuthGoogleFlowStarting(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PASSWORD_LOGIN_NAV_GUARD_KEY);
  clearPasswordLoginCompletionMarker();
  sessionStorage.setItem(AUTH_METHOD_STORAGE_KEY, "oauth_google");
}

export function beginPasswordLoginNavigation(): void {
  if (typeof sessionStorage === "undefined") return;
  clearPasswordLoginCompletionMarker();
  sessionStorage.setItem(PASSWORD_LOGIN_NAV_GUARD_KEY, "1");
  sessionStorage.setItem(AUTH_METHOD_STORAGE_KEY, "email_password");
}

export function endPasswordLoginNavigation(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PASSWORD_LOGIN_NAV_GUARD_KEY);
}

/** Single exit for email/password success navigation (full page load; avoids Next router OAuth paths). */
export function navigateAfterPasswordLogin(
  target: string,
  meta: { reason: string; roleHint?: UserRole | string | null }
): void {
  clearTrackedAuthMethod();
  endPasswordLoginNavigation();
  const safe = coerceNeverAuthCallbackPostLoginPath(
    target,
    `navigateAfterPasswordLogin: ${meta.reason}`,
    meta.roleHint
  );
  markPasswordLoginJustCompleted();
  console.log("[login][email/password] navigateAfterPasswordLogin", {
    target,
    resolved: safe,
    reason: meta.reason,
  });
  window.location.replace(safe);
}
