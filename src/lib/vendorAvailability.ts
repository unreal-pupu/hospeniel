/**
 * Explore / listing visibility: treat missing/null as open (legacy rows); only explicit false = closed.
 */
export function isVendorExploreVisible(isOpen: boolean | null | undefined): boolean {
  return isOpen !== false;
}
