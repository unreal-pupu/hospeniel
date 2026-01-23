/**
 * Vendor category constants
 * Single source of truth for vendor categories across the app
 * 
 * These categories are used in:
 * - Vendor registration (src/app/register/page.tsx)
 * - Explore page filters (src/app/explore/page.tsx)
 * - Vendor settings (src/app/vendor/settings/page.tsx)
 * - Admin vendors page (src/app/admin/vendors/page.tsx)
 * - SEO utilities (src/lib/seo.ts)
 * 
 * Categories must match Supabase CHECK constraint values
 */

export interface VendorCategory {
  label: string;
  value: string;
}

export const VENDOR_CATEGORIES: VendorCategory[] = [
  { label: "Food Vendor", value: "food_vendor" },
  { label: "Chef", value: "chef" },
  { label: "Baker", value: "baker" },
  { label: "Small Chops", value: "small_chops" },
  { label: "Home Cook", value: "home_cook" },
] as const;

/**
 * Get all categories including "All" option for filters
 * Used in explore page where "All" is needed as a filter option
 */
export const getCategoriesWithAll = (): VendorCategory[] => {
  return [
    { label: "All", value: "All" },
    ...VENDOR_CATEGORIES,
  ];
};

/**
 * Get category label from value
 * Used for displaying category names
 */
export const getCategoryLabel = (value: string | null | undefined): string => {
  if (!value) return "";
  const category = VENDOR_CATEGORIES.find(c => c.value === value);
  return category?.label || value;
};

/**
 * Category mapping for SEO and display purposes
 */
export const CATEGORY_LABELS: Record<string, string> = {
  food_vendor: "Food Vendor",
  chef: "Chef",
  baker: "Baker",
  small_chops: "Small Chops",
  home_cook: "Home Cook",
};







