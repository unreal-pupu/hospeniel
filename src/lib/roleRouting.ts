/**
 * Centralized role-based routing logic
 * 
 * Valid roles from profiles.role:
 * - "admin" → Admin Dashboard
 * - "vendor" → Vendor Dashboard
 * - "rider" → Rider Portal (/portal, approval-gated)
 * - "user" → User area (/explore)
 * 
 * This ensures consistent routing across:
 * - Login flow
 * - Middleware
 * - Protected layouts
 */

export type UserRole = "admin" | "vendor" | "rider" | "user";

export interface RoleRedirectResult {
  path: string;
  reason: string;
}

/**
 * Google OAuth PKCE return — the ONLY app route that should receive the provider `?code=`.
 * Add this exact URL to Supabase Dashboard → Auth → URL configuration → Redirect URLs.
 */
export const OAUTH_PKCE_CALLBACK_PATH = "/auth/oauth/callback" as const;

/** Legacy OAuth URL only — not emitted by app post-login; middleware forwards to {@link OAUTH_PKCE_CALLBACK_PATH}. */
export const LEGACY_AUTH_CALLBACK_PATH = "/auth/callback" as const;

/**
 * Strip query/hash and normalize path for prefix checks.
 */
export function pathOnlyLower(path: string): string {
  const q = path.split("?")[0]?.split("#")[0] ?? path;
  return q.toLowerCase();
}

/** True if a full URL or path targets OAuth infrastructure (not for email/password). */
export function urlTargetsOAuthInfrastructurePath(urlOrPath: string): boolean {
  const lower = urlOrPath.toLowerCase();
  return (
    lower.includes("/auth/oauth/callback") ||
    lower.includes("auth%2foauth%2fcallback") ||
    lower.includes("/auth/callback") ||
    lower.includes("auth%2fcallback")
  );
}

/** Path-only check (leading path segment), for redirect results like `/admin`. */
export function pathStartsWithOAuthInfrastructure(path: string): boolean {
  const base = pathOnlyLower(path.split("?")[0]?.split("#")[0] ?? path);
  return (
    base === LEGACY_AUTH_CALLBACK_PATH ||
    base.startsWith(`${LEGACY_AUTH_CALLBACK_PATH}/`) ||
    base === OAUTH_PKCE_CALLBACK_PATH ||
    base.startsWith(`${OAUTH_PKCE_CALLBACK_PATH}/`)
  );
}

/**
 * Last line of defense: never return OAuth callback paths from role-based routing.
 */
export function coerceNeverAuthCallbackPostLoginPath(path: string, context: string): string {
  if (pathStartsWithOAuthInfrastructure(path)) {
    console.error(`[roleRouting] coerced unsafe post-login path (must never be OAuth infrastructure)`, {
      path,
      context,
      stack: new Error().stack,
    });
    return "/explore";
  }
  return path;
}

/**
 * `redirect` / returnUrl for **customer (user) role** only — never auth internals or OAuth callback.
 */
export function sanitizeUserPostLoginRedirect(redirectParam: string | null | undefined): string | null {
  if (!redirectParam || typeof redirectParam !== "string") return null;
  const trimmed = redirectParam.trim();
  if (!trimmed.startsWith("/")) return null;
  const base = pathOnlyLower(trimmed);
  if (base.startsWith("/admin")) return null;
  if (base.startsWith("/vendor")) return null;
  if (base.startsWith("/auth/callback")) return null;
  if (base.startsWith("/auth/oauth/callback")) return null;
  if (base.startsWith("/auth/")) return null;
  return trimmed;
}

/**
 * Get redirect path based on user role from profiles table
 * 
 * Priority order (mutually exclusive):
 * 1. admin → /admin
 * 2. vendor → /vendor/dashboard
 * 3. rider → /portal
 * 4. user → /explore (or redirect param if safe)
 * 
 * @param role - The role from profiles.role column
 * @param redirectParam - Optional redirect parameter from URL or sessionStorage
 * @returns Redirect path and reason
 */
export function getRoleBasedRedirect(
  role: string | null | undefined,
  redirectParam?: string | null
): RoleRedirectResult {
  // Normalize role to lowercase for comparison
  const normalizedRole = role?.toLowerCase().trim();

  // Priority 1: Admin
  if (normalizedRole === "admin") {
    return {
      path: coerceNeverAuthCallbackPostLoginPath("/admin", "admin branch"),
      reason: "Admin role - redirecting to admin dashboard",
    };
  }

  // Priority 2: Vendor
  if (normalizedRole === "vendor") {
    return {
      path: coerceNeverAuthCallbackPostLoginPath("/vendor/dashboard", "vendor branch"),
      reason: "Vendor role - redirecting to vendor dashboard",
    };
  }

  // Priority 3: Rider
  if (normalizedRole === "rider") {
    return {
      path: coerceNeverAuthCallbackPostLoginPath("/portal", "rider branch"),
      reason: "Rider role - redirecting to rider portal",
    };
  }

  // Priority 4: User (or default)
  if (normalizedRole === "user" || !normalizedRole) {
    const safeRedirect = sanitizeUserPostLoginRedirect(redirectParam);
    if (safeRedirect) {
      return {
        path: coerceNeverAuthCallbackPostLoginPath(
          safeRedirect,
          `user branch (sanitized redirect: ${safeRedirect})`
        ),
        reason: `User role - using sanitized redirect parameter: ${safeRedirect}`,
      };
    }

    return {
      path: coerceNeverAuthCallbackPostLoginPath("/explore", "user default explore"),
      reason: "User role - redirecting to explore page",
    };
  }

  // Invalid role - default to explore
  console.warn(`⚠️ Unknown role "${role}" - defaulting to explore page`);
  return {
    path: coerceNeverAuthCallbackPostLoginPath("/explore", "unknown role fallback"),
    reason: `Unknown role "${role}" - defaulting to explore page`,
  };
}

/**
 * Check if a role is valid
 */
export function isValidRole(role: string | null | undefined): role is UserRole {
  const normalizedRole = role?.toLowerCase().trim();
  return normalizedRole === "admin" || 
         normalizedRole === "vendor" || 
         normalizedRole === "rider" || 
         normalizedRole === "user";
}






