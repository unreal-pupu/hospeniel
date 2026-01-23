/**
 * Vendor location constants
 * Single source of truth for vendor locations across the app
 * 
 * These locations are used in:
 * - Vendor registration (src/app/register/page.tsx)
 * - Explore page filters (src/app/explore/page.tsx)
 * - Vendor settings (src/app/vendor/settings/page.tsx)
 * 
 * Updated locations: Yenagoa, Amassoma, Otuoke
 */

export const VENDOR_LOCATIONS = [
  "Yenagoa",
  "Amassoma",
  "Otuoke",
] as const;

export type VendorLocation = typeof VENDOR_LOCATIONS[number];

/**
 * Get all locations including "All Locations" option for filters
 * Used in explore page where "All Locations" is needed as a filter option
 */
export const getLocationsWithAll = (): string[] => {
  return ["All Locations", ...VENDOR_LOCATIONS];
};







