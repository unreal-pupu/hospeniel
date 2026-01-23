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
      path: "/admin",
      reason: "Admin role - redirecting to admin dashboard",
    };
  }

  // Priority 2: Vendor
  if (normalizedRole === "vendor") {
    return {
      path: "/vendor/dashboard",
      reason: "Vendor role - redirecting to vendor dashboard",
    };
  }

  // Priority 3: Rider
  if (normalizedRole === "rider") {
    return {
      path: "/portal",
      reason: "Rider role - redirecting to rider portal",
    };
  }

  // Priority 4: User (or default)
  if (normalizedRole === "user" || !normalizedRole) {
    // Use redirect param if it's safe (not admin/vendor routes)
    if (redirectParam && redirectParam.startsWith('/') && 
        !redirectParam.startsWith('/admin') && 
        !redirectParam.startsWith('/vendor')) {
      return {
        path: redirectParam,
        reason: `User role - using redirect parameter: ${redirectParam}`,
      };
    }
    
    return {
      path: "/explore",
      reason: "User role - redirecting to explore page",
    };
  }

  // Invalid role - default to explore
  console.warn(`⚠️ Unknown role "${role}" - defaulting to explore page`);
  return {
    path: "/explore",
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






