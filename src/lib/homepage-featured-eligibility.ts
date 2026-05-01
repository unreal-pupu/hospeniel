import { VENDOR_PREMIUM_TOOL_HOMEPAGE_FEATURED_PLACEMENT } from "@/lib/vendor-premium-tools-catalog";

/** `features.name` in DB for the paid homepage-placement product (entitlements / internal use). */
export const HOMEPAGE_FEATURED_PLACEMENT_FEATURE_SLUG = "featured_placement" as const;

/** `profiles.is_featured` — set only via admin; not the same as subscription or other premium tools. */
export const PROFILE_COLUMN_ADMIN_FEATURED = "is_featured" as const;

/**
 * All tool_name values we treat as "Featured Placement" for homepage eligibility.
 * Keep in sync with Paystack metadata / `vendor_purchased_tools` inserts (casing-only variants).
 */
export const HOMEPAGE_FEATURED_PLACEMENT_TOOL_NAME_VARIANTS: readonly string[] = [
  VENDOR_PREMIUM_TOOL_HOMEPAGE_FEATURED_PLACEMENT,
  VENDOR_PREMIUM_TOOL_HOMEPAGE_FEATURED_PLACEMENT.toLowerCase(),
  "Featured placement",
];

export function normalizeVendorUuid(id: string | null | undefined): string {
  if (id == null) return "";
  return String(id).trim().toLowerCase();
}

/**
 * Admin featured for homepage: ONLY JavaScript boolean `true`.
 * String "true", 1, etc. do NOT qualify (data bug — fix in DB / use admin API).
 */
export function isProfileAdminFeaturedStrict(isFeatured: unknown): boolean {
  return isFeatured === true;
}

export function isHomepageFeaturedPlacementToolName(toolName: string | null | undefined): boolean {
  if (toolName == null) return false;
  const normalized = toolName.trim().replace(/\s+/g, " ");
  const canonical = VENDOR_PREMIUM_TOOL_HOMEPAGE_FEATURED_PLACEMENT;
  if (normalized === canonical) return true;
  return normalized.toLowerCase() === canonical.toLowerCase();
}

export interface FeaturedPlacementToolRow {
  tool_name: string;
  status: string;
  expiry_date: string | null;
}

/**
 * Strict paid eligibility: correct tool name (after trim/normalize), status exactly active, expiry present and in the future.
 */
export function isStrictlyActiveFeaturedPlacementPurchase(
  row: FeaturedPlacementToolRow,
  nowMs: number = Date.now()
): boolean {
  if (!isHomepageFeaturedPlacementToolName(row.tool_name)) return false;
  if (row.status == null || String(row.status).trim().toLowerCase() !== "active") return false;
  if (row.expiry_date == null || String(row.expiry_date).trim() === "") return false;
  const exp = new Date(row.expiry_date).getTime();
  if (Number.isNaN(exp)) return false;
  return exp > nowMs;
}

export interface QualifiesDebugContext {
  vendorId: string;
  profileIsFeaturedRaw?: boolean | null;
  paidTool?: { tool_name: string; status: string; expiry_date: string | null } | null;
}

/** Only admin featured OR verified active Featured Placement purchase. */
export function qualifiesForHomepageFeaturedSection(
  isFeaturedByAdmin: boolean,
  hasActiveHomepagePlacementPurchase: boolean,
  debug?: QualifiesDebugContext
): boolean {
  const admin = Boolean(isFeaturedByAdmin);
  const paid = Boolean(hasActiveHomepagePlacementPurchase);
  const result = admin || paid;

  if (process.env.DEBUG_FEATURED_VENDORS === "1" && debug) {
    const paidTool = debug.paidTool;
    console.log("[featured-vendors][qualifiesForHomepageFeaturedSection]", {
      vendorId: debug.vendorId,
      is_featured_by_admin: admin,
      has_homepage_featured_placement: paid,
      profileIsFeaturedRaw: debug.profileIsFeaturedRaw,
      paidTool_status: paidTool?.status ?? null,
      paidTool_expiry_date: paidTool?.expiry_date ?? null,
      paidTool_tool_name: paidTool?.tool_name ?? null,
      qualifies: result,
    });
  }

  return result;
}

/** Human-readable explanation for proof payloads / logs. */
export function explainHomepageFeaturedQualification(
  isFeaturedByAdmin: boolean,
  hasHomepageFeaturedPlacement: boolean
): string {
  if (isFeaturedByAdmin && hasHomepageFeaturedPlacement) {
    return "BOTH: profiles.is_featured is strict boolean true AND an active non-expired Featured Placement tool row passed validation.";
  }
  if (isFeaturedByAdmin) {
    return "ADMIN: profiles.is_featured is strict boolean true (JavaScript === true). No paid Featured Placement proof required.";
  }
  if (hasHomepageFeaturedPlacement) {
    return "PAID: At least one vendor_purchased_tools row matched a Featured Placement tool_name variant, status === 'active' (case-insensitive), expiry_date non-null, and expiry_date > server now (UTC ms).";
  }
  return "NONE: Does not qualify — should not appear in API response.";
}
