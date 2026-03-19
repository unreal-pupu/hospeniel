/**
 * Canonical catalog for premium vendor tools (subscription page + payment verification).
 * Keep titles in sync with PREMIUM_TOOLS in vendor/subscription/page.tsx.
 */

export interface VendorPremiumToolDefinition {
  toolName: string;
  monthlyPriceNgn: number;
}

export const VENDOR_PREMIUM_TOOLS: VendorPremiumToolDefinition[] = [
  { toolName: "Featured Placement", monthlyPriceNgn: 10 },
  { toolName: "Priority Location Boost", monthlyPriceNgn: 5000 },
  { toolName: "Sponsored Banners", monthlyPriceNgn: 7000 },
  { toolName: "Brand Promotion", monthlyPriceNgn: 25000 },
  { toolName: "Marketing Tools", monthlyPriceNgn: 20000 },
  { toolName: "Analytical Marketing", monthlyPriceNgn: 10 },
];

export type VendorToolBilling = "monthly" | "yearly";

export function getExpectedToolPriceKobo(
  toolName: string,
  billing: VendorToolBilling
): number | null {
  const tool = VENDOR_PREMIUM_TOOLS.find((t) => t.toolName === toolName);
  if (!tool) return null;
  const monthly = tool.monthlyPriceNgn;
  if (billing === "monthly") return Math.round(monthly * 100);
  // Apply 10% discount for yearly billing:
  // yearly = (monthly * 12) * 0.9
  const yearlyNgn = monthly * 12 * 0.9;
  return Math.round(yearlyNgn * 100);
}

export function computeToolExpiryDate(
  purchaseDate: Date,
  billing: VendorToolBilling
): Date {
  const d = new Date(purchaseDate.getTime());
  if (billing === "yearly") {
    d.setUTCMonth(d.getUTCMonth() + 12);
    return d;
  }
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function isValidPremiumToolName(name: string): boolean {
  return VENDOR_PREMIUM_TOOLS.some((t) => t.toolName === name);
}
