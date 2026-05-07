export interface VendorVisibilityState {
  is_open?: boolean | null;
  is_available?: boolean | null;
}

/**
 * Single source of truth for vendor visibility across the app.
 * Legacy rows with null/undefined values are treated as visible.
 */
export function isVendorVisible(vendor: VendorVisibilityState | null | undefined): boolean {
  // Safe defaults for legacy/incomplete rows:
  // missing visibility fields should not hide a vendor.
  if (!vendor) return true;
  if (vendor.is_open === false) return false;
  if (vendor.is_available === false) return false;
  return true;
}
